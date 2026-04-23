---
description: Run regression guard then commit with a conventional message
argument-hint: <commit-message>
---

Safe-commit pipeline — never commits with a broken build.

1. Run `git status` and `git diff --stat` to understand what's about to be committed.
2. Scan staged/unstaged files for secrets patterns (`.env`, `*.key`, `*.pem`, `application-secrets.*`, strings starting with `AKIA`, `sk-`, etc.). If any found, stop and warn the user.
3. Invoke the `regression-guard` subagent. If it reports anything other than `BASELINE OK`, STOP — do not commit. Report the failure and exit.
4. Check the user's message `$ARGUMENTS`:
   - If it references a sprint day (J1, J2…) and a module, accept as-is.
   - Otherwise, suggest a better message in the format `J<day>: <module> — <summary>`.
5. Stage with `git add -A` (or only the relevant paths if the user was selective).
6. Commit via HEREDOC using:
   ```
   git -c user.email="dev@careplus.ma" -c user.name="careplus" commit -m "$(cat <<'EOF'
   $ARGUMENTS
   EOF
   )"
   ```
7. Run `git log --oneline -1` to show the new commit.
8. Never push. Never amend. Never skip hooks.
