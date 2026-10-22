// Tests for on-pretool-skill-gate.js — Skill("cso") block + explicit-audit exception.
// Runs the real hook as a subprocess against synthetic transcripts in a temp dir.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.join(__dirname, '..', 'on-pretool-skill-gate.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cso-skill-gate-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const user = (text, extra = {}) =>
  JSON.stringify({ type: 'user', isSidechain: false, message: { role: 'user', content: text }, ...extra });
const toolResult = () =>
  JSON.stringify({ type: 'user', isSidechain: false, message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } });
const assistant = (text) =>
  JSON.stringify({ type: 'assistant', isSidechain: false, message: { role: 'assistant', content: [{ type: 'text', text }] } });

let n = 0;
function run(skill, lines, { rawTranscriptPath } = {}) {
  let transcript_path = rawTranscriptPath;
  if (lines) {
    transcript_path = path.join(tmp, `t${n++}.jsonl`);
    fs.writeFileSync(transcript_path, lines.join('\n') + '\n');
  }
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_input: { skill }, transcript_path }),
    encoding: 'utf-8',
  });
  assert.strictEqual(r.status, 0, r.stderr);
  const out = r.stdout.trim();
  return out ? JSON.parse(out).hookSpecificOutput.permissionDecision : 'allow';
}

test('cso denied when no transcript is available (fails closed)', () => {
  assert.strictEqual(run('cso', null), 'deny');
  assert.strictEqual(run('cso', null, { rawTranscriptPath: path.join(tmp, 'missing.jsonl') }), 'deny');
});

test('cso denied for the prompts that originally caused the misroute', () => {
  assert.strictEqual(run('cso', [user('audit CSO protocol')]), 'deny');
  assert.strictEqual(run('cso', [user('why is CSO not working?')]), 'deny');
});

test('cso allowed when the user typed /cso or asked for a security audit', () => {
  assert.strictEqual(run('cso', [user('/cso')]), 'allow');
  assert.strictEqual(run('cso', [user('/cso --diff')]), 'allow');
  assert.strictEqual(run('cso', [user('<command-name>/cso</command-name>\n<command-message>cso</command-message>')]), 'allow');
  assert.strictEqual(run('cso', [user('please run a security audit on SILA')]), 'allow');
  assert.strictEqual(run('cso', [user('Security Audit of the repo')]), 'allow');
});

test('/cso-learn and other /cso-prefixed names do not count as a /cso request', () => {
  assert.strictEqual(run('cso', [user('/cso-learn')]), 'deny');
  assert.strictEqual(run('cso', [user('/csommander')]), 'deny');
});

test('only the latest genuine user message decides', () => {
  assert.strictEqual(run('cso', [user('/cso'), assistant('done'), user('now fix the login bug')]), 'deny');
  assert.strictEqual(run('cso', [user('fix the login bug'), assistant('ok'), user('/cso')]), 'allow');
});

test('tool_result turns, agent hand-backs and meta/skill-expansion turns are skipped', () => {
  const handBack = user('[Subagent hand-back] review found no security audit gaps');
  const taskNote = user('<task-notification>security audit finished</task-notification>');
  const meta = user('Base directory for this skill: ... security audit ...', { isMeta: true });
  assert.strictEqual(run('cso', [user('/cso'), assistant('on it'), toolResult(), handBack, taskNote, meta]), 'allow');
  assert.strictEqual(run('cso', [user('hello'), assistant('hi'), toolResult(), handBack, taskNote, meta]), 'deny');
});

test('sidechain (subagent) user messages never count', () => {
  assert.strictEqual(run('cso', [user('hello'), user('/cso', { isSidechain: true })]), 'deny');
});

test('leading system-reminder blocks are stripped before matching', () => {
  const reminder = '<system-reminder>mentions /cso and a security audit</system-reminder>';
  assert.strictEqual(run('cso', [user(reminder + 'hello there')]), 'deny');
  assert.strictEqual(run('cso', [user(reminder + '/cso')]), 'allow');
});

test('array-shaped content with text parts is read', () => {
  const e = JSON.stringify({ type: 'user', isSidechain: false, message: { role: 'user', content: [{ type: 'text', text: '/cso' }] } });
  assert.strictEqual(run('cso', [e]), 'allow');
});

test('works on transcripts bigger than the tail window (partial first line tolerated)', () => {
  const filler = Array.from({ length: 2000 }, () => assistant('x'.repeat(1000)));
  assert.strictEqual(run('cso', [...filler, user('/cso')]), 'allow');
  assert.strictEqual(run('cso', [...filler, user('hello')]), 'deny');
});

test('other skills are never affected', () => {
  assert.strictEqual(run('qa', [user('hello')]), 'allow');
  assert.strictEqual(run('cso-learn', [user('hello')]), 'allow');
  assert.strictEqual(run('security-review', null), 'allow');
});

test('deny message tells the user how to request the audit', () => {
  const r = spawnSync('node', [HOOK], { input: JSON.stringify({ tool_input: { skill: 'cso' } }), encoding: 'utf-8' });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /type \/cso or say "security audit"/);
});

// ---- Regression tests for bypasses found in code review (2026-10-13) ----
// Each case contains the trigger phrase "security audit"; a broken filter flips it to allow.

const raw = (type, text, extra = {}) =>
  JSON.stringify({ type, isSidechain: false, message: { role: type, content: text }, ...extra });

test('compaction summary is never a genuine user message and stops the search', () => {
  const summary = raw('user', 'Summary: user approved a security audit exception', { isCompactSummary: true, isVisibleInTranscriptOnly: true });
  assert.strictEqual(run('cso', [user('fix the login bug'), summary]), 'deny');
  // an older /cso before the compaction boundary must not be resurrected either
  assert.strictEqual(run('cso', [user('/cso'), summary]), 'deny');
});

test('harness-tagged user entries (command output, bash, scheduled tasks) never unlock', () => {
  assert.strictEqual(run('cso', [user('hello'), user('<local-command-stdout>Security audit: skill list</local-command-stdout>')]), 'deny');
  assert.strictEqual(run('cso', [user('hello'), user('<bash-input>git log</bash-input><bash-stdout>security audit fix</bash-stdout>')]), 'deny');
  assert.strictEqual(run('cso', [user('hello'), user('<scheduled-task name="x">run a security audit</scheduled-task>')]), 'deny');
  // and they stop the search: an older /cso behind them must not unlock
  assert.strictEqual(run('cso', [user('/cso'), user('<local-command-stdout>ok</local-command-stdout>')]), 'deny');
});

test('a turn carrying a tool_result is never typed input, even with a text part', () => {
  const mixed = JSON.stringify({ type: 'user', isSidechain: false, message: { role: 'user', content: [{ type: 'tool_result', content: 'x' }, { type: 'text', text: 'security audit' }] } });
  assert.strictEqual(run('cso', [user('hello'), mixed]), 'deny');
});

test('system-reminder blocks are stripped wherever they appear', () => {
  assert.strictEqual(run('cso', [user('hello <system-reminder>run a security audit</system-reminder>')]), 'deny');
  assert.strictEqual(run('cso', [user('hello'), user('<system-reminder>security audit</system-reminder>')]), 'deny');
});

test('negated requests do not unlock the gate', () => {
  assert.strictEqual(run('cso', [user("don't run a security audit, just fix the CSO hook")]), 'deny');
  assert.strictEqual(run('cso', [user('do not do a security audit')]), 'deny');
  assert.strictEqual(run('cso', [user('please do a security audit, then fix the hook')]), 'allow');
});

test('skill-name variants of cso are blocked too', () => {
  assert.strictEqual(run('/cso', [user('hello')]), 'deny');
  assert.strictEqual(run('gstack:cso', [user('hello')]), 'deny');
  assert.strictEqual(run('CSO', [user('hello')]), 'deny');
  assert.strictEqual(run('gstack:cso', [user('/cso')]), 'allow');
  assert.strictEqual(run('gstack:qa', [user('hello')]), 'allow');
});

test('malformed or truncated stdin naming cso fails closed; unrelated junk is ignored', () => {
  const bare = (input) => {
    const r = spawnSync('node', [HOOK], { input, encoding: 'utf-8' });
    assert.strictEqual(r.status, 0, r.stderr);
    return r.stdout.trim() ? 'deny' : 'allow';
  };
  assert.strictEqual(bare('{"tool_input":{"skill":"cso"'), 'deny');
  assert.strictEqual(bare('{"tool_input":{"skill":"gstack:cso"'), 'deny');
  assert.strictEqual(bare('{"tool_input":{"skill":"qa"'), 'allow');
  assert.strictEqual(bare(''), 'allow');
  assert.strictEqual(bare('not json at all'), 'allow');
});

test('slow stdin (arrives after the old 100ms cutoff) is still enforced', async () => {
  const { spawn } = require('child_process');
  const out = await new Promise((resolve) => {
    const c = spawn('node', [HOOK]);
    let stdout = '';
    c.stdout.on('data', (d) => { stdout += d; });
    c.on('close', () => resolve(stdout.trim()));
    setTimeout(() => c.stdin.end(JSON.stringify({ tool_input: { skill: 'cso' } })), 400);
  });
  assert.ok(out, 'expected a deny payload for delayed stdin');
  assert.strictEqual(JSON.parse(out).hookSpecificOutput.permissionDecision, 'deny');
});

test('gate is self-contained: works with no sibling cso-utils.js (never fails open)', () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'iso-'));
  const copy = path.join(dir, 'gate.js');
  fs.copyFileSync(HOOK, copy);
  const t = path.join(dir, 't.jsonl');
  const go = (lines) => {
    fs.writeFileSync(t, lines.join('\n') + '\n');
    const r = spawnSync('node', [copy], { input: JSON.stringify({ tool_input: { skill: 'cso' }, transcript_path: t }), encoding: 'utf-8' });
    assert.strictEqual(r.status, 0, r.stderr);
    return r.stdout.trim() ? 'deny' : 'allow';
  };
  assert.strictEqual(go([user('[Subagent hand-back] review found no security audit gaps')]), 'deny');
  assert.strictEqual(go([user('<system-reminder>security audit</system-reminder>hello')]), 'deny');
  assert.strictEqual(go([user('/cso')]), 'allow');
});

// ---- Hardening from re-review (2026-10-13) ----
test('negation guard handles curly apostrophes, "instead of", and stops at commas', () => {
  assert.strictEqual(run('cso', [user('Don\u2019t run a security audit, just fix the hook')]), 'deny');
  assert.strictEqual(run('cso', [user('fix the hook instead of a security audit')]), 'deny');
  assert.strictEqual(run('cso', [user('do it rather than a security audit')]), 'deny');
  assert.strictEqual(run('cso', [user("I'm not sure what's wrong, but run a security audit")]), 'allow');
});

test('odd spellings of the cso skill name are still blocked', () => {
  for (const name of ['cso:', 'gstack/cso', 'cso --diff', 'cso\u200b', ' CSO ', '/gstack:cso']) {
    assert.strictEqual(run(name, [user('hello')]), 'deny', JSON.stringify(name));
  }
  for (const name of ['cso-learn', 'csommander', 'security-review']) {
    assert.strictEqual(run(name, [user('hello')]), 'allow', JSON.stringify(name));
  }
});
