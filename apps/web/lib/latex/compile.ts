import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, mkdir, rm, copyFile } from "fs/promises";
import path from "path";
import os from "os";
import { parseLatexLog } from "./parse-log";
import type { ParsedLog } from "./parse-log";

const execFileAsync = promisify(execFile);

export type CompileMode = "docker" | "local" | "mock";

export interface CompileResult {
  success: boolean;
  pdfPath: string | null;
  log: ParsedLog;
  rawLog: string;
  compileTimeMs: number;
}

function getCompileMode(): CompileMode {
  const mode = process.env.LATEX_COMPILE_MODE;
  if (mode === "docker" || mode === "local" || mode === "mock") return mode;
  return "mock";
}

/**
 * Compile LaTeX source into a PDF.
 */
export async function compileTex(
  texContent: string,
  options: {
    projectId: string;
    watermark?: boolean;
    draftFooter?: boolean;
    clsFiles?: string[];
    bstFile?: string;
    bibContent?: string;
    chapterFiles?: Record<string, string>;
    /** Paths to figure files (relative path → absolute source path) */
    figureFiles?: Record<string, string>;
  }
): Promise<CompileResult> {
  const mode = getCompileMode();

  if (mode === "mock") {
    return mockCompile(texContent);
  }

  if (mode === "docker") {
    return dockerCompile(texContent, options);
  }

  return localCompile(texContent, options);
}

async function mockCompile(texContent: string): Promise<CompileResult> {
  // For testing: validate basic TeX structure
  const hasDocumentClass = /\\documentclass/.test(texContent);
  const hasBeginDocument = /\\begin\{document\}/.test(texContent);
  const hasEndDocument = /\\end\{document\}/.test(texContent);

  const errors: string[] = [];
  if (!hasDocumentClass) errors.push("Missing \\documentclass");
  if (!hasBeginDocument) errors.push("Missing \\begin{document}");
  if (!hasEndDocument) errors.push("Missing \\end{document}");

  const success = errors.length === 0;

  // In mock mode, write a minimal placeholder PDF so the compile route sees a pdfPath
  let pdfPath: string | null = null;
  if (success) {
    const persistDir = path.join(os.tmpdir(), "apollo-pdfs");
    await mkdir(persistDir, { recursive: true });
    pdfPath = path.join(persistDir, "mock.pdf");
    // Minimal valid PDF (1-page blank)
    const minimalPdf = `%PDF-1.0\n1 0 obj<</Pages 2 0 R>>endobj\n2 0 obj<</Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n`;
    await writeFile(pdfPath, minimalPdf);
  }

  return {
    success,
    pdfPath,
    log: { errors, warnings: [], errorCount: errors.length, warningCount: 0 },
    rawLog: success ? "Mock compilation successful" : errors.join("\n"),
    compileTimeMs: 1,
  };
}

async function dockerCompile(
  texContent: string,
  options: {
    projectId: string;
    watermark?: boolean;
    draftFooter?: boolean;
    clsFiles?: string[];
    bstFile?: string;
    bibContent?: string;
    chapterFiles?: Record<string, string>;
    figureFiles?: Record<string, string>;
  }
): Promise<CompileResult> {
  const start = Date.now();
  const workDir = path.join(os.tmpdir(), `apollo-compile-${options.projectId}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Write tex content — inject watermark/draft footer via LaTeX package
    await writeFile(path.join(workDir, "main.tex"), injectWatermarkPackage(texContent, options));

    // Copy CLS and BST files from templates
    const templatesDir = path.resolve(process.cwd(), "../../templates");
    const clsFiles = options.clsFiles ?? ["sskm-thesis.cls", "ssuhs-thesis.cls"];

    for (const cls of clsFiles) {
      try {
        const content = await readFile(path.join(templatesDir, cls));
        await writeFile(path.join(workDir, cls), content);
      } catch {
        // CLS file may not exist locally in all environments
      }
    }

    const bstFile = options.bstFile ?? "vancouver.bst";
    try {
      const bstContent = await readFile(path.join(templatesDir, bstFile));
      await writeFile(path.join(workDir, bstFile), bstContent);
    } catch {
      // BST may not exist locally
    }

    // Copy logo directory
    try {
      const logoDir = path.join(templatesDir, "logo");
      await mkdir(path.join(workDir, "logo"), { recursive: true });
      const { stdout: logoFiles } = await execFileAsync("ls", [logoDir]);
      for (const file of logoFiles.trim().split("\n").filter(Boolean)) {
        const content = await readFile(path.join(logoDir, file));
        await writeFile(path.join(workDir, "logo", file), content);
      }
    } catch {
      // Logo dir may not exist
    }

    // Write references.bib (populated or empty)
    await writeFile(path.join(workDir, "references.bib"), options.bibContent ?? "");

    // Write chapter files
    if (options.chapterFiles) {
      await mkdir(path.join(workDir, "chapters"), { recursive: true });
      for (const [filename, content] of Object.entries(options.chapterFiles)) {
        await writeFile(path.join(workDir, filename), content);
      }
    }

    // Copy figure files (relative path → absolute source) into workDir
    if (options.figureFiles) {
      for (const [relPath, srcPath] of Object.entries(options.figureFiles)) {
        try {
          const destPath = path.join(workDir, relPath);
          await mkdir(path.dirname(destPath), { recursive: true });
          await copyFile(srcPath, destPath);
        } catch {
          // Figure file may have been deleted — non-fatal
        }
      }
    }

    // Create output directory
    const outputDir = path.join(workDir, "output");
    await mkdir(outputDir, { recursive: true });

    // Run Docker compile
    const containerName = process.env.LATEX_CONTAINER_NAME ?? "apollo-latex";

    // Security: network isolation + resource limits + Docker default seccomp.
    // Docker's built-in seccomp profile blocks dangerous syscalls (mount,
    // ptrace, reboot, kexec_load, etc.) and is well-tested. A custom whitelist
    // profile breaks container init (missing chdir, capget, epoll, etc.).
    const args = [
      "run", "--rm",
      "--network=none",
      "--tmpfs", "/tmp:rw,size=512m",
      "--memory=1g",
      "--pids-limit=256",
      "-v", `${workDir}:/thesis:rw`,
      containerName,
    ];

    const { stdout, stderr } = await execFileAsync("docker", args, {
      timeout: 120_000,
    });

    // Persist PDF to a stable directory (temp workDir is cleaned up in finally)
    let pdfPath: string | null = null;
    try {
      const pdfData = await readFile(path.join(outputDir, "main.pdf"));
      const persistDir = path.join(os.tmpdir(), "apollo-pdfs");
      await mkdir(persistDir, { recursive: true });
      pdfPath = path.join(persistDir, `${options.projectId}.pdf`);
      await writeFile(pdfPath, pdfData);
    } catch {
      // PDF may not have been generated
    }

    let rawLog = "";
    try {
      rawLog = await readFile(path.join(outputDir, "main.log"), "utf-8");
    } catch {
      rawLog = stdout + stderr;
    }

    const log = parseLatexLog(rawLog);

    return {
      success: log.errorCount === 0 && pdfPath !== null,
      pdfPath,
      log,
      rawLog,
      compileTimeMs: Date.now() - start,
    };
  } catch (err: unknown) {
    // execFileAsync includes stdout/stderr on the error object
    const execErr = err as { message?: string; stdout?: string; stderr?: string };
    const fullOutput = [execErr.stderr, execErr.stdout, execErr.message]
      .filter(Boolean)
      .join("\n");
    const log = parseLatexLog(fullOutput);

    // If parseLatexLog found no errors, use the raw error message
    if (log.errorCount === 0) {
      log.errors.push(execErr.message ?? "Docker compilation failed");
      log.errorCount = 1;
    }

    return {
      success: false,
      pdfPath: null,
      log,
      rawLog: fullOutput,
      compileTimeMs: Date.now() - start,
    };
  } finally {
    // Cleanup
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}

/**
 * Inject draftwatermark LaTeX package for local compile mode.
 * Docker mode handles this via --watermark-mode flag instead.
 */
function injectWatermarkPackage(
  texContent: string,
  options: { watermark?: boolean; draftFooter?: boolean }
): string {
  if (!options.watermark && !options.draftFooter) return texContent;

  const beginDocIdx = texContent.indexOf("\\begin{document}");
  if (beginDocIdx === -1) return texContent;

  let pkg: string;
  if (options.watermark) {
    // Sandbox: elegant centred "Apollo" in Palatino italic — stealth branding
    pkg = [
      "\\usepackage{draftwatermark}",
      "\\SetWatermarkText{\\fontfamily{ppl}\\selectfont\\itshape Apollo}",
      "\\SetWatermarkColor[gray]{0.92}",
      "\\SetWatermarkScale{2.5}",
      "\\SetWatermarkAngle{0}",
    ].join("\n") + "\n";
  } else {
    // Licensed draft: subtle bottom footer
    pkg = [
      "\\usepackage{draftwatermark}",
      "\\SetWatermarkText{\\fontfamily{ppl}\\selectfont Generated with Apollo}",
      "\\SetWatermarkColor[gray]{0.88}",
      "\\SetWatermarkScale{0.3}",
      "\\SetWatermarkAngle{0}",
    ].join("\n") + "\n";
  }

  return texContent.slice(0, beginDocIdx) + pkg + texContent.slice(beginDocIdx);
}

async function localCompile(
  texContent: string,
  options: {
    projectId: string;
    watermark?: boolean;
    draftFooter?: boolean;
    bibContent?: string;
    chapterFiles?: Record<string, string>;
    figureFiles?: Record<string, string>;
  }
): Promise<CompileResult> {
  const start = Date.now();
  const workDir = path.join(os.tmpdir(), `apollo-compile-${options.projectId}`);

  try {
    await mkdir(workDir, { recursive: true });
    await writeFile(path.join(workDir, "main.tex"), injectWatermarkPackage(texContent, options));

    // Copy templates
    const templatesDir = path.resolve(process.cwd(), "../../templates");
    for (const file of ["sskm-thesis.cls", "ssuhs-thesis.cls", "vancouver.bst"]) {
      try {
        const content = await readFile(path.join(templatesDir, file));
        await writeFile(path.join(workDir, file), content);
      } catch {
        // May not exist
      }
    }

    // Copy logos
    try {
      await mkdir(path.join(workDir, "logo"), { recursive: true });
      const { stdout } = await execFileAsync("ls", [path.join(templatesDir, "logo")]);
      for (const file of stdout.trim().split("\n").filter(Boolean)) {
        const content = await readFile(path.join(templatesDir, "logo", file));
        await writeFile(path.join(workDir, "logo", file), content);
      }
    } catch {
      // May not exist
    }

    // Write references.bib (populated or empty)
    await writeFile(path.join(workDir, "references.bib"), options.bibContent ?? "");

    // Write chapter files
    if (options.chapterFiles) {
      await mkdir(path.join(workDir, "chapters"), { recursive: true });
      for (const [filename, content] of Object.entries(options.chapterFiles)) {
        await writeFile(path.join(workDir, filename), content);
      }
    }

    // Copy figure files (relative path → absolute source) into workDir
    if (options.figureFiles) {
      for (const [relPath, srcPath] of Object.entries(options.figureFiles)) {
        try {
          const destPath = path.join(workDir, relPath);
          await mkdir(path.dirname(destPath), { recursive: true });
          await copyFile(srcPath, destPath);
        } catch {
          // Figure file may have been deleted — non-fatal
        }
      }
    }

    // Run pdflatex → bibtex → pdflatex × 2
    const pdflatexArgs = ["-interaction=nonstopmode", "-output-directory", workDir, path.join(workDir, "main.tex")];

    await execFileAsync("pdflatex", pdflatexArgs, { timeout: 120_000, cwd: workDir }).catch(() => {});
    await execFileAsync("bibtex", [path.join(workDir, "main")], { timeout: 30_000, cwd: workDir }).catch(() => {});
    await execFileAsync("pdflatex", pdflatexArgs, { timeout: 120_000, cwd: workDir }).catch(() => {});
    await execFileAsync("pdflatex", pdflatexArgs, { timeout: 120_000, cwd: workDir }).catch(() => {});

    // Persist PDF to a stable directory
    let pdfPath: string | null = null;
    try {
      const pdfData = await readFile(path.join(workDir, "main.pdf"));
      const persistDir = path.join(os.tmpdir(), "apollo-pdfs");
      await mkdir(persistDir, { recursive: true });
      pdfPath = path.join(persistDir, `${options.projectId}.pdf`);
      await writeFile(pdfPath, pdfData);
    } catch {
      // PDF may not have been generated
    }

    let rawLog = "";
    try {
      rawLog = await readFile(path.join(workDir, "main.log"), "utf-8");
    } catch {
      rawLog = "No log file generated";
    }

    const log = parseLatexLog(rawLog);

    return {
      success: log.errorCount === 0 && pdfPath !== null,
      pdfPath,
      log,
      rawLog,
      compileTimeMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      pdfPath: null,
      log: {
        errors: [err instanceof Error ? err.message : "Local compilation failed"],
        warnings: [],
        errorCount: 1,
        warningCount: 0,
      },
      rawLog: err instanceof Error ? err.message : "Unknown error",
      compileTimeMs: Date.now() - start,
    };
  } finally {
    // Cleanup work directory (PDF already persisted)
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}
