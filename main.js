const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { APP_DIR, FFMPEG, TEMP_DIR, probeFile, grabFrame, reverseClip, segmentMatte, buildFfmpegArgs, extractAudioPeaks } = require('./ffmpeg-builder');
const { normalizeProject, denormalizeProject } = require('./project-paths');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setName('Kon Cut');

let mainWindow = null;
let currentProjectPath = null;
const lastProjectFile = path.join(app.getPath('userData'), 'last-project.json');
const running = { exports: new Map(), segments: new Map() };
const cancelled = new Set();
const cancelSignals = new Map();

function uid() { return Math.random().toString(36).slice(2, 10); }

function backupPathFor(projectPath) {
  return projectPath.replace(/\.montaj$/i, '.autosave.montaj');
}

function rememberProject(projectPath) {
  currentProjectPath = projectPath;
  try { fs.writeFileSync(lastProjectFile, JSON.stringify({ path: projectPath }), 'utf8'); } catch (e) { /* ignore */ }
}

function resolveAsset(p) {
  if (!p || typeof p !== 'string' || path.isAbsolute(p)) return p;
  if (!currentProjectPath) return p;
  return path.resolve(path.dirname(currentProjectPath), p);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    title: 'Kon Cut',
    backgroundColor: '#0e1015',
    webPreferences: {
      preload: path.join(APP_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(APP_DIR, 'renderer', 'index.html'));
  mainWindow.maximize();
}

app.whenReady().then(() => {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  try {
    const last = JSON.parse(fs.readFileSync(lastProjectFile, 'utf8'));
    if (last.path && fs.existsSync(last.path)) currentProjectPath = last.path;
  } catch (e) { /* no last project */ }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- IPC ---------- */

ipcMain.handle('media:open', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'استيراد وسائط',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'وسائط', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'mp3', 'wav', 'aac', 'm4a', 'png', 'jpg', 'jpeg', 'webp'] },
      { name: 'كل الملفات', extensions: ['*'] },
    ],
  });
  if (res.canceled) return [];
  return res.filePaths.map(probeFile);
});

ipcMain.handle('project:save', async (_, data) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'حفظ المشروع',
    defaultPath: currentProjectPath || path.join(app.getPath('documents'), 'project.montaj'),
    filters: [{ name: 'مشروع مونتاج', extensions: ['montaj'] }],
  });
  if (res.canceled) return null;
  const normalized = normalizeProject(data, res.filePath, TEMP_DIR);
  fs.writeFileSync(res.filePath, JSON.stringify(normalized, null, 2), 'utf8');
  rememberProject(res.filePath);
  return res.filePath;
});

ipcMain.handle('project:open', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'فتح مشروع',
    properties: ['openFile'],
    filters: [{ name: 'مشروع مونتاج', extensions: ['montaj', 'json'] }],
  });
  if (res.canceled) return null;
  const file = res.filePaths[0];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  rememberProject(file);
  return denormalizeProject(data, file);
});

ipcMain.handle('project:openBackup', async () => {
  if (!currentProjectPath) return null;
  const backup = backupPathFor(currentProjectPath);
  if (!fs.existsSync(backup)) return null;
  const data = JSON.parse(fs.readFileSync(backup, 'utf8'));
  return denormalizeProject(data, currentProjectPath, TEMP_DIR);
});

ipcMain.handle('project:autosave', async (_, data) => {
  if (!currentProjectPath) return null;
  const backup = backupPathFor(currentProjectPath);
  const tmp = backup + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(normalizeProject(data, currentProjectPath, TEMP_DIR), null, 2), 'utf8');
  fs.renameSync(tmp, backup);
  return backup;
});

ipcMain.handle('export:pickPath', async (_, defaultName) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'تصدير الفيديو',
    defaultPath: path.join(app.getPath('videos'), `${defaultName || 'output'}.mp4`),
    filters: [{ name: 'فيديو MP4', extensions: ['mp4'] }],
  });
  return res.canceled ? null : res.filePath;
});

function killProcesses(list) {
  (list || []).forEach((proc) => { try { proc.kill(); } catch (e) { /* ignore */ } });
}

ipcMain.handle('export:video', async (event, project, outputPath) => {
  const id = uid();
  const resolved = currentProjectPath ? denormalizeProject(project, currentProjectPath) : project;
  return new Promise((resolve) => {
    let args;
    try { args = buildFfmpegArgs(resolved, outputPath); }
    catch (e) { resolve({ ok: false, error: String(e.message || e) }); return; }
    const proc = spawn(FFMPEG, args, { cwd: APP_DIR, windowsHide: true });
    running.exports.set(id, [proc]);
    event.sender.send('export:progress', { id, percent: 0, seconds: 0 });
    let lastPercent = 0;
    let err = '';
    proc.stderr.on('data', (d) => { err = (err + d.toString()).slice(-4000); });
    proc.stdout.on('data', (d) => {
      const m = /out_time_ms=(\d+)/.exec(d.toString());
      if (m && resolved.duration) {
        const sec = Number(m[1]) / 1000000;
        const p = Math.min(99, Math.round((sec / resolved.duration) * 100));
        if (p > lastPercent) {
          lastPercent = p;
          event.sender.send('export:progress', { id, percent: p, seconds: sec });
        }
      }
    });
    proc.on('error', (e) => { running.exports.delete(id); resolve({ ok: false, error: String(e) }); });
    proc.on('close', (code) => {
      running.exports.delete(id);
      if (cancelled.has(id)) {
        cancelled.delete(id);
        event.sender.send('export:progress', { id, percent: 0, cancelled: true });
        resolve({ ok: false, cancelled: true });
        return;
      }
      event.sender.send('export:progress', { id, percent: 100, seconds: resolved.duration });
      resolve(code === 0 ? { ok: true, path: outputPath } : { ok: false, error: err });
    });
  });
});

ipcMain.handle('export:cancel', async (_, id) => {
  if (!id || !running.exports.has(id)) return false;
  cancelled.add(id);
  killProcesses(running.exports.get(id));
  return true;
});

const peakCache = new Map();
ipcMain.handle('audio:peaks', async (_, src) => {
  const abs = resolveAsset(src);
  if (!abs || !fs.existsSync(abs)) return [];
  if (peakCache.has(abs)) return peakCache.get(abs);
  try {
    const peaks = await extractAudioPeaks(abs, 20);
    peakCache.set(abs, peaks);
    return peaks;
  } catch (e) {
    return [];
  }
});

ipcMain.handle('frame:save', async (_, dataUrl) => {
  if (!/^data:image\/png;base64,/.test(dataUrl || '')) throw new Error('invalid frame');
  const file = path.join(TEMP_DIR, `freeze_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.png`);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return file;
});

ipcMain.handle('frame:grab', async (_, src, time) => {
  const out = path.join(TEMP_DIR, `freeze_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.png`);
  return grabFrame(resolveAsset(src), time, out);
});

ipcMain.handle('clip:reverse', async (_, src, start, duration, hasAudio) => {
  const out = path.join(TEMP_DIR, `reverse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`);
  reverseClip(resolveAsset(src), start, duration, !!hasAudio, out);
  return out;
});

ipcMain.handle('clip:segment', async (event, opts) => {
  const o = opts || {};
  const id = uid();
  const mode = o.mode === 'person' ? 'person' : 'general';
  const ext = o.image ? 'png' : 'mp4';
  const out = path.join(TEMP_DIR, `seg_${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`);
  // Register the job before sending its id so cancellation can never race
  // with process creation inside segmentMatte().
  const procs = [];
  running.segments.set(id, procs);
  let signalCancel;
  const cancelPromise = new Promise((resolve) => { signalCancel = resolve; });
  cancelSignals.set(id, signalCancel);
  event.sender.send('segment:progress', { id, clipId: o.clipId, percent: 0 });
  try {
    const work = segmentMatte({
      src: resolveAsset(o.src), out, mode, image: !!o.image,
      start: Number(o.start) || 0,
      duration: Number(o.duration) || 1,
      fps: Number(o.fps) || 30,
      width: Number(o.width) || 960,
      height: Number(o.height) || 540,
      onProgress: (percent) => event.sender.send('segment:progress', { id, clipId: o.clipId, percent }),
      onProcess: (list) => {
        procs.push(...list);
        if (cancelled.has(id)) killProcesses(list);
      },
    }).then((p) => ({ path: p }), (e) => ({ error: e }));
    // Killing piped child processes on Windows does not always fire 'close',
    // so cancellation resolves the IPC call directly instead of waiting.
    const outcome = await Promise.race([work, cancelPromise.then(() => ({ cancelled: true }))]);
    if (outcome.cancelled) return null;
    if (outcome.error) throw outcome.error;
    return outcome.path;
  } finally {
    running.segments.delete(id);
    cancelSignals.delete(id);
    cancelled.delete(id);
  }
});

ipcMain.handle('segment:cancel', async (_, id) => {
  if (!id || !running.segments.has(id)) return false;
  cancelled.add(id);
  killProcesses(running.segments.get(id));
  cancelSignals.get(id)?.();
  return true;
});

ipcMain.handle('app:paths', () => ({
  ffmpeg: FFMPEG,
  fontsDir: path.join(APP_DIR, 'assets', 'fonts').replace(/\\/g, '/'),
}));

ipcMain.handle('app:asset', (_, rel) => path.join(APP_DIR, 'assets', rel));
