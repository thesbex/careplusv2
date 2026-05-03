#!/usr/bin/env node
/**
 * SessionStart hook — fires once when Claude opens this project.
 *
 * Surfaces feature commits on the current branch that have NOT been QA'd yet
 * (no sibling *IT.java added). Lets Claude pick up where the last session
 * left off without waiting for the user to remember.
 *
 * "Not QA'd" heuristic: a commit whose message starts with feat/feature and
 * whose changed files include a Controller.java OR a UI page/feature, but
 * none of the changed files match *IT.java.
 *
 * Output: text on stdout = additional context shown to the model at session
 * start. We keep it short; details are one Bash away.
 */

const { execSync } = require('child_process');

function safe(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }); }
  catch { return ''; }
}

const branch = safe('git rev-parse --abbrev-ref HEAD').trim();
if (!branch || branch === 'HEAD') process.exit(0);

const range = branch === 'main' ? 'HEAD~10..HEAD' : 'main..HEAD';
const log = safe(`git log --pretty=%H%x09%s ${range}`);
if (!log.trim()) process.exit(0);

const candidates = [];
for (const line of log.split('\n')) {
  const [hash, msg] = line.split('\t');
  if (!hash || !msg) continue;
  if (!/^(feat|feature)\b/i.test(msg)) continue;
  const files = safe(`git show --name-only --pretty= ${hash}`);
  const touchedSurface = /Controller\.java\b/.test(files)
    || (/\.tsx?\b/.test(files) && /\b(features|pages|components)\//.test(files));
  const hasIT = /IT\.java\b/.test(files);
  if (touchedSurface && !hasIT) {
    candidates.push({ hash: hash.slice(0, 7), msg });
  }
}

if (candidates.length === 0) process.exit(0);

const lines = [
  '⚠ Pending manual-QA on this branch (feature commits without a sibling IT):',
  ...candidates.slice(0, 5).map(c => `  - ${c.hash} ${c.msg}`),
  '',
  'Before adding new features, run the manual-qa agent on each:',
  '  Agent({ subagent_type: "manual-qa", description: "QA <commit>", prompt: "Walk and bottle scenarios for commit <hash>." })',
];
process.stdout.write(lines.join('\n') + '\n');
