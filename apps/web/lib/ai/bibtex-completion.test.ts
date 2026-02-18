import { describe, it, expect } from "vitest";
import { checkBibtexIntegrity } from "./bibtex-completion";

describe("checkBibtexIntegrity", () => {
  it("returns complete when all cite keys have BibTeX entries", () => {
    const response = `\\section{Intro}
Some text\\cite{smith2024} and more\\cite{jones2023}.

---BIBTEX---
@article{smith2024,
  author={Smith, J},
  title={Test},
  year={2024}
}

@article{jones2023,
  author={Jones, A},
  title={Another},
  year={2023}
}`;

    const result = checkBibtexIntegrity(response);
    expect(result.complete).toBe(true);
    expect(result.missingKeys).toHaveLength(0);
    expect(result.bodyKeyCount).toBe(2);
    expect(result.entryCount).toBe(2);
  });

  it("detects missing BibTeX entries", () => {
    const response = `Text\\cite{smith2024} and\\cite{jones2023} and\\cite{missing2024}.

---BIBTEX---
@article{smith2024,
  author={Smith, J},
  title={Test},
  year={2024}
}`;

    const result = checkBibtexIntegrity(response);
    expect(result.complete).toBe(false);
    expect(result.missingKeys).toContain("jones2023");
    expect(result.missingKeys).toContain("missing2024");
    expect(result.missingKeys).not.toContain("smith2024");
    expect(result.bodyKeyCount).toBe(3);
    expect(result.entryCount).toBe(1);
  });

  it("handles response with no BibTeX section", () => {
    const response = `\\section{Intro}
Some text\\cite{smith2024}.`;

    const result = checkBibtexIntegrity(response);
    expect(result.complete).toBe(false);
    expect(result.missingKeys).toEqual(["smith2024"]);
    expect(result.entryCount).toBe(0);
  });

  it("handles response with no citations", () => {
    const response = `\\section{Aims}
To determine the prevalence of anaemia.`;

    const result = checkBibtexIntegrity(response);
    expect(result.complete).toBe(true);
    expect(result.missingKeys).toHaveLength(0);
    expect(result.bodyKeyCount).toBe(0);
  });

  it("handles multi-key cite commands", () => {
    const response = `Text\\cite{a,b,c}.

---BIBTEX---
@article{a, author={A}, title={A}, year={2024}}
@article{b, author={B}, title={B}, year={2024}}`;

    const result = checkBibtexIntegrity(response);
    expect(result.complete).toBe(false);
    expect(result.missingKeys).toContain("c");
    expect(result.missingKeys).not.toContain("a");
    expect(result.missingKeys).not.toContain("b");
  });

  it("handles various BibTeX entry types", () => {
    const response = `Text\\cite{book1} and\\cite{conf1}.

---BIBTEX---
@book{book1,
  author={Author},
  title={Book},
  publisher={Pub},
  year={2024}
}

@inproceedings{conf1,
  author={Author},
  title={Conf Paper},
  booktitle={Proc},
  year={2024}
}`;

    const result = checkBibtexIntegrity(response);
    expect(result.complete).toBe(true);
    expect(result.entryCount).toBe(2);
  });
});
