#!/usr/bin/env bash
# secret-scan calibration: prove the rules still fire, and only on the fixture.
#
# The fixture lives in the repo, so the tree scan allowlists its path. Calibration
# therefore runs on a copy outside the repo, where the path allowlist does not
# apply and the invented values must be found again.
#
# Expected (see refs/secret-scan-fixture/README.md):
#   trips.md  every line fires
#   quiet.md  nothing fires
#   edges.md  exactly the lines marked "finding"
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture="$repo_root/refs/secret-scan-fixture"
config="$repo_root/.gitleaks.toml"
gitleaks_bin="${GITLEAKS:-gitleaks}"

if ! command -v "$gitleaks_bin" >/dev/null 2>&1; then
	echo "secret-scan: gitleaks is not installed — refusing to report \"clean\"." >&2
	echo "  mise use -g aqua:gitleaks/gitleaks   # any platform with mise" >&2
	echo "  go install github.com/zricethezav/gitleaks/v8@latest" >&2
	exit 2
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp "$fixture"/*.md "$work"/
cp "$config" "$work"/

(cd "$work" && "$gitleaks_bin" dir . --config "$work/.gitleaks.toml" --no-banner \
	--report-format json --report-path "$work/report.json" >/dev/null 2>&1) || true

report="$work/report.json"
[ -f "$report" ] || { echo "secret-scan: calibration produced no report" >&2; exit 1; }

expected_trips="$(seq 1 8 | tr '\n' ' ' | sed 's/ $//')"
expected_edges="1 2"

got_trips="$(jq -r '.[] | select(.File | endswith("trips.md")) | .StartLine' "$report" | sort -n | tr '\n' ' ' | sed 's/ $//')"
got_quiet="$(jq -r '.[] | select(.File | endswith("quiet.md")) | .StartLine' "$report" | tr '\n' ' ' | sed 's/ $//')"
got_edges="$(jq -r '.[] | select(.File | endswith("edges.md")) | .StartLine' "$report" | sort -n | tr '\n' ' ' | sed 's/ $//')"

status=0
if [ "$got_trips" != "$expected_trips" ]; then
	echo "secret-scan: trips.md fired on [$got_trips], expected [$expected_trips]" >&2
	status=1
fi
if [ -n "$got_quiet" ]; then
	echo "secret-scan: quiet.md fired on [$got_quiet], expected nothing" >&2
	status=1
fi
if [ "$got_edges" != "$expected_edges" ]; then
	echo "secret-scan: edges.md fired on [$got_edges], expected [$expected_edges]" >&2
	status=1
fi

if [ "$status" -ne 0 ]; then
	exit 1
fi

echo "secret-scan: calibration ok (trips 8/8, quiet 0, edges 2)"
