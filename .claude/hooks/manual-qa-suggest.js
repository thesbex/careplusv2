#!/usr/bin/env node
/**
 * PostToolUse hook — fires after every Bash call.
 *
 * Goal: when Claude just completed a feature (commit landed, IT class added,
 * or new controller endpoint shipped), nudge it to run the manual-qa agent
 * BEFORE moving on.
 *
 * We don't trigger on every tool — only when the latest Bash command was a
 * `git commit` whose message looks like a feature ("feat(", "feature/", etc.)
 * AND the commit touched a controller / page / hook surface that manual QA
 * actually needs to walk.
 *
 * Output protocol: write a JSON object to stdout with `decision: "block"` and
 * `reason: "..."` to inject the suggestion as a system reminder. Anything else
 * is silent.
 *
 * To opt out for a turn, the user can `touch .claude/state/skip-manual-qa`.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let payload = '';
try {
  payload = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let event;
try {
  event = JSON.parse(payload);
} catch {
  process.exit(0);
}

const tool = event?.tool_input?.command || '';
if (!/^\s*git\s+commit\b/.test(tool)) process.exit(0);

// Skip if user opted out for this turn.
const skipFile = path.join('.claude', 'state', 'skip-manual-qa');
if (fs.existsSync(skipFile)) {
  try { fs.unlinkSync(skipFile); } catch {}
  process.exit(0);
}

// Inspect the commit Claude just made.
let lastMsg = '';
let lastFiles = '';
try {
  lastMsg = execSync('git log -1 --pretty=%s', { encoding: 'utf8' }).trim();
  lastFiles = execSync('git show --name-only --pretty="" HEAD', { encoding: 'utf8' });
} catch {
  process.exit(0);
}

const isFeature = /^(feat|feature)\b/i.test(lastMsg);
if (!isFeature) process.exit(0);

const touchedSurfaces = [];
if (/Controller\.java\b/.test(lastFiles)) touchedSurfaces.push('backend endpoint');
if (/\.tsx?\b/.test(lastFiles) && /\b(features|pages|components)\//.test(lastFiles)) {
  touchedSurfaces.push('frontend screen');
}
if (touchedSurfaces.length === 0) process.exit(0);

// Was there an IT added in the same commit? If yes, manual-qa probably already
// ran — don't nag.
if (/IT\.java\b/.test(lastFiles)) process.exit(0);

const reason = [
  `Commit "${lastMsg}" touched ${touchedSurfaces.join(' + ')} but did not add an IT.`,
  '',
  'Before moving on, drive a manual-qa pass on this feature:',
  '',
  '    Agent({ subagent_type: "manual-qa", description: "QA pass on ${last commit}", prompt: "Walk every scenario for the feature shipped in HEAD: read the controller + service + UI, list scenarios, drive the browser via Playwright MCP on http://localhost:5173, verify DB state via docker exec psql for each scenario, then bottle the walk into src/test/java/.../<Feature>IT.java mirroring PatientPhotoIT.java." })',
  '',
  'To skip this nudge for the current turn: `touch .claude/state/skip-manual-qa` then re-run.',
].join('\n');

process.stdout.write(JSON.stringify({
  decision: 'block',
  reason,
}));
