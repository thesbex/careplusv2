---
description: End-of-sprint-day checklist — verify everything green, update docs, commit, optionally tag
argument-hint: <day-number>
---

End-of-day gate for sprint day `J$ARGUMENTS`. Runs the full Regression Checklist (`docs/REGRESSION_CHECKLIST.md`) and produces the day wrap-up.

Steps:

1. **Gate 1 — build & tests**: invoke `regression-guard` subagent. If red, STOP and report. Do not proceed.
2. **Gate 2 — migrations from scratch**: run `docker compose down -v && docker compose up -d && mvn -q clean verify`. If red, STOP.
3. **Gate 3 — API contract**: boot the app briefly (`mvn spring-boot:run &`), curl `/v3/api-docs`, compare endpoint count against `docs/API.md`. Stop the app.
4. **Gate 5 — docs updated**: confirm `docs/PROGRESS.md`, `docs/API.md`, and `docs/DECISIONS.md` reflect today's work. If not, run `/progress` first, then retry.
5. **Read `docs/SPRINT_MVP.md`**: tick every item for `J$ARGUMENTS` in-place (mark `[x]` in the markdown). Any incomplete item is moved to the next day or logged as a blocker.
6. **Commit**: `/commit "J$ARGUMENTS wrap-up: <summary of the day>"` — summary one line, referring to the main modules shipped.
7. **Optional tag**: if all `J$ARGUMENTS` items are done, create a lightweight tag `v0.1.0-j$ARGUMENTS` (`git tag v0.1.0-j$ARGUMENTS HEAD`). Do not push.
8. **Hand off report**: produce a 5-line summary for the user — what shipped, test count, commit sha, next day's first action.
