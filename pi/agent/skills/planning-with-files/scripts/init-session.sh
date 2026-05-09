#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SKILL_ROOT=$(dirname "$SCRIPT_DIR")
TEMPLATE_DIR="$SKILL_ROOT/templates"
PLAN_DIR="${PWD}/.pi/planning"
DATE=$(date +%Y-%m-%d)
STAMP=$(date '+%Y-%m-%d %H:%M')

mkdir -p "$PLAN_DIR"

copy_or_fail() {
    src="$1"
    dest="$2"
    if [ ! -f "$src" ]; then
        echo "Missing template: $src" >&2
        exit 1
    fi
    cp "$src" "$dest"
}

copy_or_fail "$TEMPLATE_DIR/task_plan.md" "$PLAN_DIR/task_plan.md"
copy_or_fail "$TEMPLATE_DIR/findings.md" "$PLAN_DIR/findings.md"
copy_or_fail "$TEMPLATE_DIR/progress.md" "$PLAN_DIR/progress.md"

sed -i.bak "s/\[DATE\]/$DATE/g; s/\[timestamp\]/$STAMP/g" "$PLAN_DIR/progress.md" && rm -f "$PLAN_DIR/progress.md.bak"

printf '%s\n' "$PLAN_DIR/task_plan.md" "$PLAN_DIR/findings.md" "$PLAN_DIR/progress.md"
