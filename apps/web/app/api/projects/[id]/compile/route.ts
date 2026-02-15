import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { readFile } from "fs/promises";
import path from "path";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  internalError,
  conflict,
  queueFull,
} from "@/lib/api/errors";
import { tryAcquire, release } from "@/lib/compute/semaphore";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { assembleThesisContent } from "@/lib/latex/assemble";
import { compileTex } from "@/lib/latex/compile";
import { preflightChapter, aiValidateChapters } from "@/lib/latex/validate";
import type { Project, Section, Citation, Compilation } from "@/lib/types/database";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (projectError || !project) {
      return notFound("Project not found");
    }

    const typedProject = project as Project;

    // Check for existing running compilation
    const { data: runningCompilation } = await supabase
      .from("compilations")
      .select("id")
      .eq("project_id", id)
      .eq("status", "running")
      .single();

    if (runningCompilation) {
      return conflict("A compilation is already in progress");
    }

    // Admission control — acquire compute slot
    const slot = tryAcquire("compile", id, authResult.user.id);
    if (!slot.acquired) {
      if (slot.position !== undefined) {
        return queueFull(Math.ceil((slot.estimatedWaitMs ?? 30000) / 1000));
      }
      return queueFull();
    }

    try {
      // Create compilation record
      const { data: compilation, error: compilationError } = await supabase
        .from("compilations")
        .insert({
          project_id: id,
          trigger: "manual",
          status: "running",
          warnings: [],
          errors: [],
        })
        .select("*")
        .single();

      if (compilationError || !compilation) {
        console.error("Failed to create compilation record:", compilationError);
        return internalError("Failed to start compilation");
      }

      // Read the template
      let template: string;
      try {
        const templatesDir = path.resolve(process.cwd(), "../../templates");
        template = await readFile(path.join(templatesDir, "main.tex"), "utf-8");
      } catch {
        await updateCompilation(supabase, compilation.id, {
          status: "failed",
          errors: ["Template file not found"],
        });
        return internalError("LaTeX template not found");
      }

      // Fetch sections and citations for assembly
      const [sectionsResult, citationsResult] = await Promise.all([
        supabase
          .from("sections")
          .select("*")
          .eq("project_id", id)
          .in("status", ["approved", "review"]),
        supabase
          .from("citations")
          .select("*")
          .eq("project_id", id),
      ]);

      const sections = (sectionsResult.data ?? []) as Section[];
      const citations = (citationsResult.data ?? []) as Citation[];

      // Assemble thesis content (metadata + chapter files + BibTeX)
      const { tex, bib, chapterFiles, warnings: texWarnings } = assembleThesisContent(
        template,
        typedProject,
        sections,
        citations
      );

      // Pre-flight validation on each chapter
      const preflightIssues = Object.entries(chapterFiles).flatMap(
        ([filename, content]) => preflightChapter(filename, content)
      );

      const preflightErrors = preflightIssues.filter((i) => i.severity === "error");
      const preflightWarnings = preflightIssues.filter((i) => i.severity === "warning");

      if (preflightErrors.length > 0) {
        await updateCompilation(supabase, compilation.id, {
          status: "failed",
          errors: preflightErrors.map(
            (i) => `${i.chapter}${i.line ? `:${i.line}` : ""}: ${i.message}`
          ),
          warnings: preflightWarnings.map(
            (i) => `${i.chapter}${i.line ? `:${i.line}` : ""}: ${i.message}`
          ),
        });

        return NextResponse.json(
          {
            data: {
              compilation_id: compilation.id,
              status: "validation_failed",
              issues: preflightIssues,
              action: "Fix the issues in the section editor and retry",
            },
          },
          { status: 422 }
        );
      }

      // AI validation (non-blocking — runs in parallel with compile setup)
      const aiValidationPromise = aiValidateChapters(chapterFiles);

      // Compile
      const isWatermark = typedProject.status === "sandbox";
      const result = await Sentry.startSpan(
        {
          name: "latex.compile",
          op: "compile.latex",
          attributes: {
            "project.id": id,
            "compile.watermark": isWatermark,
            "compile.chapters": Object.keys(chapterFiles).length,
          },
        },
        () =>
          compileTex(tex, {
            projectId: id,
            watermark: isWatermark,
            bibContent: bib,
            chapterFiles,
          })
      );

      // Collect all warnings
      const aiIssues = await aiValidationPromise;
      const aiWarnings = aiIssues.map(
        (i) => `[AI] ${i.chapter}: ${i.message}`
      );
      const allWarnings = [
        ...texWarnings,
        ...preflightWarnings.map(
          (i) => `${i.chapter}${i.line ? `:${i.line}` : ""}: ${i.message}`
        ),
        ...aiWarnings,
        ...result.log.warnings.map(String),
      ];

      if (result.success && result.pdfPath) {
        await updateCompilation(supabase, compilation.id, {
          status: "completed",
          warnings: allWarnings,
          errors: [],
          pdf_url: result.pdfPath,
          log_text: result.rawLog.slice(0, 50000),
          compile_time_ms: result.compileTimeMs,
        });

        return NextResponse.json({
          data: {
            compilation_id: compilation.id,
            status: "completed",
            warnings: allWarnings,
            errors: [],
            compile_time_ms: result.compileTimeMs,
          },
        });
      }

      // Compilation failed
      await updateCompilation(supabase, compilation.id, {
        status: "failed",
        warnings: allWarnings,
        errors: result.log.errors,
        log_text: result.rawLog.slice(0, 50000),
        compile_time_ms: result.compileTimeMs,
      });

      return NextResponse.json(
        {
          data: {
            compilation_id: compilation.id,
            status: "failed",
            warnings: allWarnings,
            errors: result.log.errors,
            compile_time_ms: result.compileTimeMs,
          },
        },
        { status: 422 }
      );
    } finally {
      release(slot.jobId!);
    }
  } catch (err) {
    console.error("Unexpected error in POST /api/projects/[id]/compile:", err);
    return internalError();
  }
}

async function updateCompilation(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  compilationId: string,
  data: Partial<Compilation>
) {
  await supabase
    .from("compilations")
    .update(data)
    .eq("id", compilationId);
}
