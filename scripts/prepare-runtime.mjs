// Stages the offline runtime that electron-builder packs into resources/.
// Everything is local in the installer: FFmpeg, embeddable Python, ONNX
// segmentation models and the Arabic Whisper small int8 model.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BIN_DIR = path.join(APP_DIR, 'bin');
const RUNTIME = path.join(APP_DIR, 'runtime');
const PY_DIR = path.join(RUNTIME, 'python');
const MODELS = path.join(RUNTIME, 'models');
const REMBG_MODELS = path.join(MODELS, 'rembg');
const WHISPER_MODELS = path.join(MODELS, 'whisper');
const PY_VER = process.env.KONCUT_PYTHON_VERSION || '3.12.9';
const PY_EXE = path.join(PY_DIR, process.platform === 'win32' ? 'python.exe' : 'bin/python3');
const SKIP_DOWNLOADS = process.env.KONCUT_SKIP_MODEL_DOWNLOAD === '1';

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd: APP_DIR,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (r.error || r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed: ${r.error || r.status}`);
}

async function download(url, dest) {
  if (fs.existsSync(dest)) return dest;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url}: HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

function extract(zip, target) {
  fs.mkdirSync(target, { recursive: true });
  if (process.platform === 'win32') {
    run('powershell.exe', ['-NoProfile', '-Command',
      `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${target}' -Force`]);
  } else {
    run('unzip', ['-o', zip, '-d', target]);
  }
}

function stageFfmpeg() {
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const ext = process.platform === 'win32' ? '.exe' : '';
  for (const name of ['ffmpeg', 'ffprobe']) {
    const dest = path.join(BIN_DIR, name + ext);
    if (fs.existsSync(dest)) { console.log(`ffmpeg: ${name} already staged`); continue; }
    const fromEnv = process.env.KONCUT_FFMPEG_DIR;
    if (fromEnv && fs.existsSync(path.join(fromEnv, name + ext))) {
      fs.copyFileSync(path.join(fromEnv, name + ext), dest);
    } else {
      throw new Error(`Missing ${name}. Set KONCUT_FFMPEG_DIR to the FFmpeg bin folder.`);
    }
    console.log(`ffmpeg: staged ${name}`);
  }
}

async function stagePython() {
  if (fs.existsSync(PY_EXE)) {
    console.log(`python: already staged at ${PY_EXE}`);
    return;
  }
  const fromEnv = process.env.KONCUT_PYTHON_DIR;
  if (fromEnv && fs.existsSync(fromEnv)) {
    fs.mkdirSync(PY_DIR, { recursive: true });
    fs.cpSync(fromEnv, PY_DIR, { recursive: true, force: true });
    console.log(`python: copied local runtime from ${fromEnv}`);
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koncut-runtime-'));
  const url = process.env.KONCUT_PYTHON_URL ||
    `https://www.python.org/ftp/python/${PY_VER}/python-${PY_VER}-embed-amd64.zip`;
  const zip = path.join(tmp, 'python-embed.zip');
  console.log(`python: downloading ${url}`);
  await download(url, zip);
  extract(zip, PY_DIR);

  // Embeddable Python ignores site-packages until the .pth file says so.
  const pth = fs.readdirSync(PY_DIR).find((f) => /^python\d+\._pth$/i.test(f));
  if (pth) {
    const p = path.join(PY_DIR, pth);
    let text = fs.readFileSync(p, 'utf8').replace(/^#import site$/m, 'import site');
    if (!text.split(/\r?\n/).some((l) => l.trim() === 'Lib/site-packages')) {
      text += '\nLib/site-packages\n';
    }
    fs.writeFileSync(p, text);
  }
  console.log('python: enabled site-packages');
}

async function main() {
  stageFfmpeg();

  if (!fs.existsSync(PY_EXE)) await stagePython();

  // Pip check must not abort the build when absent.
  const probe = spawnSync(PY_EXE, ['-m', 'pip', '--version'], { cwd: APP_DIR, encoding: 'utf8' });
  if (probe.status !== 0) {
    const getPip = path.join(os.tmpdir(), 'koncut-get-pip.py');
    await download('https://bootstrap.pypa.io/get-pip.py', getPip);
    run(PY_EXE, [getPip, '--no-warn-script-location']);
  }

  fs.mkdirSync(REMBG_MODELS, { recursive: true });
  fs.mkdirSync(WHISPER_MODELS, { recursive: true });
  run(PY_EXE, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-warn-script-location',
    'rembg[cpu]', 'pymatting', 'faster-whisper'], {
    PIP_DISABLE_PIP_VERSION_CHECK: '1',
  });

  if (!SKIP_DOWNLOADS) {
    console.log('models: warming rembg ONNX models');
    run(PY_EXE, ['-c',
      "from rembg import new_session\nfor m in ('isnet-general-use','u2net_human_seg','u2netp'): new_session(m)"], {
      U2NET_HOME: REMBG_MODELS,
    });
    console.log('models: warming Whisper small int8');
    run(PY_EXE, ['-c',
      `from faster_whisper import WhisperModel; WhisperModel('small', download_root=r'${WHISPER_MODELS}', device='cpu', compute_type='int8')`]);
  } else {
    console.log('models: KONCUT_SKIP_MODEL_DOWNLOAD=1 — skipped');
  }

  console.log('runtime ready:', RUNTIME);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
