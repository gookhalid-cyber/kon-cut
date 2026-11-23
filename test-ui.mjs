// Automated UI smoke test. Launches Electron on an isolated profile and drives
// the renderer through CDP so no test touches the user's real project/profile.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 9333;
const PROFILE = path.join(os.tmpdir(), `koncut-cdp-test-${process.pid}-${Date.now()}`);
const ELECTRON = path.join(APP_DIR, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, timeout = 20000) => {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e; }
    await sleep(200);
  }
  throw new Error('timeout: ' + (last && last.message ? last.message : last));
};

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });

const child = spawn(ELECTRON, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, APP_DIR], {
  cwd: APP_DIR,
  windowsHide: true,
  stdio: 'ignore',
});

let ws;
try {
  const page = await waitFor(async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
    const pages = await res.json();
    return pages.find((p) => p.type === 'page' && p.url.includes('index.html'));
  });
  await sleep(600);

  ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
    }
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Runtime.enable');

  const expression = `(() => {
    const out = {};
    out.api = ['audioPeaks','proxyFor','detectScenes','detectSilence','transcribe','logError','getReport','runtime'].filter((k) => typeof window.api?.[k] === 'function');
    out.buttons = ['undoBtn','redoBtn','backupBtn','exportStartBtn','progressCancelBtn','toolsBtn'].map((x) => !!document.getElementById(x));
    state.project.tracks.forEach((t) => { t.clips = []; });
    clearSelection(); recomputeDuration();
    const tt = state.project.tracks.find((t) => t.kind === 'text');
    addTextClip(TEXT_PRESETS[0]);
    out.afterAdd = { clips: allClips().length, canUndo: KCHistory.canUndo() };
    document.getElementById('undoBtn').click();
    out.afterUndo = { clips: allClips().length, canRedo: KCHistory.canRedo() };
    document.getElementById('redoBtn').click();
    out.afterRedo = allClips().length;

    const a = addTextClip(TEXT_PRESETS[0], 0);
    const b = addTextClip(TEXT_PRESETS[0], 2);
    selectClip(tt, a, false, false); selectClip(tt, b, true, false);
    out.multi = state.selection.size;
    duplicateSelected(); out.dup = allClips().length;
    copySelected(); pasteClips(); out.paste = allClips().length;
    selectClip(tt, a, false, false); deleteSelected(true); out.ripple = tt.clips.map((c) => c.start);
    if (tt.clips[0]) selectClip(tt, tt.clips[0], false, false);

    const fl = document.querySelectorAll('#filterPresets .preset')[2];
    fl.click(); out.filter = state.project.filter; out.css = cssFilter();
    const adj = document.getElementById('adjBright');
    adj.value = '25'; adj.dispatchEvent(new Event('input', { bubbles: true })); adj.dispatchEvent(new Event('change', { bubbles: true }));
    out.adjust = state.project.adjust.bright;

    setTime(0); addKeyframe(0); state.inspectorTab = 'motion'; renderInspector();
    out.easingUI = document.querySelectorAll('.kf-easing').length;
    out.curveEditor = !!document.getElementById('curveEditor');
    const sel = document.querySelector('.kf-easing');
    if (sel) { sel.value = 'easeInOut'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    out.easing = (sortedKfs(findClip(state.selected.trackId, state.selected.clipId))[0] || {}).easing;

    document.getElementById('exportBtn').click();
    out.exportModal = {
      shown: document.getElementById('exportModal').classList.contains('show'),
      fields: ['expRes','expFps','expQuality'].map((x) => !!document.getElementById(x)),
    };
    document.getElementById('exportCancelBtn').click();
    return JSON.stringify(out);
  })()`;
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  const out = JSON.parse(result.result.value);
  console.log('UI:', JSON.stringify(out));
  console.log('errors:', JSON.stringify(errors));

  const checks = [
    ['easing', out.easing === 'easeInOut'],
    ['multi', out.multi === 2],
    ['dup', out.dup > out.afterAdd.clips],
    ['paste', out.paste > out.dup],
    ['filter', out.filter !== 'none' && out.css !== 'none'],
    ['adjust', out.adjust === 25],
    ['export modal', out.exportModal.shown && out.exportModal.fields.every(Boolean)],
    ['undo/redo', out.afterUndo.clips === 0 && out.afterRedo === 1],
    ['console clean', errors.length === 0],
    ['runtime api', out.api.length === 8],
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error('UI checks failed: ' + failed.join(', '));
  console.log('UI TEST: OK');
} finally {
  if (ws) ws.close();
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { process.kill(child.pid); } catch (e) { /* already exited */ }
  }
  // Electron keeps locks on its profile for a moment after the kill.
  for (let i = 0; i < 25; i++) {
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); break; }
    catch (e) { await sleep(200); }
  }
}
