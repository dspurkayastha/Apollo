import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, internalError } from "@/lib/api/errors";
import { checkLicenceGate } from "@/lib/api/licence-gate";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { assembleThesisContent } from "@/lib/latex/assemble";
import type { Project, Section, Citation } from "@/lib/types/database";
import * as fs from "fs";
import * as path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const gateResult = await checkLicenceGate(id, authResult.user.id);
    if (gateResult instanceof NextResponse) return gateResult;

    // Block downloads for licensed projects before Phase 6
    if (gateResult.status === "licensed" && gateResult.currentPhase < 6) {
      return NextResponse.json(
        {
          error: {
            code: "DOWNLOAD_RESTRICTED",
            message: "Source download available from Phase 6 onwards. Use the preview panel.",
          },
        },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const [projectRes, sectionsRes, citationsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase
        .from("sections")
        .select("*")
        .eq("project_id", id)
        .in("status", ["approved", "review"])
        .order("phase_number"),
      supabase.from("citations").select("*").eq("project_id", id),
    ]);

    if (!projectRes.data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        { status: 404 }
      );
    }

    const project = projectRes.data as Project;
    const sections = (sectionsRes.data ?? []) as Section[];
    const citations = (citationsRes.data ?? []) as Citation[];

    // Read the template
    const templatePath = path.join(process.cwd(), "..", "..", "templates", "main.tex");
    let template = "";
    try {
      template = fs.readFileSync(templatePath, "utf-8");
    } catch {
      template = "% Template not found";
    }

    const { tex, bib, chapterFiles } = assembleThesisContent(
      template,
      project,
      sections,
      citations
    );

    // Build a JSON manifest of all files (actual ZIP requires archiver library)
    const sourceBundle: Record<string, string> = {
      "main.tex": tex,
      "refs.bib": bib,
    };

    for (const [chapterPath, content] of Object.entries(chapterFiles)) {
      sourceBundle[chapterPath] = content;
    }

    // Determine CLS file
    const clsName =
      project.university_type === "ssuhs"
        ? "ssuhs-thesis.cls"
        : "sskm-thesis.cls";

    try {
      const clsPath = path.join(process.cwd(), "..", "..", "templates", clsName);
      sourceBundle[clsName] = fs.readFileSync(clsPath, "utf-8");
    } catch {
      // CLS not available locally
    }

    return NextResponse.json(
      { data: sourceBundle },
      {
        headers: {
          "Content-Disposition": `attachment; filename="${project.title || "thesis"}-source.json"`,
        },
      }
    );
  } catch (err) {
    console.error("Source export error:", err);
    return internalError();
  }
}
