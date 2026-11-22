const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { APP_DIR, FFMPEG, TEMP_DIR, probeFile, buildFfmpegArgs } = require('./ffmpeg-builder');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setName('Kon Cut');

let mainWindow = null;

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
    defaultPath: path.join(app.getPath('documents'), 'project.montaj'),
    filters: [{ name: 'مشروع مونتاج', extensions: ['montaj'] }],
  });
  if (res.canceled) return null;
  fs.writeFileSync(res.filePath, JSON.stringify(data, null, 2), 'utf8');
  return res.filePath;
});

ipcMain.handle('project:open', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'فتح مشروع',
    properties: ['openFile'],
    filters: [{ name: 'مشروع مونتاج', extensions: ['montaj', 'json'] }],
  });
  if (res.canceled) return null;
  return JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'));
});

ipcMain.handle('export:pickPath', async (_, defaultName) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'تصدير الفيديو',
    defaultPath: path.join(app.getPath('videos'), `${defaultName || 'output'}.mp4`),
    filters: [{ name: 'فيديو MP4', extensions: ['mp4'] }],
  });
  return res.canceled ? null : res.filePath;
});

ipcMain.handle('export:video', async (event, project, outputPath) => {
  return new Promise((resolve) => {
    const args = buildFfmpegArgs(project, outputPath);
    const proc = spawn(FFMPEG, args, { cwd: APP_DIR, windowsHide: true });
    let lastPercent = 0;
    let err = '';
    proc.stderr.on('data', (d) => { err = (err + d.toString()).slice(-4000); });
    proc.stdout.on('data', (d) => {
      const m = /out_time_ms=(\d+)/.exec(d.toString());
      if (m && project.duration) {
        const sec = Number(m[1]) / 1000000;
        const p = Math.min(99, Math.round((sec / project.duration) * 100));
        if (p > lastPercent) {
          lastPercent = p;
          event.sender.send('export:progress', { percent: p, seconds: sec });
        }
      }
    });
    proc.on('error', (e) => resolve({ ok: false, error: String(e) }));
    proc.on('close', (code) => {
      event.sender.send('export:progress', { percent: 100, seconds: project.duration });
      resolve(code === 0 ? { ok: true, path: outputPath } : { ok: false, error: err });
    });
  });
});

ipcMain.handle('app:paths', () => ({
  ffmpeg: FFMPEG,
  fontsDir: path.join(APP_DIR, 'assets', 'fonts').replace(/\\/g, '/'),
}));

ipcMain.handle('app:asset', (_, rel) => path.join(APP_DIR, 'assets', rel));
