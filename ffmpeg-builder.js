const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const APP_DIR = __dirname;
function resolveBin(name) {
  const local = path.join(APP_DIR, 'bin', name + '.exe');
  if (fs.existsSync(local)) return local;
  const envPath = process.env['KONCUT_' + name.toUpperCase()];
  if (envPath && fs.existsSync(envPath)) return envPath;
  return 'C:\\Users\\Elmodather\\AppData\\Local\\Programs\\FFmpeg\\ffmpeg-9.0.2-essentials_build\\bin\\' + name + '.exe';
}
const FFMPEG = resolveBin('ffmpeg');
const FFPROBE = resolveBin('ffprobe');
const TEMP_DIR = path.join(APP_DIR, 'temp');

function makeThumb(filePath, kind) {
  if (kind === 'image') return filePath;
  try {
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
    const key = crypto.createHash('md5').update(filePath).digest('hex').slice(0, 12);
    const out = path.join(TEMP_DIR, `thumb_${key}.jpg`);
    if (!fs.existsSync(out)) {
      execFileSync(FFMPEG, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-ss', '0.15', '-i', filePath, '-frames:v', '1',
        '-vf', 'scale=180:100:force_original_aspect_ratio=increase,crop=180:100',
        out,
      ], { stdio: 'ignore', timeout: 8000 });
    }
    return fs.existsSync(out) ? out : null;
  } catch (e) {
    return null;
  }
}

function probeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const image = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'].includes(ext);
  try {
    const out = execFileSync(FFPROBE, [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=index,codec_type,width,height',
      '-of', 'json',
      filePath,
    ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const info = JSON.parse(out);
    const streams = info.streams || [];
    const v = streams.find((s) => s.codec_type === 'video');
    const a = streams.find((s) => s.codec_type === 'audio');
    return {
      name: path.basename(filePath),
      path: filePath,
      kind: image ? 'image' : a && !v ? 'audio' : 'video',
      duration: image ? 5 : Number(info.format?.duration || 0),
      width: v?.width || 0,
      height: v?.height || 0,
      hasAudio: !!a,
      thumb: makeThumb(filePath, image ? 'image' : 'video'),
    };
  } catch (e) {
    return {
      name: path.basename(filePath),
      path: filePath,
      kind: image ? 'image' : 'video',
      duration: image ? 5 : 0,
      width: 0,
      height: 0,
      hasAudio: false,
      thumb: image ? filePath : null,
      error: String(e.message || e),
    };
  }
}

function assTime(sec) {
  sec = Math.max(0, sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

function assColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '#ffffff');
  if (!m) return '&H00FFFFFF';
  const n = m[1].toUpperCase();
  return `&H00${n.slice(4, 6)}${n.slice(2, 4)}${n.slice(0, 2)}`;
}

function buildAss(project, textClips) {
  const W = project.width || 1920;
  const H = project.height || 1080;
  const style = `Style: Default,Cairo,72,${assColor('#ffffff')},&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,5,10,10,10,1`;
  const lines = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    style,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v)));
  const alphaHex = (v) => Math.round((1 - clamp01(v)) * 255).toString(16).padStart(2, '0').toUpperCase();
  const val = (k, key, def) => Number(k[key] ?? def);

  textClips.forEach((c) => {
    const text = String(c.text || '')
      .replace(/\{/g, '(').replace(/\}/g, ')')
      .replace(/\r/g, '').replace(/\n/g, '\\N');
    const size = Number(c.fontSize || 72);
    const color = assColor(c.color || '#ffffff');
    const bold = c.bold ? -1 : 0;
    const baseX = clamp01(c.x ?? 0.5), baseY = clamp01(c.y ?? 0.5);
    const ml = Math.round(baseX * W * 0.6);
    const mr = Math.round((1 - baseX) * W * 0.6);
    const mv = Math.round((1 - baseY) * H * 0.7);
    const kfs = (c.keyframes || []).slice().sort((a, b) => a.t - b.t);
    let anim = '';
    if (kfs.length >= 2) {
      const f = kfs[0], l = kfs[kfs.length - 1];
      const t1 = Math.max(0, f.t - c.start), t2 = Math.max(t1 + 0.01, l.t - c.start);
      anim += `\\move(${Math.round(val(f, 'x', baseX) * W)},${Math.round(val(f, 'y', baseY) * H)},` +
        `${Math.round(val(l, 'x', baseX) * W)},${Math.round(val(l, 'y', baseY) * H)},${t1.toFixed(3)},${t2.toFixed(3)})`;
    } else {
      anim += `\\pos(${Math.round(baseX * W)},${Math.round(baseY * H)})`;
    }
    const first = kfs[0] || {};
    anim += `\\fscx${Math.round(val(first, 'scale', 1) * 100)}\\fscy${Math.round(val(first, 'scale', 1) * 100)}` +
      `\\frz${val(first, 'rotation', 0).toFixed(1)}\\alpha&H${alphaHex(val(first, 'opacity', 1))}&`;
    for (let i = 0; i < kfs.length - 1; i++) {
      const a = kfs[i], b = kfs[i + 1];
      const ta = Math.max(0, a.t - c.start), tb = Math.max(ta + 0.01, b.t - c.start);
      anim += `\\t(${ta.toFixed(3)},${tb.toFixed(3)},\\fscx${Math.round(val(b, 'scale', 1) * 100)}` +
        `\\fscy${Math.round(val(b, 'scale', 1) * 100)}\\frz${val(b, 'rotation', 0).toFixed(1)}` +
        `\\alpha&H${alphaHex(val(b, 'opacity', 1))}&)`;
    }
    const custom = `{\\fs${size}\\c${color}\\b${bold}${anim}}`;
    lines.push(`Dialogue: 0,${assTime(c.start)},${assTime(c.start + c.duration)},Default,,${ml},${mr},${mv},,${custom}${text}`);
  });
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const file = path.join(TEMP_DIR, 'subs.ass');
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  return 'temp/subs.ass';
}

const MASK_KEYS = ['circle', 'rectangle', 'heart', 'star', 'triangle', 'diamond', 'linear', 'mirror'];

function clampNum(v, a, b) { return Math.max(a, Math.min(b, Number(v) || 0)); }

function maskPathFor(key) {
  return MASK_KEYS.includes(key) ? path.join(APP_DIR, 'assets', 'masks', key + '.png') : null;
}

function maskSegments(c) {
  const end = Number(c.start || 0) + Math.max(0.01, Number(c.duration || 0.1));
  const changes = (c.keyframes || []).filter((k) => k.maskShape || k.maskMode)
    .slice().sort((a, b) => a.t - b.t);
  const segs = [];
  let from = Number(c.start || 0), shape = c.mask, mode = c.maskMode || 'in';
  changes.forEach((k) => {
    if (k.t > from + 0.001 && k.t < end) { segs.push({ start: from, end: k.t, shape, mode }); from = k.t; }
    if (k.maskShape) shape = k.maskShape;
    if (k.maskMode) mode = k.maskMode;
  });
  segs.push({ start: from, end, shape, mode });
  return segs;
}

function num(v, digits = 3) { return Number(v || 0).toFixed(digits); }

function kfExpr(kfs, prop, fallback, timeOffset = 0) {
  const pts = kfs.filter((k) => k[prop] != null && Number.isFinite(Number(k[prop])))
    .map((k) => ({ t: Number(k.t), v: Number(k[prop]) }))
    .sort((a, b) => a.t - b.t);
  if (!pts.length) return num(fallback, 4);
  const tv = timeOffset ? `(t+${num(timeOffset)})` : 't';
  let expr = `if(lt(${tv},${num(pts[0].t)}),${num(pts[0].v, 4)},`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    expr += `if(lt(${tv},${num(b.t)}),${num(a.v, 4)}+(${num(b.v, 4)}-${num(a.v, 4)})*(${tv}-${num(a.t)})/${num(Math.max(0.001, b.t - a.t))},`;
  }
  return (expr + num(pts[pts.length - 1].v, 4) + ')'.repeat(pts.length)).replace(/,/g, '\\,');
}

function atempoFor(speed) {
  let s = clampNum(speed, 0.25, 4);
  const parts = [];
  while (s < 0.5) { parts.push('atempo=0.5'); s /= 0.5; }
  while (s > 2) { parts.push('atempo=2'); s /= 2; }
  parts.push('atempo=' + s.toFixed(3));
  return parts.join(',');
}

function buildFfmpegArgs(project, outputPath) {
  const W = project.width || 1920;
  const H = project.height || 1080;
  const fps = project.fps || 30;
  const duration = Math.max(0.1, Number(project.duration || 1));
  const clips = (project.tracks || []).flatMap((t) =>
    (t.clips || []).map((c) => ({ ...c, trackKind: t.kind, hidden: !!t.hidden, muted: !!t.muted }))
  );

  const mediaClips = clips.filter((c) => c.type === 'media' && c.src && !c.hidden);
  const textClips = clips.filter((c) => c.type === 'text' && c.text && !c.hidden);
  const transitions = clips.filter((c) => c.type === 'transition' && !c.hidden);

  const inputArgs = [];
  let inputIdx = 0;
  mediaClips.forEach((c) => {
    if (c.mediaKind === 'image') inputArgs.push('-loop', '1', '-framerate', String(fps));
    inputArgs.push('-i', c.src);
    c._input = inputIdx++;
  });
  const maskPlans = new Map();
  mediaClips.forEach((c) => {
    if (c.mediaKind !== 'video' && c.mediaKind !== 'image') return;
    const segs = maskSegments(c);
    segs.forEach((seg) => {
      if (!MASK_KEYS.includes(seg.shape)) return;
      const p = maskPathFor(seg.shape);
      if (!p) return;
      inputArgs.push('-loop', '1', '-framerate', String(fps), '-i', p);
      seg._maskInput = inputIdx++;
    });
    maskPlans.set(c.id, segs);
  });

  const filters = [`color=c=black:s=${W}x${H}:r=${fps}:d=${duration.toFixed(3)}[base]`];
  let lastV = 'base';

  mediaClips
    .filter((c) => c.mediaKind === 'video' || c.mediaKind === 'image')
    .forEach((c, n) => {
      const inP = Number(c.inPoint || 0);
      const dur = Math.max(0.01, Number(c.duration || 0.1));
      const speed = clampNum(c.speed || 1, 0.25, 4);
      const srcDur = dur * speed;
      const label = `v${n}`;
      const flips = [c.mirrorH ? 'hflip' : '', c.mirrorV ? 'vflip' : ''].filter(Boolean).join(',');
      filters.push(
        `[${c._input}:v]trim=start=${inP.toFixed(3)}:end=${(inP + srcDur).toFixed(3)},` +
        `setpts=(PTS-STARTPTS)/${speed.toFixed(3)},` +
        `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1` +
        `${flips ? ',' + flips : ''}[${label}]`
      );
      let finalLabel = label;
      const segs = (maskPlans.get(c.id) || []).filter((s) => s._maskInput != null);
      if (segs.length) {
        const kfs = c.keyframes || [];
        const featherVals = kfs.filter((k) => k.maskFeather != null).map((k) => Number(k.maskFeather));
        const feather = Math.max(Number(c.maskFeather || 0), 0, ...featherVals);
        if (segs.length > 1) {
          filters.push(`[${label}]split=${segs.length}[${segs.map((_, i) => `vsp${n}_${i}`).join('][')}]`);
        }
        let maskBase = label;
        segs.forEach((seg, si) => {
          const mk = `mk${n}_${si}`, vm = `vm${n}_${si}`, mo = `mo${n}_${si}`;
          const mb = `mb${n}_${si}`, sc = `ms${n}_${si}`;
          const off = seg.start;
          const scaleE = kfExpr(kfs, 'maskScale', c.maskScale ?? 1, off);
          const openE = kfExpr(kfs, 'maskOpen', c.maskOpen ?? 1, off);
          const mxE = kfExpr(kfs, 'maskX', c.maskX ?? 0.5, off);
          const myE = kfExpr(kfs, 'maskY', c.maskY ?? 0.5, off);
          const rotE = kfExpr(kfs, 'maskRotation', c.maskRotation ?? 0, off);
          filters.push(
            `[${seg._maskInput}:v]scale=w=${W}*max(0.01\\,(${scaleE}))*max(0.01\\,(${openE})):` +
            `h=${H}*max(0.01\\,(${scaleE}))*max(0.01\\,(${openE})):eval=frame[${sc}]`
          );
          filters.push(`color=c=black:s=${W}x${H}:r=${fps}:d=${Math.max(0.02, seg.end - seg.start).toFixed(3)}[${mb}]`);
          filters.push(
            `[${mb}][${sc}]overlay=x=(${W}-overlay_w)/2+(${mxE}-0.5)*${W}:y=(${H}-overlay_h)/2+(${myE}-0.5)*${H}:eval=frame,` +
            `rotate=a=(${rotE})*PI/180:ow=${W}:oh=${H}:c=black` +
            (feather > 0.001 ? `,gblur=sigma=${(feather * 12).toFixed(2)}` : '') +
            `,format=gray${seg.mode === 'out' ? ',negate' : ''}[${mk}]`
          );
          filters.push(`[${segs.length > 1 ? `vsp${n}_${si}` : label}][${mk}]alphamerge[${vm}]`);
          filters.push(
            `[${maskBase}][${vm}]overlay=0:0:enable='between(t,${num(seg.start)},${num(seg.end)})'[${mo}]`
          );
          maskBase = mo;
        });
        finalLabel = maskBase;
      }
      const out = `vo${n}`;
      filters.push(
        `[${lastV}][${finalLabel}]overlay=0:0:enable='between(t,${Number(c.start || 0).toFixed(3)},` +
        `${(Number(c.start || 0) + dur).toFixed(3)})'[${out}]`
      );
      lastV = out;
    });

  transitions.forEach((c, n) => {
    const d = Math.max(0.05, Number(c.duration || 0.5));
    const start = Math.max(0, Number(c.start || 0));
    const color = c.effect === 'white' || c.effect === 'flash' ? 'white' : c.effect === 'gray' ? 'gray' : 'black';
    const ramp = Math.min(d / 2, 0.3);
    filters.push(
      `color=c=${color}:s=${W}x${H}:r=${fps}:d=${d.toFixed(3)},format=yuva444p,` +
      `fade=t=in:st=0:d=${ramp.toFixed(3)}:alpha=1,` +
      `fade=t=out:st=${(d - ramp).toFixed(3)}:d=${ramp.toFixed(3)}:alpha=1[tr${n}]`
    );
    filters.push(
      `[${lastV}][tr${n}]overlay=0:0:enable='between(t,${start.toFixed(3)},${(start + d).toFixed(3)})'[to${n}]`
    );
    lastV = `to${n}`;
  });

  if (textClips.length) {
    const assPath = buildAss(project, textClips);
    filters.push(`[${lastV}]ass=f=${assPath}:fontsdir=assets/fonts[vo_text]`);
    lastV = 'vo_text';
  }

  const audioClips = mediaClips.filter(
    (c) => (c.mediaKind === 'audio' || (c.mediaKind === 'video' && c.hasAudio)) && !c.muted
  );
  if (audioClips.length) {
    audioClips.forEach((c, n) => {
      const inP = Number(c.inPoint || 0);
      const speed = clampNum(c.speed || 1, 0.25, 4);
      const srcDur = Math.max(0.01, Number(c.duration || 0.1)) * speed;
      const delay = Math.max(0, Math.round(Number(c.start || 0) * 1000));
      const vol = Number(c.volume ?? 1);
      const label = `a${n}`;
      filters.push(
        `[${c._input}:a]atrim=start=${inP.toFixed(3)}:end=${(inP + srcDur).toFixed(3)},asetpts=PTS-STARTPTS,` +
        `volume=${vol},${atempoFor(speed)},adelay=${delay}|${delay}[${label}]`
      );
    });
    const labels = audioClips.map((_, n) => `[a${n}]`).join('');
    filters.push(`${labels}amix=inputs=${audioClips.length}:duration=longest:normalize=0[aout]`);
  } else {
    filters.push('anullsrc=r=48000:cl=stereo[aout]');
  }

  const args = ['-hide_banner', '-y', ...inputArgs, '-filter_complex', filters.join(';')];
  args.push('-map', `[${lastV}]`, '-map', '[aout]');
  args.push(
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-t', duration.toFixed(3), '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats',
    outputPath
  );
  return args;
}

function grabFrame(filePath, time, outPath) {
  execFileSync(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', Math.max(0, Number(time) || 0).toFixed(3),
    '-i', filePath, '-frames:v', '1', '-update', '1', outPath,
  ], { cwd: APP_DIR, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  return outPath;
}

function reverseClip(filePath, start, duration, hasAudio, outPath) {
  const ss = Math.max(0, Number(start) || 0).toFixed(3);
  const d = Math.max(0.05, Number(duration) || 1).toFixed(3);
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-ss', ss, '-t', d, '-i', filePath];
  if (hasAudio) {
    args.push('-filter_complex', '[0:v]reverse,setpts=PTS-STARTPTS[v];[0:a]areverse,asetpts=PTS-STARTPTS[a]',
      '-map', '[v]', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
  } else {
    args.push('-vf', 'reverse,setpts=PTS-STARTPTS', '-an');
  }
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', outPath);
  execFileSync(FFMPEG, args, { cwd: APP_DIR, windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  return outPath;
}

module.exports = { APP_DIR, FFMPEG, FFPROBE, TEMP_DIR, probeFile, makeThumb, grabFrame, reverseClip, buildAss, buildFfmpegArgs };
