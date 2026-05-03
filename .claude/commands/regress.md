---
description: Run the regression guard — full mvn verify and report baseline status
---

Invoke the `regression-guard` subagent to execute `mvn -q clean verify` and report either `BASELINE OK` with test count and duration, or the first failing test with file:line and a 1-line hypothesis. Do not attempt fixes — this is a read-only gate.
