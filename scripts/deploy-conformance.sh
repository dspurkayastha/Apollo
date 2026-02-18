#!/usr/bin/env bash
# deploy-conformance.sh — VPS deploy-gate conformance checks
# Referenced by docs/governance/security-tests.md and release-gates.md
# Exit 1 on any FAIL. Prints [PASS]/[WARN]/[FAIL] per check.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0
WARN=0
FAIL=0

pass() { echo "[PASS] $1"; PASS=$((PASS + 1)); }
warn() { echo "[WARN] $1"; WARN=$((WARN + 1)); }
fail() { echo "[FAIL] $1"; FAIL=$((FAIL + 1)); }

echo "=== Apollo Deploy Conformance Checks ==="
echo ""

# ─── 1. LaTeX seccomp profile exists and is valid JSON ───
SECCOMP_LATEX="$REPO_ROOT/docker/seccomp-latex.json"
if [ -f "$SECCOMP_LATEX" ]; then
  if jq empty "$SECCOMP_LATEX" 2>/dev/null; then
    pass "LaTeX seccomp profile exists and is valid JSON"
  else
    fail "LaTeX seccomp profile is not valid JSON"
  fi
else
  fail "LaTeX seccomp profile not found at $SECCOMP_LATEX"
fi

# ─── 2. LaTeX test compilation with security flags ───
if command -v docker &>/dev/null && docker image inspect apollo-latex &>/dev/null; then
  TEST_DIR=$(mktemp -d)
  cat > "$TEST_DIR/main.tex" <<'LATEX'
\documentclass{article}
\begin{document}
Hello, Apollo conformance test.
\end{document}
LATEX

  DOCKER_ARGS=(
    run --rm
    --network=none --read-only
    --tmpfs /tmp:rw,size=512m
    --memory=1g --pids-limit=256
    --security-opt no-new-privileges:true
    --cap-drop=ALL --cap-add=DAC_OVERRIDE --cap-add=FOWNER
  )

  # Add seccomp profile if on Linux (not macOS)
  if [ "$(uname -s)" = "Linux" ] && [ -f "$SECCOMP_LATEX" ]; then
    DOCKER_ARGS+=(--security-opt "seccomp=$SECCOMP_LATEX")
  fi

  DOCKER_ARGS+=(-v "$TEST_DIR:/thesis" apollo-latex)

  if docker "${DOCKER_ARGS[@]}" 2>/dev/null; then
    pass "LaTeX test compilation succeeded with security flags"
  else
    fail "LaTeX test compilation failed with security flags"
  fi
  rm -rf "$TEST_DIR"
else
  warn "Docker or apollo-latex image not available — skipping compile test"
fi

# ─── 3. R Plumber seccomp profile exists and is valid JSON ───
SECCOMP_R="$REPO_ROOT/docker/seccomp-r.json"
if [ -f "$SECCOMP_R" ]; then
  if jq empty "$SECCOMP_R" 2>/dev/null; then
    pass "R Plumber seccomp profile exists and is valid JSON"
  else
    fail "R Plumber seccomp profile is not valid JSON"
  fi
else
  fail "R Plumber seccomp profile not found at $SECCOMP_R"
fi

# ─── 4. R Plumber container is running and healthy ───
if command -v docker &>/dev/null; then
  R_STATUS=$(docker inspect --format='{{.State.Health.Status}}' apollo-r-plumber 2>/dev/null || echo "not_found")
  if [ "$R_STATUS" = "healthy" ]; then
    pass "R Plumber container is healthy"
  elif [ "$R_STATUS" = "not_found" ]; then
    warn "R Plumber container not running — skipping health check"
  else
    fail "R Plumber container status: $R_STATUS (expected: healthy)"
  fi
else
  warn "Docker not available — skipping R Plumber health check"
fi

# ─── 5. R Plumber seccomp is NOT unconfined ───
if command -v docker &>/dev/null && docker inspect apollo-r-plumber &>/dev/null 2>&1; then
  SECCOMP_SETTING=$(docker inspect --format='{{range .HostConfig.SecurityOpt}}{{.}}{{"\n"}}{{end}}' apollo-r-plumber 2>/dev/null | grep seccomp || echo "")
  if echo "$SECCOMP_SETTING" | grep -q "unconfined"; then
    fail "R Plumber is running with seccomp:unconfined"
  elif [ -n "$SECCOMP_SETTING" ]; then
    pass "R Plumber seccomp is not unconfined"
  else
    warn "Could not determine R Plumber seccomp setting"
  fi
else
  warn "R Plumber container not available — skipping seccomp check"
fi

# ─── 6. Container security settings (network, read-only, memory) ───
if command -v docker &>/dev/null; then
  # 6a. LaTeX network isolation
  LATEX_NET=$(docker inspect --format='{{.HostConfig.NetworkMode}}' apollo-latex 2>/dev/null || echo "unknown")
  if [ "$LATEX_NET" = "none" ]; then
    pass "LaTeX container has network_mode=none"
  elif [ "$LATEX_NET" = "unknown" ]; then
    warn "LaTeX container not running — skipping network check"
  else
    fail "LaTeX container network mode is '$LATEX_NET' (expected: none)"
  fi

  # 6b. Read-only filesystem
  for CONTAINER in apollo-latex apollo-r-plumber; do
    RO=$(docker inspect --format='{{.HostConfig.ReadonlyRootfs}}' "$CONTAINER" 2>/dev/null || echo "unknown")
    if [ "$RO" = "true" ]; then
      pass "$CONTAINER has read-only root filesystem"
    elif [ "$RO" = "unknown" ]; then
      warn "$CONTAINER not running — skipping read-only check"
    else
      fail "$CONTAINER root filesystem is NOT read-only"
    fi
  done

  # 6c. Memory limits
  LATEX_MEM=$(docker inspect --format='{{.HostConfig.Memory}}' apollo-latex 2>/dev/null || echo "0")
  if [ "$LATEX_MEM" = "1073741824" ]; then
    pass "LaTeX container memory limit is 1GB"
  elif [ "$LATEX_MEM" = "0" ]; then
    warn "LaTeX container not running or no memory limit — skipping"
  else
    warn "LaTeX container memory limit is $LATEX_MEM bytes (expected: 1073741824)"
  fi
else
  warn "Docker not available — skipping container security checks"
fi

# ─── 7. AppArmor profile loaded (warn-only) ───
# AppArmor is Linux-only. Use docker-compose.prod.yml on VPS:
#   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
if [ "$(uname -s)" = "Linux" ] && command -v aa-status &>/dev/null; then
  if aa-status 2>/dev/null | grep -q "apollo-r-plumber"; then
    pass "AppArmor profile 'apollo-r-plumber' is loaded"
  else
    warn "AppArmor profile 'apollo-r-plumber' not loaded (load with: sudo apparmor_parser -r $REPO_ROOT/docker/apparmor-r-plumber)"
  fi
else
  warn "AppArmor not available on this system (macOS or missing aa-status)"
fi

# ─── 8. No system() calls in plumber.R ───
PLUMBER_R="$REPO_ROOT/docker/plumber.R"
if [ -f "$PLUMBER_R" ]; then
  if grep -qE 'system\s*\(|system2\s*\(' "$PLUMBER_R"; then
    fail "plumber.R contains system() or system2() calls — potential command injection"
  else
    pass "No system() calls in plumber.R"
  fi
else
  warn "plumber.R not found — skipping system() check"
fi

# ─── 9. No dangerous bind mounts ───
DANGEROUS_MOUNTS="/etc /home /root /proc /sys"
MOUNT_FAIL=0
if command -v docker &>/dev/null; then
  for CONTAINER in apollo-latex apollo-r-plumber; do
    MOUNTS=$(docker inspect --format='{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}' "$CONTAINER" 2>/dev/null || echo "")
    for DANGER in $DANGEROUS_MOUNTS; do
      if echo "$MOUNTS" | grep -q "$DANGER"; then
        fail "Container $CONTAINER has dangerous bind mount: $DANGER"
        MOUNT_FAIL=1
      fi
    done
  done
  if [ "$MOUNT_FAIL" -eq 0 ]; then
    pass "No dangerous bind mounts detected"
  fi
else
  warn "Docker not available — skipping bind mount check"
fi

# ─── 10. No API secrets leaked to compute containers ───
SECRET_LEAK=0
if command -v docker &>/dev/null; then
  for CONTAINER in apollo-latex apollo-r-plumber; do
    ENV_VARS=$(docker inspect --format='{{range .Config.Env}}{{.}} {{end}}' "$CONTAINER" 2>/dev/null || echo "")
    for SECRET_KEY in ANTHROPIC_API_KEY SUPABASE_SERVICE_ROLE_KEY CLERK_SECRET_KEY SENTRY_AUTH_TOKEN; do
      if echo "$ENV_VARS" | grep -q "$SECRET_KEY"; then
        fail "Container $CONTAINER has $SECRET_KEY in environment"
        SECRET_LEAK=1
      fi
    done
  done
  if [ "$SECRET_LEAK" -eq 0 ]; then
    pass "No API secrets leaked to compute containers"
  fi
else
  warn "Docker not available — skipping secret leak check"
fi

# ─── 11. SSL certificate validity ───
DOMAIN="${APOLLO_DOMAIN:-}"
if [ -n "$DOMAIN" ]; then
  EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$EXPIRY" ]; then
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -jf "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null || echo "0")
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
    if [ "$DAYS_LEFT" -lt 14 ]; then
      fail "SSL certificate expires in $DAYS_LEFT days (< 14 day threshold)"
    else
      pass "SSL certificate valid ($DAYS_LEFT days remaining)"
    fi
  else
    warn "Could not determine SSL expiry for $DOMAIN"
  fi
else
  warn "APOLLO_DOMAIN not set — skipping SSL check"
fi

# ─── 12. No unexpected open ports ───
if [ "$(uname -s)" = "Linux" ] && command -v ss &>/dev/null; then
  EXPECTED_PORTS="3000 8787 443 80 22"
  UNEXPECTED=$(ss -tlnp 2>/dev/null | awk 'NR>1 {print $4}' | grep -oE '[0-9]+$' | sort -u | while read -r PORT; do
    FOUND=0
    for EP in $EXPECTED_PORTS; do
      if [ "$PORT" = "$EP" ]; then FOUND=1; break; fi
    done
    if [ "$FOUND" -eq 0 ]; then echo "$PORT"; fi
  done)
  if [ -n "$UNEXPECTED" ]; then
    warn "Unexpected open ports detected: $UNEXPECTED"
  else
    pass "No unexpected open ports"
  fi
else
  warn "Port scan not available (macOS or missing ss) — skipping"
fi

# ─── Summary ───
echo ""
echo "=== Summary ==="
echo "PASS: $PASS  WARN: $WARN  FAIL: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Deploy gate FAILED — fix all FAIL items before deploying."
  exit 1
fi

if [ "$WARN" -gt 0 ]; then
  echo ""
  echo "Deploy gate PASSED with warnings — review WARN items."
  exit 0
fi

echo ""
echo "Deploy gate PASSED — all checks green."
exit 0
