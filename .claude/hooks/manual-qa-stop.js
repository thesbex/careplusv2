#!/usr/bin/env node
/**
 * Stop hook — fires when the assistant signals end-of-turn.
 *
 * Catches the case where Claude finished a feature mid-session WITHOUT
 * committing. We compare the working tree to the SESSION BASELINE
 * (HEAD when the session started — recorded in
 * .claude/state/session-baseline by the SessionStart hook) so that
 * pre-session WIP doesn't keep firing the nudge.
 *
 * Logic :
 *   1. Compute new-since-baseline = git diff baseline...HEAD --name-only
 *      ∪ unstaged/untracked files relative to current HEAD that weren't
 *      already modified in the baseline WT.
 *   2. Per-turn de-dup: hash that file set into a fingerprint and compare
 *      against .claude/state/manual-qa-last-fingerprint. Identical = the
 *      user already saw the nudge, stay quiet (avoids re-firing on no-op
 *      turns like "what next?" questions).
 *   3. Stop if .claude/state/skip-manual-qa exists (per-turn opt-out).
 *   4. If the resulting set hits Controller.java / features / pages /
 *      components AND no *IT.java is in it → emit the nudge.
 *
 * Every exit path writes the current fingerprint so the dedup cache
 * stays in sync with what the user has seen.
 *
 * To opt out for the current turn: `touch .claude/state/skip-manual-qa`.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const skipFile = path.join('.claude', 'state', 'skip-manual-qa');
const fingerprintFile = path.join('.claude', 'state', 'manual-qa-last-fingerprint');

function recordFingerprint(fp) {
  try {
    fs.mkdirSync(path.dirname(fingerprintFile), { recursive: true });
    fs.writeFileSync(fingerprintFile, fp);
  } catch {}
}

function readFingerprint() {
  try { return fs.readFileSync(fingerprintFile, 'utf8').trim(); }
  catch { return ''; }
}

function safe(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }); }
  catch { return ''; }
}

const baselineFile = path.join('.claude', 'state', 'session-baseline');
let baseline = null;
let baselineWT = new Set();
if (fs.existsSync(baselineFile)) {
  try {
    const raw = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    baseline = raw.head || null;
    baselineWT = new Set(raw.dirty || []);
  } catch { /* malformed — ignore */ }
}

const head = safe('git rev-parse HEAD').trim();
if (!head) process.exit(0);

// Files committed in this session: diff baseline..HEAD if baseline known.
const committedThisSession = baseline && baseline !== head
  ? safe(`git diff --name-only ${baseline}..HEAD`).split('\n').filter(Boolean)
  : [];

// Files dirty in WT that were NOT already dirty at session start
// (i.e. truly new edits made during this session).
const wt = safe('git status --porcelain').split('\n').filter(Boolean);
const wtFiles = wt.map(l => l.slice(3).trim()).filter(Boolean);
const newDirty = wtFiles.filter(f => !baselineWT.has(f));

const all = [...new Set([...committedThisSession, ...newDirty])];
const fingerprint = all.sort().join('|');

// Per-turn de-dup: if the touched-file set hasn't changed since our last
// invocation, we already nudged the user about it — stay quiet. Without
// this, every no-op turn (e.g. answering a question) re-trips the hook
// because the cumulative session diff still matches.
if (fingerprint === readFingerprint()) process.exit(0);

// Honour an explicit skip — but ALSO record the fingerprint so subsequent
// no-op turns don't re-fire. (Without this, the user has to touch the
// skip file every turn until they make a new edit.)
if (fs.existsSync(skipFile)) {
  try { fs.unlinkSync(skipFile); } catch {}
  recordFingerprint(fingerprint);
  process.exit(0);
}

if (all.length === 0) {
  recordFingerprint(fingerprint);
  process.exit(0);
}

const touchedSurface = all.some(f =>
  /Controller\.java$/.test(f)
  || (/\.tsx?$/.test(f) && /\b(features|pages|components)\b/.test(f))
);
if (!touchedSurface) {
  recordFingerprint(fingerprint);
  process.exit(0);
}

const hasIT = all.some(f => /IT\.java$/.test(f) || /\.test\.(ts|tsx)$/.test(f));
if (hasIT) {
  recordFingerprint(fingerprint);
  process.exit(0);
}

// About to fire — record so we don't re-fire next no-op turn.
recordFingerprint(fingerprint);

const reason = [
  'Cette session a touché un Controller / écran UI sans ajouter d\'IT correspondant.',
  '',
  'Drive manual-qa sur cette surface et bottle la walk dans une IT (cf. PatientPhotoIT.java) avant de poursuivre.',
  '',
  'Skip pour 1 tour : `touch .claude/state/skip-manual-qa`.',
].join('\n');

process.stdout.write(JSON.stringify({
  decision: 'block',
  reason,
}));
