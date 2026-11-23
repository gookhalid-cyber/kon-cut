const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { FFMPEG, APP_DIR, TEMP_DIR, buildFfmpegArgs, extractAudioPeaks } = require('./ffmpeg-builder');
const { kfExpression, ease } = require('./kf-easing');

(async () => {
  // 1. Easing must agree numerically between JS and the generated expression shape.
  assert.strictEqual(ease(0.25, 'linear'), 0.25);
  assert.strictEqual(ease(0.5, 'easeIn'), 0.25);
  assert.strictEqual(ease(0.5, 'easeOut'), 0.75);
  assert.strictEqual(ease(0.5, 'easeInOut'), 0.5);
  const expr = kfExpression([{ t: 0, volume: 0, easing: 'easeInOut' }, { t: 1, volume: 1 }], 'volume', 1, 2);
  assert(expr.includes('(t+2.000)'), 'time offset missing');
  assert(expr.includes('if(lt(') && expr.includes('\\,'), 'easing expression not FFmpeg-escaped');

  // 2. Peaks from a real WAV file.
  const src = path.join(APP_DIR, 'assets', 'sfx', 'ding.wav');
  const peaks = await extractAudioPeaks(src, 20);
  assert(peaks.length > 0, 'no peaks extracted');
  assert(peaks.some((p) => p > 0.01), 'peaks are all silent');

  // 3. Export with fades + volume keyframes.
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const out = path.join(TEMP_DIR, 'test-audio.mp4');
  const project = {
    width: 160, height: 90, fps: 10, duration: 0.6, filter: 'none',
    adjust: { bright: 0, contrast: 0, sat: 0, temp: 0 },
    tracks: [{ id: 'v', kind: 'video', clips: [{
      id: 'c', type: 'media', mediaKind: 'audio', name: 'ding', src,
      start: 0, duration: 0.6, inPoint: 0, speed: 1, hasAudio: true,
      fadeIn: 0.2, fadeOut: 0.2,
      keyframes: [{ t: 0, volume: 0.2, easing: 'easeInOut' }, { t: 0.6, volume: 1 }],
    }] }],
  };
  const args = buildFfmpegArgs(project, out);
  const joined = args.join(' ');
  assert(joined.includes('afade=t=in:st=0:d=0.200'), 'fade-in missing');
  assert(joined.includes('afade=t=out:st=0.400:d=0.200'), 'fade-out missing');
  assert(joined.includes('volume=eval=frame:volume='), 'volume keyframes missing');
  const res = spawnSync(FFMPEG, args, { encoding: 'utf8', windowsHide: true, timeout: 120000 });
  if (res.status !== 0) {
    console.error((res.stderr || '').slice(-2500));
    process.exit(1);
  }
  assert(fs.existsSync(out) && fs.statSync(out).size > 0, 'audio export missing');
  console.log('AUDIO: OK', out, 'peaks=', peaks.length);
})().catch((e) => { console.error('AUDIO ERROR:', e); process.exit(1); });
