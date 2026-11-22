const { spawnSync } = require('child_process');
const { buildFfmpegArgs, FFMPEG } = require('./ffmpeg-builder');

const src = 'C:\\Users\\Elmodather\\Documents\\Default Project\\video-lab\\previews\\gov_cliff_10s_preview.mp4';
const project = {
  width: 1280, height: 720, fps: 30, duration: 2,
  tracks: [
    {
      kind: 'video', clips: [{
        type: 'media', src, mediaKind: 'video', hasAudio: true,
        start: 0, duration: 2, inPoint: 0, volume: 1,
        speed: 1.2, mask: 'circle', maskScale: 1, mirrorH: true, maskMode: 'out',
        keyframes: [
          { t: 0, maskX: 0.5, maskY: 0.5, maskRotation: 0, maskScale: 0.8, maskOpen: 0.4, maskFeather: 0 },
          { t: 1, maskShape: 'star', maskRotation: 45, maskScale: 1.2, maskOpen: 1, maskFeather: 0.1 },
          { t: 2, maskMode: 'in', maskOpen: 1 },
        ],
      }, {
        type: 'transition', name: 'تلاشي أسود', effect: 'black', start: 1.4, duration: 0.5,
      }],
    },
    {
      kind: 'audio', clips: [{
        type: 'media', src: require('path').join(__dirname, 'assets', 'sfx', 'ding.wav'), mediaKind: 'audio',
        hasAudio: true, start: 0.2, duration: 0.9, inPoint: 0, volume: 1,
      }],
    },
    {
      kind: 'text', clips: [{
        type: 'text', text: 'مرحبا بالعالم', start: 0, duration: 2,
        x: 0.5, y: 0.5, fontSize: 72, color: '#ffffff', bold: true,
        keyframes: [
          { t: 0, x: 0.5, y: 0.5, scale: 0.7, opacity: 0, rotation: 0 },
          { t: 0.5, x: 0.5, y: 0.5, scale: 1, opacity: 1, rotation: 0 },
          { t: 2, x: 0.5, y: 0.5, scale: 1, opacity: 1, rotation: 0 },
        ],
      }],
    },
  ],
};

const args = buildFfmpegArgs(project, 'temp/test-out.mp4');
console.log('ARGS:', args.join(' '));
const r = spawnSync(FFMPEG, args, { cwd: __dirname, encoding: 'utf8', maxBuffer: 1e8 });
console.log('STATUS:', r.status);
console.log((r.stderr || '').slice(-3000));
