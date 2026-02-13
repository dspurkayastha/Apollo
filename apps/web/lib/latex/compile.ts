import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
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
    clsFiles?: string[];
    bstFile?: string;
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
  // For testing: just validate the TeX has basic structure
  const hasDocumentClass = /\\documentclass/.test(texContent);
  const hasBeginDocument = /\\begin\{document\}/.test(texContent);
  const hasEndDocument = /\\end\{document\}/.test(texContent);

  const errors: string[] = [];
  if (!hasDocumentClass) errors.push("Missing \\documentclass");
  if (!hasBeginDocument) errors.push("Missing \\begin{document}");
  if (!hasEndDocument) errors.push("Missing \\end{document}");

  return {
    success: errors.length === 0,
    pdfPath: null,
    log: { errors, warnings: [], errorCount: errors.length, warningCount: 0 },
    rawLog: errors.length === 0 ? "Mock compilation successful" : errors.join("\n"),
    compileTimeMs: 1,
  };
}

async function dockerCompile(
  texContent: string,
  options: {
    projectId: string;
    watermark?: boolean;
    clsFiles?: string[];
    bstFile?: string;
  }
): Promise<CompileResult> {
  const start = Date.now();
  const workDir = path.join(os.tmpdir(), `apollo-compile-${options.projectId}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Write tex content
    await writeFile(path.join(workDir, "main.tex"), texContent);

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

    // Create empty references.bib
    await writeFile(path.join(workDir, "references.bib"), "");

    // Create output directory
    const outputDir = path.join(workDir, "output");
    await mkdir(outputDir, { recursive: true });

    // Run Docker compile
    const containerName = process.env.LATEX_CONTAINER_NAME ?? "apollo-latex";
    const args = [
      "run",
      "--rm",
      "--network=none",
      "--read-only",
      "--tmpfs", "/tmp:rw,size=512m",
      "--memory=1g",
      "-v", `${workDir}:/thesis`,
      containerName,
    ];

    if (options.watermark) {
      args.push("--watermark");
    }

    const { stdout, stderr } = await execFileAsync("docker", args, {
      timeout: 120_000,
    });

    // Read output
    let pdfPath: string | null = null;
    try {
      await readFile(path.join(outputDir, "main.pdf"));
      pdfPath = path.join(outputDir, "main.pdf");
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
  } catch (err) {
    return {
      success: false,
      pdfPath: null,
      log: {
        errors: [err instanceof Error ? err.message : "Docker compilation failed"],
        warnings: [],
        errorCount: 1,
        warningCount: 0,
      },
      rawLog: err instanceof Error ? err.message : "Unknown error",
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

async function localCompile(
  texContent: string,
  options: {
    projectId: string;
    watermark?: boolean;
  }
): Promise<CompileResult> {
  const start = Date.now();
  const workDir = path.join(os.tmpdir(), `apollo-compile-${options.projectId}`);

  try {
    await mkdir(workDir, { recursive: true });
    await writeFile(path.join(workDir, "main.tex"), texContent);

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

    // Create empty references.bib
    await writeFile(path.join(workDir, "references.bib"), "");

    // Run pdflatex → bibtex → pdflatex × 2
    const pdflatexArgs = ["-interaction=nonstopmode", "-output-directory", workDir, path.join(workDir, "main.tex")];

    await execFileAsync("pdflatex", pdflatexArgs, { timeout: 120_000, cwd: workDir }).catch(() => {});
    await execFileAsync("bibtex", [path.join(workDir, "main")], { timeout: 30_000, cwd: workDir }).catch(() => {});
    await execFileAsync("pdflatex", pdflatexArgs, { timeout: 120_000, cwd: workDir }).catch(() => {});
    await execFileAsync("pdflatex", pdflatexArgs, { timeout: 120_000, cwd: workDir }).catch(() => {});

    let pdfPath: string | null = null;
    try {
      await readFile(path.join(workDir, "main.pdf"));
      pdfPath = path.join(workDir, "main.pdf");
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
  }
}
