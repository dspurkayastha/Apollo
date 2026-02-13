import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  internalError,
  conflict,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateTex } from "@/lib/latex/generate-tex";
import { compileTex } from "@/lib/latex/compile";
import type { Project, Compilation } from "@/lib/types/database";

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

    // Generate populated TeX
    const { tex, warnings: texWarnings } = generateTex(template, typedProject);

    // Compile
    const isWatermark = typedProject.status === "sandbox";
    const result = await compileTex(tex, {
      projectId: id,
      watermark: isWatermark,
    });

    // Update compilation record
    const allWarnings = [...texWarnings, ...result.log.warnings.map(String)];

    if (result.success && result.pdfPath) {
      // Read PDF and store URL (in production this would upload to R2)
      // For now, store the local path reference
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
