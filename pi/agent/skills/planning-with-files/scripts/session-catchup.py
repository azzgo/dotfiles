#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import sys


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def extract(pattern: str, text: str) -> str | None:
    match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
    if not match:
        return None
    value = match.group(1).strip()
    return value.splitlines()[0].strip() if value else None


def tail_lines(text: str, count: int) -> str:
    lines = [line for line in text.splitlines() if line.strip()]
    return "\n".join(lines[-count:])


def main() -> int:
    cwd = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
    plan_dir = cwd / ".pi" / "planning"
    task_plan = plan_dir / "task_plan.md"
    findings = plan_dir / "findings.md"
    progress = plan_dir / "progress.md"
    attestation = plan_dir / ".attestation"

    print(f"plan_dir: {plan_dir}")
    print(f"exists: {plan_dir.exists()}")

    if not task_plan.exists():
        print("status: missing planning files")
        return 0

    task_plan_text = read_text(task_plan)
    findings_text = read_text(findings)
    progress_text = read_text(progress)

    goal = extract(r"^## Goal\s*\n+([\s\S]*?)(?:\n## |$)", task_plan_text) or "(unknown)"
    phase = extract(r"^## Current Phase\s*\n+(.+)$", task_plan_text) or "(unknown)"

    print(f"goal: {goal}")
    print(f"phase: {phase}")
    print(f"attested: {attestation.exists()}")

    findings_tail = tail_lines(findings_text, 8)
    progress_tail = tail_lines(progress_text, 8)

    if findings_tail:
        print("recent_findings:")
        print(findings_tail)
    if progress_tail:
        print("recent_progress:")
        print(progress_tail)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
