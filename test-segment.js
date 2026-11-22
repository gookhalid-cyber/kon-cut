const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { FFMPEG, TEMP_DIR, segmentMatte } = require('./ffmpeg-builder');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
const src = path.join(TEMP_DIR, 'seg-test-src.png');
const out = path.join(TEMP_DIR, 'seg-test-matte.png');

const frame = spawnSync(FFMPEG, [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'lavfi', '-i', 'color=c=white:s=64x64:d=1', '-frames:v', '1', src,
], { encoding: 'utf8' });
if (frame.status !== 0) {
  console.error((frame.stderr || '').slice(-1000));
  process.exit(1);
}

segmentMatte({ src, out, mode: 'general', image: true, width: 64, height: 64 })
  .then(() => {
    console.log('SEGMENT:', fs.existsSync(out) ? 'OK' : 'MISSING', out);
  })
  .catch((e) => {
    console.error('SEGMENT ERROR:', e.message || e);
    process.exit(1);
  });
