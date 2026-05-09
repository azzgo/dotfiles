#!/usr/bin/env sh
set -eu

PLAN_FILE="${1:-${PWD}/.pi/planning/task_plan.md}"

if [ ! -f "$PLAN_FILE" ]; then
    echo "[planning-with-files] No task_plan.md found at $PLAN_FILE"
    exit 0
fi

TOTAL=$(grep -c "### Phase" "$PLAN_FILE" || true)
COMPLETE=$(grep -cF "**Status:** complete" "$PLAN_FILE" || true)
IN_PROGRESS=$(grep -cF "**Status:** in_progress" "$PLAN_FILE" || true)
PENDING=$(grep -cF "**Status:** pending" "$PLAN_FILE" || true)

: "${TOTAL:=0}"
: "${COMPLETE:=0}"
: "${IN_PROGRESS:=0}"
: "${PENDING:=0}"

if [ "$COMPLETE" -eq "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
    echo "[planning-with-files] All phases complete ($COMPLETE/$TOTAL)."
else
    echo "[planning-with-files] Task in progress ($COMPLETE/$TOTAL complete)."
    echo "[planning-with-files] In progress: $IN_PROGRESS"
    echo "[planning-with-files] Pending: $PENDING"
fi
