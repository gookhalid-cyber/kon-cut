// Smoke-test the packaged Electron build: real resources/, real Python,
// real ONNX/Whisper models, no dev paths. Run after `npm run dist`.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EXE = path.join(ROOT, 'dist', 'win-unpacked', process.platform === 'win32' ? 'Kon Cut.exe' : 'Kon Cut');
const PORT = Number(process.env.KONCUT_TEST_PORT || 9334);
const PROFILE = path.join(os.tmpdir(), `koncut-pkg-${process.pid}-${Date.now()}`);
const VIDEO = path.join(ROOT, 'temp', 'test-ai-src.mp4');
const IMAGE = path.join(ROOT, 'temp', 'seg-test-src.png');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 45000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e; }
    await sleep(250);
  }
  throw new Error(`timeout: ${last && last.message || last}`);
}

if (!fs.existsSync(EXE)) {
  console.error(`PACKAGED TEST: missing ${EXE} — run npm run dist first`);
  process.exit(1);
}
for (const f of [VIDEO, IMAGE]) {
  if (!fs.existsSync(f)) {
    console.error(`PACKAGED TEST: missing fixture ${f}`);
    process.exit(1);
  }
}

fs.mkdirSync(PROFILE, { recursive: true });
const child = spawn(EXE, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`], {
  cwd: path.dirname(EXE), windowsHide: true, stdio: 'ignore',
});
let ws;
try {
  const page = await waitFor(async () => {
    const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    return pages.find((p) => p.type === 'page' && p.url.includes('index.html'));
  });
  await sleep(1000);
  ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  let id = 0;
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  await send('Runtime.enable');

  const expression = `(async () => {
    const out = {};
    out.runtime = await window.api.runtime();
    out.proxy = await window.api.proxyFor(${JSON.stringify(VIDEO)});
    const peaks = await window.api.audioPeaks(${JSON.stringify(VIDEO)});
    out.peaks = Array.isArray(peaks) ? peaks.length : -1;
    out.scenes = await window.api.detectScenes(${JSON.stringify(VIDEO)});
    try {
      out.matte = await window.api.segmentClip({ src: ${JSON.stringify(IMAGE)}, image: true, mode: 'general' });
    } catch (e) { out.matteError = String(e && e.message || e); }
    try {
      out.captions = await window.api.transcribe(${JSON.stringify(VIDEO)});
    } catch (e) { out.captionError = String(e && e.message || e); }
    return JSON.stringify(out);
  })()`;
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  const out = JSON.parse(r.result.value);
  const checks = [
    ['packaged mode', out.runtime?.packaged === true],
    ['FFmpeg from resources', out.runtime?.ffmpegReady === true && out.runtime.ffmpeg.includes('resources')],
    ['models from resources', out.runtime?.models.includes('resources')],
    ['proxy generated', typeof out.proxy === 'string' && out.proxy.length > 0],
    ['audio peaks', out.peaks > 0],
    ['scene detection api', Array.isArray(out.scenes)],
    ['offline segmentation', !!out.matte && !out.matteError],
    ['offline transcription', Array.isArray(out.captions) && !out.captionError],
    ['console clean', errors.length === 0],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`);
  if (out.matteError) console.log('matte error:', out.matteError);
  if (out.captionError) console.log('caption error:', out.captionError);
  if (errors.length) console.log('console errors:', JSON.stringify(errors));
  const ok = checks.every(([, passed]) => passed);
  console.log(ok ? 'PACKAGED TEST: OK' : 'PACKAGED TEST: FAIL');
  if (!ok) process.exitCode = 1;
} finally {
  if (ws) ws.close();
  spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  for (let i = 0; i < 20; i++) {
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); break; } catch (e) { await sleep(200); }
  }
}
