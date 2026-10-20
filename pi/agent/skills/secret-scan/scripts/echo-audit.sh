#!/usr/bin/env bash
# secret-scan: check whether a scrubbed value is really gone, or only gone from the places you looked.
# See "Layer 3 — the echo trap" in ../SKILL.md.
set -uo pipefail

usage() {
  cat <<'USAGE'
usage: echo-audit.sh <pattern> [rev]

Reports every file at <rev> (default HEAD) that still matches <pattern>, split into
non-test and test hits. A pattern that now matches only test files means the value
survives where the code under test can reproduce it at runtime.

  echo-audit.sh '10\.0\.0\.5'          # one address
  echo-audit.sh 'pool|node|host-' -    # alternation, all revisions up to HEAD
  echo-audit.sh 'arch' v1.2.0          # a tag

Exit status: 0 clean, 3 test-only, 4 non-test hits remain.
USAGE
}

pat="${1:-}"
[ -n "$pat" ] || { usage >&2; exit 64; }
case "$pat" in -h|--help) usage; exit 0 ;; esac
rev="${2:-HEAD}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "echo-audit: not inside a git work tree" >&2
  exit 64
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Two passes on purpose. The committed tree is what you are auditing, but the strings you
# just scrubbed live in the working tree and the index first, and a scrub that only reached
# code strings leaves the value in a regex literal the rev-based grep cannot see.
git grep -l -I -P "$pat" "$rev" -- . > "$tmp/files" 2>/dev/null ||
  git grep -l -I -F "$pat" "$rev" -- . >> "$tmp/files" 2>/dev/null || true
git grep -l -I -P "$pat" -- . >> "$tmp/files" 2>/dev/null ||
  git grep -l -I -F "$pat" -- . >> "$tmp/files" 2>/dev/null || true
git diff --cached --name-only --diff-filter=ACMR 2>/dev/null |
  while IFS= read -r f; do
    grep -q -I -P "$pat" -- "$f" 2>/dev/null && printf '%s\n' "$f"
  done >> "$tmp/files" || true
sort -u "$tmp/files" -o "$tmp/files"
files=$(wc -l < "$tmp/files" | tr -d ' ')
if [ "$files" -eq 0 ]; then
  echo "OK: no match for /$pat/ (rev $rev, working tree, or index)"
  exit 0
fi

TEST_FILE_RE='\.(test|spec)\.|_test\.|/tests?/|/__tests__/|/testdata/|/fixtures?/'
# The scrubbed value usually starts life inside a regex literal, where `.` is escaped.
# Matching the raw pattern only would report "gone" while the escaped form sits there.
escaped=$(printf '%s' "$pat" | sed 's/\\/\\\\/g; s/\./\\./g')
non_test=0
test_only=0
printed=0
while IFS= read -r file; do
  [ -n "$file" ] || continue
  if [[ "$file" =~ $TEST_FILE_RE ]]; then
    test_only=$((test_only + 1))
    continue
  fi
  non_test=$((non_test + 1))
  echo "STILL PRESENT: $file"
  git grep -n -I -E "$escaped" -- "$file" 2>/dev/null | sed 's/^/    /'
  printed=$((printed + 1))
done < "$tmp/files"

echo
echo "/$pat/ at $rev: $files file(s) match — $non_test outside test files, $test_only in test files"

if [ "$non_test" -gt 0 ]; then
  echo
  echo "Not done: the value is still in the tree. Fix these before moving on."
  exit 4
fi

cat <<'ECHO'
Every remaining match is inside a test file. That is the echo trap, not a clean scan:

  the code under test can generate the value at runtime — a migration error that echoes
  the caller's own input back, an error message built with JSON.stringify, a formatted
  log line — so an assertion in the test re-introduces it after the fixture was scrubbed.

Next, in this order:
  1. run the test suite; a test that now fails is the code under test telling you where
     the value is generated
  2. read the code under test for every string it interpolates from its input
  3. re-run this audit with the placeholder you actually intend to keep
ECHO
exit 3
