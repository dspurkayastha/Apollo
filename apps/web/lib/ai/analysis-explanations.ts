/**
 * ELI15 ("Explain Like I'm 15") explanations for each analysis type.
 * Designed for medical PG students who may not have a statistics background.
 */

export interface AnalysisELI15 {
  title: string;
  eli15: string;
  when: string;
}

export const ANALYSIS_ELI15: Record<string, AnalysisELI15> = {
  descriptive: {
    title: "Descriptive Statistics",
    eli15:
      "This counts and summarises your data — how many males vs females, the average age, the most common blood group, etc. Think of it as a snapshot of who your patients are. It produces \"Table 1\" which every thesis needs.",
    when: "Always run this first. Every medical thesis needs a baseline characteristics table.",
  },
  "chi-square": {
    title: "Chi-Square / Fisher's Exact Test",
    eli15:
      "This checks if two categories are related. For example: \"Are diabetic patients more likely to have wound infections than non-diabetic ones?\" It compares the actual numbers you observed with what you'd expect if there were no relationship at all.",
    when: "Use when comparing two categorical (yes/no, group A vs B) variables.",
  },
  "t-test": {
    title: "T-Test / Wilcoxon Test",
    eli15:
      "This compares the average of a measurement between two groups. For example: \"Is the average blood sugar level different between the treatment group and the control group?\" If your data isn't normally distributed, it automatically switches to a Wilcoxon test.",
    when: "Use when comparing a numerical measurement (BP, age, lab value) between exactly two groups.",
  },
  correlation: {
    title: "Correlation Analysis",
    eli15:
      "This measures whether two numbers move together. For example: \"As BMI goes up, does blood pressure also go up?\" The result is a number from -1 to +1. Closer to +1 means they increase together; closer to -1 means one goes up as the other goes down.",
    when: "Use when you want to see if two numerical measurements are related to each other.",
  },
  survival: {
    title: "Survival Analysis (Kaplan-Meier)",
    eli15:
      "This tracks how long until something happens — like how many months until a tumour recurs or how long patients survive after surgery. It draws curves showing the probability of \"surviving\" (not having the event) over time and compares curves between groups.",
    when: "Use when your outcome is time-to-event (survival time, time to relapse, duration of hospital stay with censoring).",
  },
  roc: {
    title: "ROC Analysis",
    eli15:
      "This measures how good a test or marker is at telling sick from healthy patients. It draws a curve and calculates the area under it (AUC). An AUC of 0.5 means useless (coin flip), 0.7-0.8 is acceptable, and above 0.8 is good. It also finds the best cut-off value.",
    when: "Use when evaluating a diagnostic test, biomarker, or scoring system for its ability to distinguish two groups.",
  },
  logistic: {
    title: "Logistic Regression",
    eli15:
      "This figures out which factors predict a yes/no outcome, while controlling for other variables. For example: \"After adjusting for age and sex, does smoking independently predict lung infection?\" It gives odds ratios — an OR of 2 means smoking doubles the odds.",
    when: "Use when your outcome is binary (yes/no, disease/no disease) and you have multiple potential predictors to adjust for.",
  },
  kruskal: {
    title: "Kruskal-Wallis Test",
    eli15:
      "Like a t-test but for three or more groups. For example: \"Is there a difference in pain scores between mild, moderate, and severe groups?\" It doesn't assume your data is normally distributed, which is handy for small samples or skewed data.",
    when: "Use when comparing a numerical measurement across three or more groups (e.g., Grade I vs II vs III).",
  },
  "meta-analysis": {
    title: "Meta-Analysis",
    eli15:
      "This combines results from multiple published studies into one big picture. It produces a forest plot (each study is a line, the combined result is a diamond) and a funnel plot (to check for publication bias). You need pre-extracted data from other studies.",
    when: "Use only if your thesis is a systematic review/meta-analysis and you have extracted effect sizes from multiple studies.",
  },
};
