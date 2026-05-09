#!/usr/bin/env sh
set -eu

PLAN_DIR="${PWD}/.pi/planning"
PLAN_FILE="${PLAN_DIR}/task_plan.md"
ATTESTATION_FILE="${PLAN_DIR}/.attestation"

compute_hash() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | awk '{print $1}'
    else
        echo "ERROR: no sha256 utility available" >&2
        return 1
    fi
}

mode="attest"
case "${1:-}" in
    --show) mode="show" ;;
    --clear) mode="clear" ;;
    "") mode="attest" ;;
    *)
        echo "Usage: $0 [--show|--clear]" >&2
        exit 2
        ;;
esac

if [ ! -f "$PLAN_FILE" ]; then
    echo "[plan-attest] No task_plan.md found at $PLAN_FILE" >&2
    exit 1
fi

case "$mode" in
    show)
        if [ -f "$ATTESTATION_FILE" ]; then
            echo "Plan: $PLAN_FILE"
            echo "Attestation: $ATTESTATION_FILE"
            echo "SHA-256: $(cat "$ATTESTATION_FILE")"
        else
            echo "[plan-attest] No attestation set."
            exit 1
        fi
        ;;
    clear)
        if [ -f "$ATTESTATION_FILE" ]; then
            rm -f "$ATTESTATION_FILE"
            echo "[plan-attest] Cleared attestation for $PLAN_FILE"
        else
            echo "[plan-attest] No attestation to clear."
        fi
        ;;
    attest)
        mkdir -p "$PLAN_DIR"
        HASH=$(compute_hash "$PLAN_FILE")
        printf '%s\n' "$HASH" > "$ATTESTATION_FILE"
        SHORT=$(printf '%s' "$HASH" | cut -c1-12)
        echo "[plan-attest] Locked $PLAN_FILE"
        echo "[plan-attest] SHA-256: ${SHORT}..."
        ;;
esac
