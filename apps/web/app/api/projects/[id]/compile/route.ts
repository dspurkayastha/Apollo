import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { readFile, writeFile, mkdir, stat } from "fs/promises";
import path from "path";
import os from "os";
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
import { uploadToR2, downloadFromR2 } from "@/lib/r2/client";
import { checkLicenceForPhase } from "@/lib/api/licence-phase-gate";
import type { Section, Citation, Figure, Compilation } from "@/lib/types/database";

/** Tmpdir location for figure downloads during compilation */
const FIGURES_TMP_DIR = path.join(os.tmpdir(), "apollo-figures");

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;

    // Licence phase gate — use current_phase for compile
    const supabase = createAdminSupabaseClient();
    const { data: projCheck } = await supabase
      .from("projects")
      .select("current_phase")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!projCheck) return notFound("Project not found");

    const gateResult = await checkLicenceForPhase(
      id, authResult.user.id, projCheck.current_phase as number, "compile"
    );
    if (gateResult instanceof NextResponse) return gateResult;

    const typedProject = gateResult.project;

    // Check for existing running compilation (with stale recovery)
    const { data: runningCompilation } = await supabase
      .from("compilations")
      .select("id, created_at")
      .eq("project_id", id)
      .eq("status", "running")
      .single();

    if (runningCompilation) {
      const STALE_COMPILE_MS = 5 * 60 * 1000; // 5 minutes
      const createdAt = new Date(runningCompilation.created_at).getTime();
      const age = Date.now() - createdAt;

      if (age < STALE_COMPILE_MS) {
        return conflict("A compilation is already in progress");
      }

      // Stale compilation — mark as failed and allow a new one
      await supabase
        .from("compilations")
        .update({
          status: "failed",
          errors: ["Compilation timed out after 5 minutes"],
        })
        .eq("id", runningCompilation.id);
    }

    // Admission control — acquire compute slot
    const slot = await tryAcquire("compile", id, authResult.user.id);
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

      // Fetch sections, citations, and figures for assembly
      const [sectionsResult, citationsResult, figuresResult] = await Promise.all([
        supabase
          .from("sections")
          .select("*")
          .eq("project_id", id)
          .in("status", ["approved", "review"]),
        supabase
          .from("citations")
          .select("*")
          .eq("project_id", id),
        supabase
          .from("figures")
          .select("*")
          .eq("project_id", id),
      ]);

      const sections = (sectionsResult.data ?? []) as Section[];
      const citations = (citationsResult.data ?? []) as Citation[];
      const figures = (figuresResult.data ?? []) as Figure[];

      // Resolve figure files: download from R2 to tmpdir, fall back to local disk
      const figureFiles: Record<string, string> = {};
      for (const fig of figures) {
        if (!fig.file_url) continue;
        // file_url is "figures/{projectId}/{analysisId}/{filename}"
        // R2 key is "projects/{projectId}/figures/{analysisId}/{filename}" (no double projectId)
        const afterProjectId = fig.file_url.replace(`figures/${id}/`, "");
        const r2Key = `projects/${id}/figures/${afterProjectId}`;
        const relAfterFigures = fig.file_url.replace(/^figures\//, "");
        const diskPath = path.join(FIGURES_TMP_DIR, relAfterFigures);

        try {
          // Try R2 first
          const buffer = await downloadFromR2(r2Key);
          await mkdir(path.dirname(diskPath), { recursive: true });
          await writeFile(diskPath, buffer);
          figureFiles[fig.file_url] = diskPath;
        } catch {
          // Fall back to local disk (dev/test)
          try {
            await stat(diskPath);
            figureFiles[fig.file_url] = diskPath;
          } catch {
            // File unavailable — will cause a non-fatal warning during compile
          }
        }
      }

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

      // Determine watermark mode
      const watermarkMode = getWatermarkMode(typedProject.status, typedProject.current_phase);
      const result = await Sentry.startSpan(
        {
          name: "latex.compile",
          op: "compile.latex",
          attributes: {
            "project.id": id,
            "compile.watermark": watermarkMode,
            "compile.chapters": Object.keys(chapterFiles).length,
          },
        },
        () =>
          compileTex(tex, {
            projectId: id,
            watermark: watermarkMode === "sandbox",
            draftFooter: watermarkMode === "draft_footer",
            bibContent: bib,
            chapterFiles,
            figureFiles,
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
        // Upload compiled PDF to R2
        let pdfUrl = result.pdfPath;
        try {
          const pdfBytes = await readFile(result.pdfPath);
          const r2Key = `projects/${id}/compilations/${compilation.id}.pdf`;
          await uploadToR2(r2Key, pdfBytes, "application/pdf");
          pdfUrl = r2Key;
        } catch (r2Err) {
          console.warn("Failed to upload PDF to R2, storing local path:", r2Err);
          // Keep the local path as fallback
        }

        await updateCompilation(supabase, compilation.id, {
          status: "completed",
          warnings: allWarnings,
          errors: [],
          pdf_url: pdfUrl,
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
      await release(slot.jobId!);
    }
  } catch (err) {
    console.error("Unexpected error in POST /api/projects/[id]/compile:", err);
    return internalError();
  }
}

type WatermarkMode = "sandbox" | "draft_footer" | "none";

function getWatermarkMode(status: string, currentPhase: number): WatermarkMode {
  if (status === "sandbox") return "sandbox";
  if (status === "completed") return "none";
  // Licensed project: draft footer from Phase 6 onwards
  if (status === "licensed" && currentPhase >= 6) return "draft_footer";
  return "none";
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
