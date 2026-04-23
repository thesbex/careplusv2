---
description: Update docs/PROGRESS.md with the current state based on recent commits, tests, and open tasks
---

Write an end-of-session entry in `docs/PROGRESS.md`:

1. Read the current `docs/PROGRESS.md` to understand the prior state.
2. Run `git log --oneline -10` to see recent commits of this session.
3. Run `git status` to check for uncommitted changes.
4. Check the `TaskList` tool for tasks completed vs pending in this session.
5. Run `mvn -q test -Dmaven.test.failure.ignore=true` to count tests (or invoke the `regression-guard` subagent for a full verify).
6. Append a new dated entry under "Session log" with:
   - **Shipped**: bullet list of what was delivered (files, modules, features)
   - **State**: build green/red, test count, last commit sha
   - **Next action**: specific next step (not "continue module X" — concrete TODO)
   - **Blockers**: if any
7. Move the "Current status" block at the top to reflect the new state.
8. Do NOT rewrite history — only append.

Show the user a diff of the changes before finalizing.
