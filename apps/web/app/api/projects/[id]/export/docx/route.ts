import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import os from "os";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, internalError } from "@/lib/api/errors";
import { checkLicenceGate } from "@/lib/api/licence-gate";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { assembleThesisContent } from "@/lib/latex/assemble";
import type { Project, Section, Citation, Abbreviation } from "@/lib/types/database";

const execFileAsync = promisify(execFile);

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

    // DOCX export is only available for completed theses
    if (gateResult.status !== "completed") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_COMPLETED",
            message: "DOCX export is available only after thesis completion.",
          },
        },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();

    // Fetch project, sections, citations, abbreviations for assembly
    const [projectRes, sectionsRes, citationsRes, abbreviationsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase
        .from("sections")
        .select("*")
        .eq("project_id", id)
        .in("status", ["approved", "review"])
        .order("phase_number"),
      supabase.from("citations").select("*").eq("project_id", id),
      supabase.from("abbreviations").select("*").eq("project_id", id),
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
    const abbreviations = (abbreviationsRes.data ?? []) as Abbreviation[];

    // Assemble thesis content
    const { chapterFiles, bib } = assembleThesisContent(
      "", // Template not needed for chapter extraction
      project,
      sections,
      citations,
      abbreviations
    );

    // Combine all chapters into a single LaTeX body for pandoc
    const fullBody = Object.entries(chapterFiles)
      .filter(([, content]) => content.trim())
      .map(([chapterPath, content]) => `%% ${chapterPath}\n${content}`)
      .join("\n\n");

    const safeFilename = (project.title || "thesis").replace(/[^\w\s.-]/g, "_");

    // Try pandoc conversion via Docker (production) or local pandoc (dev)
    const docxBuffer = await convertToDocx(fullBody, bib, id);

    if (docxBuffer) {
      return new NextResponse(new Uint8Array(docxBuffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${safeFilename}.docx"; filename*=UTF-8''${encodeURIComponent(safeFilename)}.docx`,
        },
      });
    }

    // Fallback: return LaTeX source if pandoc is unavailable
    return new NextResponse(fullBody, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename}.tex"; filename*=UTF-8''${encodeURIComponent(safeFilename)}.tex`,
      },
    });
  } catch (err) {
    console.error("DOCX export error:", err);
    return internalError();
  }
}

/**
 * Convert LaTeX body to DOCX using pandoc.
 * Tries Docker container first, then local pandoc, returns null if neither available.
 */
async function convertToDocx(
  latexBody: string,
  bibContent: string,
  projectId: string
): Promise<Buffer | null> {
  const workDir = path.join(os.tmpdir(), `apollo-docx-${projectId}-${Date.now()}`);

  try {
    await mkdir(workDir, { recursive: true });

    const texPath = path.join(workDir, "thesis.tex");
    const bibPath = path.join(workDir, "references.bib");
    const outPath = path.join(workDir, "thesis.docx");

    await writeFile(texPath, latexBody);
    await writeFile(bibPath, bibContent);

    // Try Docker pandoc first (production — pandoc is inside apollo-latex image)
    const compileMode = process.env.LATEX_COMPILE_MODE;
    const containerName = process.env.LATEX_CONTAINER_NAME ?? "apollo-latex";

    if (compileMode === "docker") {
      try {
        await execFileAsync("docker", [
          "run", "--rm",
          "--network=none",
          "--read-only",
          "--tmpfs", "/tmp:rw,size=256m",
          "--memory=512m",
          "--pids-limit=128",
          "--security-opt", "no-new-privileges:true",
          "--cap-drop=ALL",
          "-v", `${workDir}:/thesis:rw`,
          containerName,
          "pandoc",
          "/thesis/thesis.tex",
          "--bibliography=/thesis/references.bib",
          "-o", "/thesis/thesis.docx",
          "--wrap=auto",
        ], { timeout: 60_000 });

        return await readFile(outPath);
      } catch (err) {
        console.warn("Docker pandoc failed:", err instanceof Error ? err.message : err);
      }
    }

    // Try local pandoc (dev/local mode)
    try {
      await execFileAsync("pandoc", [
        texPath,
        `--bibliography=${bibPath}`,
        "-o", outPath,
        "--wrap=auto",
      ], { timeout: 60_000, cwd: workDir });

      return await readFile(outPath);
    } catch {
      // pandoc not installed locally — return null for fallback
    }

    return null;
  } finally {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}
