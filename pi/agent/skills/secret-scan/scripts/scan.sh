#!/usr/bin/env bash
# secret-scan: one gitleaks invocation for every mode the skill documents.
# See ../SKILL.md. Exits non-zero on findings, on a missing scanner, or on a bad invocation.
set -euo pipefail

usage() {
  cat <<'USAGE'
usage: scan.sh <mode> [args]

modes
  staged              scan the index (what a pre-commit hook sees)
  head                scan the whole history reachable from HEAD
  range <base>        scan <base>..HEAD
  history <log-opts>  scan whatever `git log <log-opts>` selects
  dir [path]          scan a working tree without git history (default: .)
  stdin               scan text on stdin

env
  SECRET_SCAN_REPORT  write a JSON report to this path as well
  GITLEAKS            scanner binary to use (default: gitleaks)
USAGE
}

require_gitleaks() {
  local bin="${GITLEAKS:-gitleaks}"
  if ! command -v "$bin" >/dev/null 2>&1; then
    cat >&2 <<'MISSING'
secret-scan: gitleaks is not installed — refusing to report "clean".

Installing (pick one):
  pacman -S gitleaks                      # Arch
  brew install gitleaks                   # macOS
  mise use -g aqua:gitleaks/gitleaks      # any platform with mise
  go install github.com/gitleaks/gitleaks/v8@latest
  # or the release binary for your platform:
  # https://github.com/gitleaks/gitleaks/releases

A scan that silently skips is how real secrets ship.
MISSING
    exit 2
  fi
  printf '%s' "$bin"
}

run_scan() {
  local bin="$1"
  shift
  local args=(--no-banner --redact)
  # Directory mode resolves a bare relative path against the scanned directory, so the
  # `.gitleaks.toml` in the repo root is silently skipped unless the path is absolute.
  # Measured on 8.30.1: a plain token was found by `dir .` but not by `dir . -c .gitleaks.toml`
  # same tree, same rules, and only the second one is a scan.
  if [ -f .gitleaks.toml ]; then
    args+=(--config "$(pwd -P)/.gitleaks.toml")
  fi
  if [ -n "${SECRET_SCAN_REPORT:-}" ]; then
    args+=(--report-format json --report-path "$SECRET_SCAN_REPORT" --exit-code 1)
  fi
  local status=0
  "$bin" "$@" "${args[@]}" || status=$?
  if [ "$status" -eq 0 ]; then
    return 0
  fi
  if [ "$status" -eq 1 ]; then
    cat >&2 <<'FOUND'
secret-scan: findings above (values redacted; the JSON report, when enabled, holds them in full).

For each finding decide, do not just delete the line:
  1. was the value ever live?  if yes, rotate it — a rewrite does not un-publish it
  2. was it committed?  if yes, it is in history; see "Layer 4" in SKILL.md
  3. placeholder that trips a rule?  allowlist it with a reason in .gitleaks.toml
FOUND
  fi
  return "$status"
}

mode="${1:-}"
[ -n "$mode" ] || { usage >&2; exit 64; }
shift

bin="$(require_gitleaks)"
case "$mode" in
  staged)
    run_scan "$bin" git --staged
    ;;
  head)
    run_scan "$bin" git .
    ;;
  range)
    base="${1:?usage: scan.sh range <base>}"
    run_scan "$bin" git --log-opts="$base..HEAD" .
    ;;
  history)
    log_opts="${1:?usage: scan.sh history <log-opts>}"
    run_scan "$bin" git --log-opts="$log_opts" .
    ;;
  dir)
    run_scan "$bin" dir "${1:-.}"
    ;;
  stdin)
    run_scan "$bin" stdin
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "secret-scan: unknown mode '$mode'" >&2
    usage >&2
    exit 64
    ;;
esac
