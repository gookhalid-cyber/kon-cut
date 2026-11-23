const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { FFMPEG, TEMP_DIR, buildFfmpegArgs, colorGradeFilter } = require('./ffmpeg-builder');

const base = { width: 160, height: 90, fps: 10, duration: 0.3, tracks: [] };

const grayArgs = buildFfmpegArgs({ ...base, filter: 'grayscale(1)' }, 'temp/test-gray.mp4');
assert(grayArgs.join(' ').includes('hue=s=0'), 'grayscale preset missing in FFmpeg args');

const grade = colorGradeFilter({ filter: 'none', adjust: { bright: 20, contrast: 10, sat: -10, temp: 20 } });
assert(/eq=brightness=/.test(grade) && /colorchannelmixer=rr=/.test(grade), 'adjustment filters missing');

const out = path.join(TEMP_DIR, 'test-grade.mp4');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
const args = buildFfmpegArgs(
  { ...base, filter: 'contrast(1.4) saturate(1.2)', adjust: { bright: 12, contrast: 8, sat: 5, temp: -10 } },
  out
);
const res = spawnSync(FFMPEG, args, { encoding: 'utf8', windowsHide: true, timeout: 120000 });
if (res.status !== 0) {
  console.error((res.stderr || '').slice(-2000));
  process.exit(1);
}
assert(fs.existsSync(out) && fs.statSync(out).size > 0, 'graded export missing');
console.log('EXPORT FILTERS: OK', out);
