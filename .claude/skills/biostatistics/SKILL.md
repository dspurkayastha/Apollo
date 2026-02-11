---
name: biostatistics
description: "Rigorous biostatistical analysis for clinical research. Use when performing statistical tests, generating publication-quality figures, creating Table 1, or analysing clinical datasets. Triggers on: statistics, analysis, figure, plot, chart, R script, Table 1, p-value, hypothesis test, chi-square, t-test, regression, survival."
---

# Biostatistics for Clinical Research

## When to Use
- Analysing clinical research datasets
- Generating statistical figures for thesis
- Creating Table 1 (demographics/baseline characteristics)
- Running hypothesis tests for study objectives
- Generating R scripts with embedded data
- Any statistical computation or visualisation

## R Package Requirements
```r
required_packages <- c(
  "tidyverse", "gtsummary", "ggplot2", "tableone",
  "survival", "survminer", "pROC", "exact2x2",
  "car", "lmtest", "broom", "scales", "patchwork",
  "knitr", "kableExtra", "RColorBrewer", "ggpubr",
  "nortest", "dunn.test", "effsize", "coin"
)

# Install missing packages
install_if_missing <- function(pkgs) {
  new <- pkgs[!(pkgs %in% installed.packages()[,"Package"])]
  if(length(new)) install.packages(new, repos="https://cloud.r-project.org")
}
install_if_missing(required_packages)
```

## Statistical Test Selection Decision Tree

### Categorical Variables
| Expected Cell Counts | Number of Groups | Test |
|----------------------|-----------------|------|
| All ≥ 5 | 2 | Chi-square test |
| Any < 5 | 2 | Fisher's exact test |
| All ≥ 5 | >2 | Chi-square test |
| Any < 5 | >2 | Fisher-Freeman-Halton exact test |

### Continuous Variables
| Distribution | Groups | Test |
|-------------|--------|------|
| Normal (Shapiro-Wilk p > 0.05) | 2 independent | Independent samples t-test |
| Non-normal | 2 independent | Mann-Whitney U test |
| Normal | 2 paired | Paired t-test |
| Non-normal | 2 paired | Wilcoxon signed-rank test |
| Normal | >2 independent | One-way ANOVA + Tukey's HSD |
| Non-normal | >2 independent | Kruskal-Wallis + Dunn's test |

### Correlation
| Variable Types | Test |
|---------------|------|
| Both continuous, normal | Pearson's r |
| Non-normal or ordinal | Spearman's rho |
| Nominal vs nominal | Cramér's V |

## Figure Standards
- **Output format**: PDF (vector graphics for thesis)
- **Resolution**: 300 DPI minimum for any raster elements
- **Dimensions**: width = 6.5 inches (fits LaTeX \textwidth), height contextual
- **Theme**: `theme_minimal()` or `theme_classic()` with:
  ```r
  theme_thesis <- theme_minimal(base_size = 12) +
    theme(
      plot.title = element_text(face = "bold", size = 14),
      axis.title = element_text(size = 12),
      axis.text = element_text(size = 10),
      legend.position = "bottom",
      panel.grid.minor = element_blank()
    )
  ```
- **Colours**: Colourblind-friendly palettes (viridis, RColorBrewer "Set2" or "Dark2")
- **Labels**: Title, axis labels with units, significance annotations where relevant
- **CRITICAL**: ALL data MUST be embedded in the R script (no external CSV calls)

## Reporting Standards
- Report: test statistic, degrees of freedom, exact p-value, 95% CI, effect size
- Use APA-style for tables (no vertical lines, minimal horizontal rules)
- Significance markers: * p < 0.05, ** p < 0.01, *** p < 0.001
- Always check assumptions before parametric tests:
  - Normality: Shapiro-Wilk test
  - Homogeneity of variance: Levene's test
  - Independence: study design verification
- For multiple comparisons: apply Bonferroni or Holm correction

## Effect Size Measures
| Test | Effect Size | Small | Medium | Large |
|------|------------|-------|--------|-------|
| t-test | Cohen's d | 0.2 | 0.5 | 0.8 |
| Chi-square | Cramér's V | 0.1 | 0.3 | 0.5 |
| ANOVA | Eta-squared (η²) | 0.01 | 0.06 | 0.14 |
| Correlation | r | 0.1 | 0.3 | 0.5 |
| Mann-Whitney | r = Z/√N | 0.1 | 0.3 | 0.5 |

## R Script Template
```r
#!/usr/bin/env Rscript
# Figure X: [Description]
# Thesis: [Title]
# Generated: [Date]

# === EMBEDDED DATA ===
data <- data.frame(
  # Paste actual data here
)

# === ANALYSIS ===
# [Statistical tests here]

# === FIGURE ===
library(ggplot2)
p <- ggplot(data, aes(x = ..., y = ...)) +
  geom_...() +
  labs(title = "...", x = "...", y = "...") +
  theme_thesis

ggsave("output/figures/figure_X.pdf", p, width = 6.5, height = 4.5, dpi = 300)
```
