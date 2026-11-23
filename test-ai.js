const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { APP_DIR, FFMPEG, TEMP_DIR, buildFfmpegArgs } = require('./ffmpeg-builder');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const src = path.join(TEMP_DIR, 'test-ai-src.mp4');
if (!fs.existsSync(src)) {
  const gen = spawnSync(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=10:d=0.5',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', src,
  ], { encoding: 'utf8', windowsHide: true, timeout: 120000 });
  if (gen.status !== 0) throw new Error('test source: ' + (gen.stderr || '').slice(-800));
}

const matte = path.join(APP_DIR, 'assets', 'masks', 'circle.png');
const bg = path.join(APP_DIR, 'assets', 'masks', 'star.png');
assert(fs.existsSync(matte) && fs.existsSync(bg), 'test masks missing');

const project = {
  width: 160, height: 90, fps: 10, duration: 0.5,
  tracks: [{
    id: 'v', kind: 'video', clips: [{
      id: 'c1', type: 'media', mediaKind: 'video', src,
      start: 0, duration: 0.5, inPoint: 0, hasAudio: true,
      denoise: true, normalize: true, normGain: 0.5,
      segMatte: matte, segStart: 0,
      bgSrc: bg, bgKind: 'image',
      edgeFeather: 1.5, matteSmooth: true,
      keyframes: [{ t: 0, maskShape: 'circle' }, { t: 0.25, maskShape: 'star' }],
    }],
  }],
};

const out = path.join(TEMP_DIR, 'test-ai-out.mp4');
const args = buildFfmpegArgs(project, out);
const str = args.join(' ');
const expectations = [
  ['afftdn', str.includes('afftdn=nf=-25')],
  ['normalize gain', str.includes('volume=0.500')],
  ['temporal matte', str.includes('tmix=frames=3')],
  ['edge feather', str.includes('gblur=sigma=1.50')],
  ['background input', str.includes('[bgsrc0]') && str.includes('[bgcomp0]')],
  ['alpha over background', str.includes('[bgsrc0][mo0_1]overlay')],
];
const missing = expectations.filter(([, ok]) => !ok).map(([n]) => n);
assert.strictEqual(missing.length, 0, 'missing AI filters: ' + missing.join(', '));

const res = spawnSync(FFMPEG, args, { encoding: 'utf8', windowsHide: true, timeout: 180000 });
if (res.status !== 0) {
  console.error((res.stderr || '').slice(-2500));
  process.exit(1);
}
assert(fs.existsSync(out) && fs.statSync(out).size > 0, 'AI export missing');
console.log('AI: OK', out);
