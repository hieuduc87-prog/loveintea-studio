#!/bin/bash
# SessionStart hook: bơm docs/PROJECT_BRIEF.md vào đầu mọi phiên.
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
python3 - "$ROOT" <<'PY'
import json, sys, os
root = sys.argv[1]
brief = os.path.join(root, "docs/PROJECT_BRIEF.md")
if os.path.exists(brief):
    txt = open(brief, encoding="utf-8").read()
    print(json.dumps({
        "hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": txt},
        "suppressOutput": True,
    }))
PY
