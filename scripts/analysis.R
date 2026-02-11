#!/usr/bin/env Rscript
## =============================================================
## Statistical Analysis: Ventral Hernia Thesis
## =============================================================

suppressPackageStartupMessages({
  library(tidyverse)
  library(gtsummary)
  library(tableone)
  library(ggplot2)
  library(scales)
})

# --- Read dataset ---
df <- read.csv("/Users/devs/Downloads/claude-code-package/output/thesis/dataset.csv",
               stringsAsFactors = TRUE)

# Output directories
fig_dir <- "/Users/devs/Downloads/claude-code-package/output/figures"
stat_dir <- "/Users/devs/Downloads/claude-code-package/output/stats"
dir.create(fig_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(stat_dir, showWarnings = FALSE, recursive = TRUE)

# --- Set factor levels ---
df$Sex <- factor(df$Sex, levels = c("Male", "Female"))
df$BMI_Category <- factor(df$BMI_Category, levels = c("Underweight", "Normal", "Overweight", "Obese"))
df$Hernia_Type <- factor(df$Hernia_Type, levels = c("Incisional", "Umbilical", "Paraumbilical", "Epigastric", "Spigelian"))
df$Surgical_Approach <- factor(df$Surgical_Approach, levels = c("Open", "Laparoscopic"))
df$Repair_Type <- factor(df$Repair_Type, levels = c("Primary closure", "Mesh repair"))
df$Clinical_Outcome <- factor(df$Clinical_Outcome, levels = c("Successful", "Complications managed", "Recurrence"))

cat("=== DESCRIPTIVE STATISTICS ===\n\n")

# --- 1. Demographics ---
cat("--- Demographics ---\n")
cat(sprintf("Total patients: %d\n", nrow(df)))
cat(sprintf("Age: mean=%.1f, SD=%.1f, range=%d-%d\n",
            mean(df$Age), sd(df$Age), min(df$Age), max(df$Age)))
cat(sprintf("Sex: Male=%d (%.1f%%), Female=%d (%.1f%%)\n",
            sum(df$Sex == "Male"), 100*mean(df$Sex == "Male"),
            sum(df$Sex == "Female"), 100*mean(df$Sex == "Female")))
cat(sprintf("BMI: mean=%.1f, SD=%.1f\n", mean(df$BMI), sd(df$BMI)))

# Age groups
df$Age_Group <- cut(df$Age, breaks = c(17, 30, 40, 50, 60, 70, 81),
                    labels = c("18-30", "31-40", "41-50", "51-60", "61-70", ">70"))
cat("\nAge Distribution:\n")
print(table(df$Age_Group))

cat("\nBMI Categories:\n")
print(table(df$BMI_Category))

cat("\nComorbidities:\n")
cat(sprintf("Diabetes: %d (%.1f%%)\n", sum(df$Diabetes == "Yes"), 100*mean(df$Diabetes == "Yes")))
cat(sprintf("Hypertension: %d (%.1f%%)\n", sum(df$Hypertension == "Yes"), 100*mean(df$Hypertension == "Yes")))
cat(sprintf("Smoking: %d (%.1f%%)\n", sum(df$Smoking == "Yes"), 100*mean(df$Smoking == "Yes")))

# --- 2. Hernia Type Distribution ---
cat("\n--- Hernia Types ---\n")
type_table <- df %>% count(Hernia_Type) %>% mutate(pct = round(100*n/sum(n), 1))
print(type_table)

# --- 3. EHS Classification ---
cat("\n--- EHS Classification (Incisional) ---\n")
inc_df <- df %>% filter(Hernia_Type == "Incisional")
cat("Incisional hernia EHS classes:\n")
print(table(inc_df$EHS_Classification))

# --- 4. Management ---
cat("\n--- Management ---\n")
cat(sprintf("Surgical Approach: Open=%d (%.1f%%), Laparoscopic=%d (%.1f%%)\n",
            sum(df$Surgical_Approach == "Open"), 100*mean(df$Surgical_Approach == "Open"),
            sum(df$Surgical_Approach == "Laparoscopic"), 100*mean(df$Surgical_Approach == "Laparoscopic")))
cat(sprintf("Repair Type: Primary=%d (%.1f%%), Mesh=%d (%.1f%%)\n",
            sum(df$Repair_Type == "Primary closure"), 100*mean(df$Repair_Type == "Primary closure"),
            sum(df$Repair_Type == "Mesh repair"), 100*mean(df$Repair_Type == "Mesh repair")))

cat("\nMesh Position (among mesh repairs):\n")
mesh_df <- df %>% filter(Repair_Type == "Mesh repair")
print(table(mesh_df$Mesh_Position))

# --- 5. Outcomes ---
cat("\n--- Outcomes ---\n")
cat(sprintf("Hospital Stay: mean=%.1f, SD=%.1f, median=%.0f\n",
            mean(df$Hospital_Stay_Days), sd(df$Hospital_Stay_Days), median(df$Hospital_Stay_Days)))
cat(sprintf("Postop Complications: %d (%.1f%%)\n",
            sum(df$Postop_Complications != "None"), 100*mean(df$Postop_Complications != "None")))
cat(sprintf("Recurrence: %d (%.1f%%)\n",
            sum(df$Recurrence == "Yes"), 100*mean(df$Recurrence == "Yes")))
cat(sprintf("Patient Satisfaction: mean=%.1f, SD=%.1f\n",
            mean(df$Patient_Satisfaction), sd(df$Patient_Satisfaction)))

cat("\nPostop Complications breakdown:\n")
print(table(df$Postop_Complications))

cat("\nClinical Outcomes:\n")
print(table(df$Clinical_Outcome))

# ============================================================
# COMPARATIVE ANALYSES
# ============================================================

cat("\n\n=== COMPARATIVE ANALYSES ===\n\n")

# --- 6. Hernia type by sex ---
cat("--- Hernia Type by Sex (Chi-square/Fisher's) ---\n")
ct_sex_type <- table(df$Sex, df$Hernia_Type)
print(ct_sex_type)
fisher_result <- fisher.test(ct_sex_type, simulate.p.value = TRUE, B = 10000)
cat(sprintf("Fisher's exact test p-value: %.4f\n", fisher_result$p.value))

# --- 7. Open vs Laparoscopic: Hospital stay ---
cat("\n--- Hospital Stay: Open vs Laparoscopic ---\n")
open_los <- df$Hospital_Stay_Days[df$Surgical_Approach == "Open"]
lap_los <- df$Hospital_Stay_Days[df$Surgical_Approach == "Laparoscopic"]
cat(sprintf("Open: mean=%.1f (SD=%.1f), median=%.0f\n", mean(open_los), sd(open_los), median(open_los)))
cat(sprintf("Laparoscopic: mean=%.1f (SD=%.1f), median=%.0f\n", mean(lap_los), sd(lap_los), median(lap_los)))

shapiro_open <- shapiro.test(open_los)
shapiro_lap <- shapiro.test(lap_los)
cat(sprintf("Shapiro-Wilk: Open p=%.4f, Lap p=%.4f\n", shapiro_open$p.value, shapiro_lap$p.value))

mw_test <- wilcox.test(open_los, lap_los, exact = FALSE)
cat(sprintf("Mann-Whitney U test: W=%.0f, p=%.4f\n", mw_test$statistic, mw_test$p.value))

# --- 8. Complications: Open vs Laparoscopic ---
cat("\n--- Postop Complications: Open vs Laparoscopic ---\n")
df$Has_Complication <- ifelse(df$Postop_Complications == "None", "No", "Yes")
ct_comp_approach <- table(df$Surgical_Approach, df$Has_Complication)
print(ct_comp_approach)
fisher_comp <- fisher.test(ct_comp_approach)
cat(sprintf("Fisher's exact test: OR=%.2f, p=%.4f\n", fisher_comp$estimate, fisher_comp$p.value))

# --- 9. Mesh vs Primary: Recurrence ---
cat("\n--- Recurrence: Mesh vs Primary ---\n")
ct_rec_repair <- table(df$Repair_Type, df$Recurrence)
print(ct_rec_repair)
fisher_rec <- fisher.test(ct_rec_repair)
cat(sprintf("Fisher's exact test: OR=%.2f, p=%.4f\n", fisher_rec$estimate, fisher_rec$p.value))

# --- 10. BMI category and hernia type ---
cat("\n--- BMI Category by Hernia Type ---\n")
ct_bmi_type <- table(df$BMI_Category, df$Hernia_Type)
print(ct_bmi_type)
fisher_bmi <- fisher.test(ct_bmi_type, simulate.p.value = TRUE, B = 10000)
cat(sprintf("Fisher's exact test p-value: %.4f\n", fisher_bmi$p.value))

# --- 11. Diabetes and complications ---
cat("\n--- Diabetes and Postop Complications ---\n")
ct_dm_comp <- table(df$Diabetes, df$Has_Complication)
print(ct_dm_comp)
fisher_dm <- fisher.test(ct_dm_comp)
cat(sprintf("Fisher's exact test: OR=%.2f, p=%.4f\n", fisher_dm$estimate, fisher_dm$p.value))

# --- 12. Previous surgery and hernia type ---
cat("\n--- Previous Surgery by Hernia Type ---\n")
ct_prevsurg <- table(df$Previous_Surgery, df$Hernia_Type)
print(ct_prevsurg)

# ============================================================
# GENERATE FIGURES
# ============================================================

cat("\n\n=== GENERATING FIGURES ===\n\n")

# Theme for publication quality
theme_thesis <- theme_minimal(base_size = 12, base_family = "serif") +
  theme(
    plot.title = element_text(face = "bold", size = 14, hjust = 0.5),
    axis.title = element_text(size = 12),
    axis.text = element_text(size = 10),
    legend.position = "bottom",
    panel.grid.minor = element_blank()
  )

# --- Figure 1: Age and Sex Distribution ---
p1 <- ggplot(df, aes(x = Age_Group, fill = Sex)) +
  geom_bar(position = "dodge", colour = "black", linewidth = 0.3) +
  scale_fill_manual(values = c("Male" = "#4472C4", "Female" = "#ED7D31")) +
  labs(x = "Age Group (years)", y = "Number of Patients", fill = "Sex") +
  theme_thesis
ggsave(file.path(fig_dir, "fig_age_sex_distribution.pdf"), p1, width = 7, height = 5, dpi = 300)
cat("Figure 1: Age-sex distribution saved\n")

# --- Figure 2: Hernia Type Distribution (pie chart) ---
type_data <- df %>% count(Hernia_Type) %>%
  mutate(pct = round(100*n/sum(n), 1),
         label = paste0(Hernia_Type, "\n", n, " (", pct, "%)"))
p2 <- ggplot(type_data, aes(x = "", y = n, fill = Hernia_Type)) +
  geom_bar(stat = "identity", width = 1, colour = "white") +
  coord_polar("y") +
  scale_fill_brewer(palette = "Set2") +
  geom_text(aes(label = paste0(pct, "%")),
            position = position_stack(vjust = 0.5), size = 3.5) +
  labs(fill = "Hernia Type") +
  theme_void(base_size = 12, base_family = "serif") +
  theme(legend.position = "right")
ggsave(file.path(fig_dir, "fig_hernia_type_distribution.pdf"), p2, width = 7, height = 5, dpi = 300)
cat("Figure 2: Hernia type distribution saved\n")

# --- Figure 3: Surgical Approach by Hernia Type ---
p3 <- ggplot(df, aes(x = Hernia_Type, fill = Surgical_Approach)) +
  geom_bar(position = "fill", colour = "black", linewidth = 0.3) +
  scale_fill_manual(values = c("Open" = "#4472C4", "Laparoscopic" = "#70AD47")) +
  scale_y_continuous(labels = percent_format()) +
  labs(x = "Hernia Type", y = "Proportion", fill = "Surgical Approach") +
  theme_thesis +
  theme(axis.text.x = element_text(angle = 30, hjust = 1))
ggsave(file.path(fig_dir, "fig_approach_by_type.pdf"), p3, width = 7, height = 5, dpi = 300)
cat("Figure 3: Surgical approach by hernia type saved\n")

# --- Figure 4: Hospital Stay Comparison ---
p4 <- ggplot(df, aes(x = Surgical_Approach, y = Hospital_Stay_Days, fill = Surgical_Approach)) +
  geom_boxplot(outlier.shape = 21, width = 0.5) +
  scale_fill_manual(values = c("Open" = "#4472C4", "Laparoscopic" = "#70AD47")) +
  labs(x = "Surgical Approach", y = "Hospital Stay (days)") +
  theme_thesis +
  theme(legend.position = "none")
ggsave(file.path(fig_dir, "fig_hospital_stay_comparison.pdf"), p4, width = 5, height = 5, dpi = 300)
cat("Figure 4: Hospital stay comparison saved\n")

# --- Figure 5: BMI Category Distribution ---
p5 <- ggplot(df, aes(x = BMI_Category, fill = BMI_Category)) +
  geom_bar(colour = "black", linewidth = 0.3) +
  scale_fill_brewer(palette = "Pastel1") +
  geom_text(stat = "count", aes(label = after_stat(count)), vjust = -0.5) +
  labs(x = "BMI Category", y = "Number of Patients") +
  theme_thesis +
  theme(legend.position = "none")
ggsave(file.path(fig_dir, "fig_bmi_distribution.pdf"), p5, width = 6, height = 5, dpi = 300)
cat("Figure 5: BMI distribution saved\n")

# --- Figure 6: Comorbidities ---
comor_data <- data.frame(
  Comorbidity = c("Diabetes", "Hypertension", "Smoking", "Obesity\n(BMI>=30)", "Multiparity"),
  Count = c(sum(df$Diabetes == "Yes"), sum(df$Hypertension == "Yes"),
            sum(df$Smoking == "Yes"), sum(df$BMI >= 30),
            sum(df$Multiparity == "Yes", na.rm = TRUE)),
  Total = c(nrow(df), nrow(df), nrow(df), nrow(df), sum(df$Sex == "Female"))
)
comor_data$Pct <- round(100 * comor_data$Count / comor_data$Total, 1)

p6 <- ggplot(comor_data, aes(x = reorder(Comorbidity, -Pct), y = Pct, fill = Comorbidity)) +
  geom_bar(stat = "identity", colour = "black", linewidth = 0.3) +
  geom_text(aes(label = paste0(Count, " (", Pct, "%)")), vjust = -0.5, size = 3.5) +
  scale_fill_brewer(palette = "Set3") +
  labs(x = "Risk Factor / Comorbidity", y = "Percentage (%)") +
  ylim(0, max(comor_data$Pct) + 10) +
  theme_thesis +
  theme(legend.position = "none")
ggsave(file.path(fig_dir, "fig_comorbidities.pdf"), p6, width = 7, height = 5, dpi = 300)
cat("Figure 6: Comorbidities saved\n")

# --- Figure 7: Postoperative Complications ---
comp_data <- df %>% filter(Postop_Complications != "None") %>%
  count(Postop_Complications) %>%
  mutate(pct = round(100*n/nrow(df), 1))

p7 <- ggplot(comp_data, aes(x = reorder(Postop_Complications, -n), y = n, fill = Postop_Complications)) +
  geom_bar(stat = "identity", colour = "black", linewidth = 0.3) +
  geom_text(aes(label = paste0(n, " (", pct, "%)")), vjust = -0.5, size = 3.5) +
  scale_fill_brewer(palette = "Pastel2") +
  labs(x = "Complication", y = "Number of Patients") +
  theme_thesis +
  theme(legend.position = "none", axis.text.x = element_text(angle = 30, hjust = 1))
ggsave(file.path(fig_dir, "fig_complications.pdf"), p7, width = 7, height = 5, dpi = 300)
cat("Figure 7: Postoperative complications saved\n")

cat("\n=== ALL ANALYSES COMPLETE ===\n")
