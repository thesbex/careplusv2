#!/usr/bin/env node
/**
 * Stop hook — fires when the assistant signals end-of-turn.
 *
 * Catches the case where Claude finished a feature mid-session WITHOUT
 * committing (e.g. user said "ok pause here"). Diff against the working tree:
 * if Controller.java / pages / features were modified and there is no
 * staged/unstaged *IT.java change, suggest a manual-qa pass before the next
 * turn starts.
 *
 * To opt out for the current turn: `touch .claude/state/skip-manual-qa`.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const skipFile = path.join('.claude', 'state', 'skip-manual-qa');
if (fs.existsSync(skipFile)) {
  try { fs.unlinkSync(skipFile); } catch {}
  process.exit(0);
}

function safe(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }); }
  catch { return ''; }
}

// Files changed in the working tree (staged + unstaged + untracked).
const wt = safe('git status --porcelain');
if (!wt.trim()) process.exit(0);

const files = wt
  .split('\n')
  .map(l => l.slice(3).trim())
  .filter(Boolean);

const touchedSurface = files.some(f =>
  /Controller\.java$/.test(f)
  || (/\.tsx?$/.test(f) && /\b(features|pages|components)\b/.test(f))
);
if (!touchedSurface) process.exit(0);

const hasIT = files.some(f => /IT\.java$/.test(f));
if (hasIT) process.exit(0);

const reason = [
  'Working tree has uncommitted changes to a Controller / UI screen but no IT was added or updated.',
  '',
  'Before next turn, drive manual-qa on the touched surface and bottle the walk into an IT (mirror PatientPhotoIT.java).',
  '',
  'Skip for one turn: `touch .claude/state/skip-manual-qa`.',
].join('\n');

// Stop hook: emit JSON to ask the agent to keep going on QA.
process.stdout.write(JSON.stringify({
  decision: 'block',
  reason,
}));
