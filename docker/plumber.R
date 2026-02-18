# Apollo R Plumber API — Sprint 7-8: Statistical Analysis Endpoints
# All analyses are pre-defined functions. No raw R code execution.

library(plumber)
library(jsonlite)
library(dplyr)
library(gtsummary)
library(ggplot2)
library(broom)
library(base64enc)
library(readr)

# ── Helper functions ──────────────────────────────────────────────────────────

#' Convert a data.frame to LaTeX table (publication-ready)
to_latex_table <- function(df, caption = "Results") {
  # Basic LaTeX table output
  header <- paste0("\\begin{table}[htbp]\n\\centering\n\\caption{", caption, "}\n")
  col_align <- paste(rep("l", ncol(df)), collapse = "")
  begin <- paste0("\\begin{tabular}{", col_align, "}\n\\hline\n")

  # Header row
  header_row <- paste(names(df), collapse = " & ")
  header_row <- paste0(header_row, " \\\\\n\\hline\n")

  # Data rows
  data_rows <- apply(df, 1, function(row) {
    paste(row, collapse = " & ")
  })
  data_section <- paste(data_rows, collapse = " \\\\\n")
  data_section <- paste0(data_section, " \\\\\n\\hline\n")

  end <- "\\end{tabular}\n\\end{table}"
  paste0(header, begin, header_row, data_section, end)
}

#' Save ggplot to temporary PDF, return base64
save_plot_base64 <- function(plot, filename = "plot.pdf", width = 7, height = 5) {
  filepath <- file.path(tempdir(), filename)
  ggsave(filepath, plot, width = width, height = height, dpi = 300, device = "pdf")
  encoded <- base64encode(filepath)
  unlink(filepath)
  list(filename = filename, base64 = encoded)
}

#' Parse incoming data safely
parse_data <- function(data) {
  df <- as.data.frame(data, stringsAsFactors = FALSE)
  # Auto-convert numeric columns
  for (col in names(df)) {
    numeric_vals <- suppressWarnings(as.numeric(df[[col]]))
    if (sum(!is.na(numeric_vals)) / max(sum(!is.na(df[[col]])), 1) > 0.8) {
      df[[col]] <- numeric_vals
    }
  }
  df
}

#' Apply colour scheme to a ggplot
apply_colour_scheme <- function(plot, colour_scheme = "default") {
  if (is.null(colour_scheme) || colour_scheme == "default") {
    return(plot)
  }
  if (colour_scheme == "greyscale") {
    return(plot + scale_fill_grey() + scale_colour_grey() + theme_minimal())
  }
  if (colour_scheme == "colourblind-safe") {
    cb_palette <- c("#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7", "#999999")
    return(plot + scale_fill_manual(values = cb_palette) + scale_colour_manual(values = cb_palette))
  }
  plot
}

# ── Authentication filter ─────────────────────────────────────────────────────

#* @plumber
function(pr) {
  secret <- Sys.getenv("R_PLUMBER_SECRET", "")
  if (nzchar(secret)) {
    pr %>% plumber::pr_filter("auth", function(req, res) {
      # Allow health check without auth for Docker healthcheck
      if (req$PATH_INFO == "/health") {
        return(plumber::forward())
      }
      auth_header <- req$HTTP_AUTHORIZATION
      if (is.null(auth_header) || auth_header != paste0("Bearer ", secret)) {
        res$status <- 401L
        return(list(error = "Unauthorised"))
      }
      plumber::forward()
    })
  }
}

# ── Health check ──────────────────────────────────────────────────────────────

#* Health check
#* @get /health
function() {
  list(
    status = "ok",
    service = "apollo-r-plumber",
    r_version = paste(R.version$major, R.version$minor, sep = "."),
    timestamp = Sys.time(),
    packages = list(
      survival = requireNamespace("survival", quietly = TRUE),
      pROC = requireNamespace("pROC", quietly = TRUE),
      meta = requireNamespace("meta", quietly = TRUE)
    )
  )
}

# ── Descriptive Statistics ────────────────────────────────────────────────────

#* Descriptive statistics using gtsummary
#* @post /descriptive
#* @serializer unboxedJSON
function(req) {
  tryCatch({
    setTimeLimit(cpu = 15, elapsed = 15, transient = TRUE)
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE)
    body <- req$body
    df <- parse_data(body$data)
    group_col <- body$group

    if (!is.null(group_col) && group_col %in% names(df)) {
      tbl <- tbl_summary(df, by = all_of(group_col),
                         missing = "ifany",
                         statistic = list(
                           all_continuous() ~ "{mean} ({sd})",
                           all_categorical() ~ "{n} ({p}%)"
                         )) %>%
        add_p() %>%
        add_overall()
    } else {
      tbl <- tbl_summary(df,
                         missing = "ifany",
                         statistic = list(
                           all_continuous() ~ "{mean} ({sd})",
                           all_categorical() ~ "{n} ({p}%)"
                         ))
    }

    # Extract as data frame for JSON
    tbl_df <- as_tibble(tbl)

    # Generate LaTeX table
    latex_tbl <- to_latex_table(tbl_df, "Descriptive Statistics")

    # Generate R script for reproducibility
    r_script <- paste0(
      "library(gtsummary)\n",
      "# Descriptive statistics\n",
      if (!is.null(group_col)) paste0("tbl_summary(data, by = \"", group_col, "\") %>% add_p() %>% add_overall()\n")
      else "tbl_summary(data)\n"
    )

    list(
      summary = tbl_df,
      table_latex = latex_tbl,
      figures = list(),
      warnings = list(),
      r_script = r_script
    )
  }, error = function(e) {
    list(error = e$message)
  })
}

# ── Chi-Square / Fisher's Test ────────────────────────────────────────────────

#* Chi-square or Fisher's exact test (auto-selected by cell count)
#* @post /chi-square
#* @serializer unboxedJSON
function(req) {
  tryCatch({
    setTimeLimit(cpu = 30, elapsed = 30, transient = TRUE)
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE)
    body <- req$body
    df <- parse_data(body$data)
    outcome <- body$outcome
    predictor <- body$predictor

    if (is.null(outcome) || is.null(predictor)) {
      return(list(error = "outcome and predictor columns required"))
    }

    tbl <- table(df[[predictor]], df[[outcome]])

    # Auto-select: Fisher's if any expected cell count < 5
    expected <- chisq.test(tbl)$expected
    use_fisher <- any(expected < 5)

    if (use_fisher) {
      test_result <- fisher.test(tbl, simulate.p.value = (nrow(tbl) > 2 || ncol(tbl) > 2))
      test_name <- "Fisher's Exact Test"
    } else {
      test_result <- chisq.test(tbl)
      test_name <- "Chi-Square Test"
    }

    # Create plot — chart_type override (default: bar)
    chart_type <- ifelse(is.null(body$chart_type), "bar", body$chart_type)
    colour_scheme <- ifelse(is.null(body$colour_scheme), "default", body$colour_scheme)

    plot_df <- as.data.frame(tbl)
    names(plot_df) <- c("Predictor", "Outcome", "Count")

    if (chart_type == "heatmap") {
      p <- ggplot(plot_df, aes(x = Predictor, y = Outcome, fill = Count)) +
        geom_tile() + scale_fill_gradient(low = "white", high = "steelblue") +
        theme_minimal() + labs(title = test_name)
    } else {
      p <- ggplot(plot_df, aes(x = Predictor, y = Count, fill = Outcome)) +
        geom_bar(stat = "identity", position = "dodge") +
        theme_minimal() +
        labs(title = test_name, x = predictor, y = "Count", fill = outcome)
    }
    p <- apply_colour_scheme(p, colour_scheme)

    fig <- save_plot_base64(p, "chi_square_plot.pdf")

    summary_df <- data.frame(
      Test = test_name,
      P_Value = format.pval(test_result$p.value, digits = 4),
      stringsAsFactors = FALSE
    )

    r_script <- paste0(
      "# ", test_name, "\n",
      "tbl <- table(data$", predictor, ", data$", outcome, ")\n",
      if (use_fisher) "fisher.test(tbl)\n" else "chisq.test(tbl)\n"
    )

    list(
      summary = list(
        test = test_name,
        p_value = test_result$p.value,
        contingency_table = as.data.frame.matrix(tbl),
        method = test_result$method
      ),
      table_latex = to_latex_table(summary_df, test_name),
      figures = list(fig),
      warnings = list(),
      r_script = r_script
    )
  }, error = function(e) {
    list(error = e$message)
  })
}

# ── T-Test / Wilcoxon ────────────────────────────────────────────────────────

#* T-test or Wilcoxon test (auto-selected by Shapiro-Wilk normality)
#* @post /t-test
#* @serializer unboxedJSON
function(req) {
  tryCatch({
    setTimeLimit(cpu = 30, elapsed = 30, transient = TRUE)
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE)
    body <- req$body
    df <- parse_data(body$data)
    outcome <- body$outcome
    group <- body$group
    confidence_level <- ifelse(is.null(body$confidence_level), 0.95, body$confidence_level)

    if (is.null(outcome) || is.null(group)) {
      return(list(error = "outcome and group columns required"))
    }

    outcome_vals <- as.numeric(df[[outcome]])
    group_vals <- df[[group]]
    groups <- unique(na.omit(group_vals))

    if (length(groups) != 2) {
      return(list(error = "Group column must have exactly 2 levels for t-test"))
    }

    g1 <- outcome_vals[group_vals == groups[1]]
    g2 <- outcome_vals[group_vals == groups[2]]

    # Normality test
    normal_g1 <- tryCatch(shapiro.test(na.omit(g1))$p.value > 0.05, error = function(e) FALSE)
    normal_g2 <- tryCatch(shapiro.test(na.omit(g2))$p.value > 0.05, error = function(e) FALSE)
    is_normal <- normal_g1 && normal_g2

    if (is_normal) {
      test_result <- t.test(g1, g2, conf.level = confidence_level)
      test_name <- "Independent Samples T-Test"
    } else {
      test_result <- wilcox.test(g1, g2, conf.int = TRUE, conf.level = confidence_level)
      test_name <- "Wilcoxon Rank-Sum Test"
    }

    # Plot — chart_type override (default: box)
    chart_type <- ifelse(is.null(body$chart_type), "box", body$chart_type)
    colour_scheme <- ifelse(is.null(body$colour_scheme), "default", body$colour_scheme)

    plot_df <- data.frame(
      Value = outcome_vals,
      Group = group_vals,
      stringsAsFactors = FALSE
    ) %>% filter(!is.na(Value), !is.na(Group))

    p <- ggplot(plot_df, aes(x = Group, y = Value, fill = Group))
    if (chart_type == "violin") {
      p <- p + geom_violin(alpha = 0.7) + geom_boxplot(width = 0.1, alpha = 0.5)
    } else if (chart_type == "bar") {
      p <- ggplot(plot_df, aes(x = Group, y = Value, fill = Group)) +
        stat_summary(fun = mean, geom = "bar", alpha = 0.7) +
        stat_summary(fun.data = mean_se, geom = "errorbar", width = 0.2)
    } else {
      p <- p + geom_boxplot(alpha = 0.7)
    }
    p <- p + theme_minimal() +
      labs(title = test_name, x = group, y = outcome) +
      theme(legend.position = "none")
    p <- apply_colour_scheme(p, colour_scheme)

    fig <- save_plot_base64(p, "t_test_plot.pdf")

    r_script <- paste0(
      "# ", test_name, "\n",
      if (is_normal)
        paste0("t.test(", outcome, " ~ ", group, ", data = data, conf.level = ", confidence_level, ")\n")
      else
        paste0("wilcox.test(", outcome, " ~ ", group, ", data = data, conf.int = TRUE)\n")
    )

    list(
      summary = list(
        test = test_name,
        p_value = test_result$p.value,
        statistic = unname(test_result$statistic),
        confidence_interval = if (!is.null(test_result$conf.int)) as.numeric(test_result$conf.int) else NULL,
        method = test_result$method,
        normality = list(group1_normal = normal_g1, group2_normal = normal_g2)
      ),
      table_latex = to_latex_table(
        data.frame(Test = test_name, Statistic = round(unname(test_result$statistic), 3),
                   P_Value = format.pval(test_result$p.value, digits = 4)),
        test_name
      ),
      figures = list(fig),
      warnings = if (!is_normal) list("Non-normal distribution detected; Wilcoxon test used instead of t-test") else list(),
      r_script = r_script
    )
  }, error = function(e) {
    list(error = e$message)
  })
}

# ── Correlation ───────────────────────────────────────────────────────────────

#* Pearson or Spearman correlation (auto-selected by normality)
#* @post /correlation
#* @serializer unboxedJSON
function(req) {
  tryCatch({
    setTimeLimit(cpu = 30, elapsed = 30, transient = TRUE)
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE)
    body <- req$body
    df <- parse_data(body$data)
    outcome <- body$outcome
    predictor <- body$predictor

    if (is.null(outcome) || is.null(predictor)) {
      return(list(error = "outcome and predictor columns required"))
    }

    x <- as.numeric(df[[predictor]])
    y <- as.numeric(df[[outcome]])
    complete <- complete.cases(x, y)
    x <- x[complete]
    y <- y[complete]

    # Normality check
    normal_x <- tryCatch(shapiro.test(x)$p.value > 0.05, error = function(e) FALSE)
    normal_y <- tryCatch(shapiro.test(y)$p.value > 0.05, error = function(e) FALSE)
    method <- if (normal_x && normal_y) "pearson" else "spearman"

    test_result <- cor.test(x, y, method = method)

    # Scatter plot
    plot_df <- data.frame(X = x, Y = y)
    p <- ggplot(plot_df, aes(x = X, y = Y)) +
      geom_point(alpha = 0.6) +
      geom_smooth(method = if (method == "pearson") "lm" else "loess", se = TRUE) +
      theme_minimal() +
      labs(title = paste0(tools::toTitleCase(method), " Correlation"),
           x = predictor, y = outcome,
           subtitle = paste0("r = ", round(test_result$estimate, 3),
                           ", p = ", format.pval(test_result$p.value, digits = 4)))

    fig <- save_plot_base64(p, "correlation_plot.pdf")

    list(
      summary = list(
        method = method,
        r = unname(test_result$estimate),
        p_value = test_result$p.value,
        confidence_interval = if (!is.null(test_result$conf.int)) as.numeric(test_result$conf.int) else NULL,
        n = length(x)
      ),
      table_latex = to_latex_table(
        data.frame(Method = tools::toTitleCase(method),
                   r = round(unname(test_result$estimate), 3),
                   P_Value = format.pval(test_result$p.value, digits = 4),
                   N = length(x)),
        paste0(tools::toTitleCase(method), " Correlation")
      ),
      figures = list(fig),
      warnings = if (method == "spearman") list("Non-normal distribution; Spearman correlation used") else list(),
      r_script = paste0("cor.test(data$", predictor, ", data$", outcome, ", method = \"", method, "\")\n")
    )
  }, error = function(e) {
    list(error = e$message)
  })
}

# ── Survival Analysis (Kaplan-Meier) ──────────────────────────────────────────

#* Kaplan-Meier survival analysis
#* @post /survival
#* @serializer unboxedJSON
function(req) {
  tryCatch({
    setTimeLimit(cpu = 45, elapsed = 45, transient = TRUE)
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE)
    library(survival)
    library(survminer)

    body <- req$body
    df <- parse_data(body$data)
    time_col <- body$time
    event_col <- body$event
    group_col <- body$group

    if (is.null(time_col) || is.null(event_col)) {
      return(list(error = "time and event columns required"))
    }

    df$surv_time <- as.numeric(df[[time_col]])
    df$surv_event <- as.numeric(df[[event_col]])

    if (!is.null(group_col) && group_col %in% names(df)) {
      formula <- Surv(surv_time, surv_event) ~ df[[group_col]]
      fit <- survfit(Surv(surv_time, surv_event) ~ df[[group_col]], data = df)
      log_rank <- survdiff(Surv(surv_time, surv_event) ~ df[[group_col]], data = df)
      log_rank_p <- 1 - pchisq(log_rank$chisq, length(log_rank$n) - 1)
    } else {
      fit <- survfit(Surv(surv_time, surv_event) ~ 1, data = df)
      log_rank_p <- NULL
    }

    # KM plot
    p <- ggsurvplot(fit, data = df,
                    risk.table = TRUE,
                    pval = !is.null(log_rank_p),
                    conf.int = TRUE,
                    ggtheme = theme_minimal(),
                    title = "Kaplan-Meier Survival Curve")

    # Save combined plot
    filepath <- file.path(tempdir(), "survival_plot.pdf")
    pdf(filepath, width = 8, height = 6)
    print(p)
    dev.off()
    encoded <- base64encode(filepath)
    unlink(filepath)
    fig <- list(filename = "survival_plot.pdf", base64 = encoded)

    # Summary
    surv_summary <- summary(fit)
    median_surv <- surv_median(fit)

    r_script <- paste0(
      "library(survival)\nlibrary(survminer)\n",
      "fit <- survfit(Surv(", time_col, ", ", event_col, ") ~ ",
      if (!is.null(group_col)) group_col else "1",
      ", data = data)\n",
      "ggsurvplot(fit, data = data, risk.table = TRUE, pval = TRUE)\n"
    )

    list(
      summary = list(
        median_survival = as.data.frame(median_surv),
        log_rank_p = log_rank_p,
        n = fit$n,
        events = sum(df$surv_event, na.rm = TRUE)
      ),
      table_latex = to_latex_table(as.data.frame(median_surv), "Kaplan-Meier Survival Analysis"),
      figures = list(fig),
      warnings = list(),
      r_script = r_script
    )
  }, error = function(e) {
    list(error = e$message)
  })
}

# ── ROC Analysis ──────────────────────────────────────────────────────────────

#* ROC curve analysis
#* @post /roc
#* @serializer unboxedJSON
function(req) {
  tryCatch({
    setTimeLimit(cpu = 45, elapsed = 45, transient = TRUE)
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE)
    library(pROC)

    body <- req$body
    df <- parse_data(body$data)
    outcome <- body$outcome
    predictor <- body$predictor

    if (is.null(outcome) || is.null(predictor)) {
      return(list(error = "outcome and predictor columns required"))
    }

    roc_obj <- roc(df[[outcome]], as.numeric(df[[predictor]]), quiet = TRUE)
    auc_val <- auc(roc_obj)
    ci_auc <- ci.auc(roc_obj)

    # Optimal cutoff (Youden's index)
    coords_best <- coords(roc_obj, "best", ret = c("threshold", "sensitivity", "specificity"))

    # ROC plot
    p <- ggroc(roc_obj) +
      theme_minimal() +
      labs(title = paste0("ROC Curve (AUC = ", round(as.numeric(auc_val), 3), ")"),
           x = "Specificity", y = "Sensitivity") +
      annotate("segment", x = 1, xend = 0, y = 0, yend = 1, linetype = "dashed", colour = "grey50")

    fig <- save_plot_base64(p, "roc_plot.pdf")

    r_script <- paste0(
      "library(pROC)\n",
      "roc_obj <- roc(data$", outcome, ", data$", predictor, ")\n",
      "ggroc(roc_obj)\n",
      "coords(roc_obj, \"best\")\n"
    )

    list(
      summary = list(
        auc = as.numeric(auc_val),
        auc_ci = as.numeric(ci_auc),
        optimal_cutoff = as.data.frame(coords_best)
      ),
      table_latex = to_latex_table(
        data.frame(AUC = round(as.numeric(auc_val), 3),
                   CI_Lower = round(as.numeric(ci_auc)[1], 3),
                   CI_Upper = round(as.numeric(ci_auc)[3], 3),
                   Threshold = round(coords_best$threshold, 3),
                   Sensitivity = round(coords_best$sensitivity, 3),
                   Specificity = round(coords_best$specificity, 3)),
        "ROC Analysis"
      ),
      figures = list(fig),
      warnings = list(),
      r_script = r_script
    )
  }, error = function(e) {
    list(error = e$message)
  })
}

# ── Logistic Regression ───────────────────────────────────────────────────────

#* Logistic regression with forest plot
#* @post /logistic
#* @serializer unboxedJSON
function(req) {
  tryCatch({
    setTimeLimit(cpu = 45, elapsed = 45, transient = TRUE)
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE)
    body <- req$body
    df <- parse_data(body$data)
    outcome <- body$outcome
    predictor <- body$predictor
    confidence_level <- ifelse(is.null(body$confidence_level), 0.95, body$confidence_level)

    if (is.null(outcome)) {
      return(list(error = "outcome column required"))
    }

    # Build formula — use all predictors if none specified
    if (!is.null(predictor) && predictor != "") {
      predictors <- strsplit(predictor, ",")[[1]]
      formula_str <- paste0(outcome, " ~ ", paste(trimws(predictors), collapse = " + "))
    } else {
      other_cols <- setdiff(names(df), outcome)
      formula_str <- paste0(outcome, " ~ ", paste(other_cols, collapse = " + "))
    }

    model <- glm(as.formula(formula_str), data = df, family = binomial)
    model_tidy <- tidy(model, conf.int = TRUE, conf.level = confidence_level, exponentiate = TRUE)

    # Forest plot (OR with CI)
    plot_data <- model_tidy %>% filter(term != "(Intercept)")
    if (nrow(plot_data) > 0) {
      p <- ggplot(plot_data, aes(x = estimate, y = term)) +
        geom_point(size = 3) +
        geom_errorbarh(aes(xmin = conf.low, xmax = conf.high), height = 0.2) +
        geom_vline(xintercept = 1, linetype = "dashed", colour = "grey50") +
        theme_minimal() +
        labs(title = "Logistic Regression — Odds Ratios", x = "Odds Ratio (95% CI)", y = "") +
        scale_x_log10()

      fig <- save_plot_base64(p, "logistic_forest.pdf")
    } else {
      fig <- NULL
    }

    # Model summary
    model_glance <- glance(model)

    r_script <- paste0(
      "model <- glm(", formula_str, ", data = data, family = binomial)\n",
      "broom::tidy(model, conf.int = TRUE, exponentiate = TRUE)\n"
    )

    list(
      summary = list(
        coefficients = model_tidy,
        model_fit = model_glance,
        formula = formula_str
      ),
      table_latex = to_latex_table(
        model_tidy %>%
          mutate(across(where(is.numeric), ~ round(.x, 3))) %>%
          as.data.frame(),
        "Logistic Regression Results"
      ),
      figures = if (!is.null(fig)) list(fig) else list(),
      warnings = list(),
      r_script = r_script
    )
  }, error = function(e) {
    list(error = e$message)
  })
}

# ── Kruskal-Wallis Test ───────────────────────────────────────────────────────

#* Kruskal-Wallis test with Dunn's post-hoc
#* @post /kruskal
#* @serializer unboxedJSON
function(req) {
  tryCatch({
    setTimeLimit(cpu = 30, elapsed = 30, transient = TRUE)
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE)
    body <- req$body
    df <- parse_data(body$data)
    outcome <- body$outcome
    group <- body$group

    if (is.null(outcome) || is.null(group)) {
      return(list(error = "outcome and group columns required"))
    }

    outcome_vals <- as.numeric(df[[outcome]])
    group_vals <- as.factor(df[[group]])

    kw_result <- kruskal.test(outcome_vals ~ group_vals)

    # Post-hoc Dunn's test (using pairwise.wilcox.test as base R alternative)
    posthoc <- pairwise.wilcox.test(outcome_vals, group_vals, p.adjust.method = "bonferroni")

    # Box plot
    plot_df <- data.frame(Value = outcome_vals, Group = group_vals) %>%
      filter(!is.na(Value), !is.na(Group))

    p <- ggplot(plot_df, aes(x = Group, y = Value, fill = Group)) +
      geom_boxplot(alpha = 0.7) +
      theme_minimal() +
      labs(title = paste0("Kruskal-Wallis Test (p = ", format.pval(kw_result$p.value, digits = 4), ")"),
           x = group, y = outcome) +
      theme(legend.position = "none")

    fig <- save_plot_base64(p, "kruskal_plot.pdf")

    r_script <- paste0(
      "kruskal.test(", outcome, " ~ ", group, ", data = data)\n",
      "pairwise.wilcox.test(data$", outcome, ", data$", group, ", p.adjust.method = \"bonferroni\")\n"
    )

    list(
      summary = list(
        test = "Kruskal-Wallis Rank Sum Test",
        statistic = unname(kw_result$statistic),
        df = unname(kw_result$parameter),
        p_value = kw_result$p.value,
        posthoc_p_values = as.data.frame(posthoc$p.value)
      ),
      table_latex = to_latex_table(
        data.frame(Test = "Kruskal-Wallis",
                   H = round(unname(kw_result$statistic), 3),
                   df = unname(kw_result$parameter),
                   P_Value = format.pval(kw_result$p.value, digits = 4)),
        "Kruskal-Wallis Test"
      ),
      figures = list(fig),
      warnings = list(),
      r_script = r_script
    )
  }, error = function(e) {
    list(error = e$message)
  })
}

# ── Meta-Analysis ─────────────────────────────────────────────────────────────

#* Meta-analysis using metagen
#* @post /meta-analysis
#* @serializer unboxedJSON
function(req) {
  tryCatch({
    setTimeLimit(cpu = 60, elapsed = 60, transient = TRUE)
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE), add = TRUE)
    library(meta)

    body <- req$body
    df <- parse_data(body$data)

    # Expected columns: study, effect_size (TE), se (seTE)
    required <- c("study", "effect_size", "se")
    missing <- setdiff(required, names(df))
    if (length(missing) > 0) {
      return(list(error = paste("Missing required columns:", paste(missing, collapse = ", "),
                                ". Provide: study, effect_size, se")))
    }

    ma <- metagen(
      TE = as.numeric(df$effect_size),
      seTE = as.numeric(df$se),
      studlab = df$study,
      sm = "MD",
      random = TRUE,
      fixed = TRUE
    )

    # Forest plot
    filepath_forest <- file.path(tempdir(), "forest_plot.pdf")
    pdf(filepath_forest, width = 10, height = max(4, nrow(df) * 0.4 + 2))
    forest(ma, sortvar = TE, print.tau2 = TRUE)
    dev.off()
    fig_forest <- list(filename = "forest_plot.pdf", base64 = base64encode(filepath_forest))
    unlink(filepath_forest)

    # Funnel plot
    filepath_funnel <- file.path(tempdir(), "funnel_plot.pdf")
    pdf(filepath_funnel, width = 7, height = 5)
    funnel(ma)
    dev.off()
    fig_funnel <- list(filename = "funnel_plot.pdf", base64 = base64encode(filepath_funnel))
    unlink(filepath_funnel)

    r_script <- paste0(
      "library(meta)\n",
      "ma <- metagen(TE = data$effect_size, seTE = data$se, studlab = data$study)\n",
      "forest(ma)\nfunnel(ma)\n"
    )

    list(
      summary = list(
        fixed_effect = list(estimate = ma$TE.fixed, ci = c(ma$lower.fixed, ma$upper.fixed), p = ma$pval.fixed),
        random_effect = list(estimate = ma$TE.random, ci = c(ma$lower.random, ma$upper.random), p = ma$pval.random),
        heterogeneity = list(I2 = ma$I2, tau2 = ma$tau2, Q = ma$Q, Q_p = ma$pval.Q),
        k = ma$k
      ),
      table_latex = to_latex_table(
        data.frame(
          Model = c("Fixed", "Random"),
          Estimate = round(c(ma$TE.fixed, ma$TE.random), 3),
          CI_Lower = round(c(ma$lower.fixed, ma$lower.random), 3),
          CI_Upper = round(c(ma$upper.fixed, ma$upper.random), 3),
          P_Value = c(format.pval(ma$pval.fixed, digits = 4), format.pval(ma$pval.random, digits = 4))
        ),
        "Meta-Analysis Results"
      ),
      figures = list(fig_forest, fig_funnel),
      warnings = if (ma$I2 > 75) list("High heterogeneity (I² > 75%). Consider exploring sources of heterogeneity.") else list(),
      r_script = r_script
    )
  }, error = function(e) {
    list(error = e$message)
  })
}
