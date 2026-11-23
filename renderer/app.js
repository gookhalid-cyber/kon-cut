/* Kon Cut - renderer. Original implementation inspired by the best ideas in open-source editors. */

const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toUrl = (p) => 'file:///' + String(p).replace(/\\/g, '/').replace(/ /g, '%20');

function fmtTime(sec) {
  sec = Math.max(0, Number(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

const TEXT_PRESETS = [
  { name: 'عنوان كبير', text: 'اكتب عنوانك هنا', fontSize: 96, color: '#ffffff', bold: true, x: 0.5, y: 0.5 },
  { name: 'عنوان أزرق', text: 'عنوان مميز', fontSize: 84, color: '#5ab6ff', bold: true, x: 0.5, y: 0.42 },
  { name: 'ترجمة سفلية', text: 'ترجمة بالعربية', fontSize: 52, color: '#ffffff', bold: false, x: 0.5, y: 0.85 },
  { name: 'اقتباس', text: '«اقتباس قوي»', fontSize: 64, color: '#ffd76a', bold: true, x: 0.5, y: 0.5 },
  { name: 'عدّاد', text: '100%', fontSize: 110, color: '#7bffc0', bold: true, x: 0.5, y: 0.5 },
  { name: 'تسمية صغيرة', text: 'جديد', fontSize: 40, color: '#ff8fa3', bold: true, x: 0.15, y: 0.15 },
];

const TRANSITION_PRESETS = [
  { name: 'تلاشي أسود', effect: 'black', duration: 0.6 },
  { name: 'وميض أبيض', effect: 'white', duration: 0.5 },
  { name: 'فلاش سريع', effect: 'flash', duration: 0.25 },
  { name: 'ظل رمادي', effect: 'gray', duration: 0.7 },
];

const EFFECT_PRESETS = [
  { name: 'وميض', effect: 'white', duration: 0.3 },
  { name: 'تعتيم', effect: 'black', duration: 0.5 },
  { name: 'ضباب', effect: 'gray', duration: 0.6 },
];

const FILTER_PRESETS = [
  { name: 'عادي', filter: 'none' },
  { name: 'دافئ', filter: 'sepia(0.35) saturate(1.2)' },
  { name: 'أبيض وأسود', filter: 'grayscale(1)' },
  { name: 'تباين عالي', filter: 'contrast(1.4) saturate(1.2)' },
  { name: 'بارد', filter: 'hue-rotate(180deg) saturate(0.8)' },
  { name: 'ناعم', filter: 'blur(1px) brightness(1.1)' },
];

const SFX_PRESETS = [
  { name: 'Whoosh', file: 'whoosh.wav', duration: 0.7, icon: '≋', anim: 'ico-wave' },
  { name: 'Pop', file: 'pop.wav', duration: 0.18, icon: '●', anim: 'ico-pulse' },
  { name: 'Click', file: 'click.wav', duration: 0.06, icon: '◦', anim: 'ico-pulse' },
  { name: 'Impact', file: 'impact.wav', duration: 0.5, icon: '✸', anim: 'ico-twinkle' },
  { name: 'Riser', file: 'riser.wav', duration: 1.0, icon: '↗', anim: 'ico-wave' },
  { name: 'Ding', file: 'ding.wav', duration: 0.9, icon: '♬', anim: 'ico-float' },
];

const MASK_PRESETS = [
  { name: 'دائرة', key: 'circle', icon: '●', anim: 'ico-pulse' },
  { name: 'مستطيل', key: 'rectangle', icon: '▭', anim: 'ico-wave' },
  { name: 'قلب', key: 'heart', icon: '♥', anim: 'ico-pulse' },
  { name: 'نجمة', key: 'star', icon: '★', anim: 'ico-spin' },
  { name: 'مثلث', key: 'triangle', icon: '▲', anim: 'ico-float' },
  { name: 'ماس', key: 'diamond', icon: '◆', anim: 'ico-twinkle' },
  { name: 'تدرّج', key: 'linear', icon: '◒', anim: 'ico-wave' },
  { name: 'مرآة', key: 'mirror', icon: '◉', anim: 'ico-float' },
];

const ANIM_PRESETS = [
  { name: 'دخول', key: 'in', icon: '↴' },
  { name: 'خروج', key: 'out', icon: '↰' },
  { name: 'نبضة', key: 'pulse', icon: '◎' },
  { name: 'انزلاق', key: 'slide', icon: '⇥' },
];

const KF_DEFAULT = { x: 0.5, y: 0.5, scale: 1, opacity: 1, rotation: 0 };
const MASK_KF_DEFAULT = { maskX: 0.5, maskY: 0.5, maskScale: 1, maskRotation: 0, maskOpen: 1, maskFeather: 0 };
const MASK_KF_KEYS = Object.keys(MASK_KF_DEFAULT);

const state = {
  project: {
    version: 2,
    name: 'مشروع جديد',
    width: 1920, height: 1080, fps: 30, duration: 0,
    filter: 'none', adjust: { bright: 0, contrast: 0, sat: 0, temp: 0 },
    tracks: [
      { id: uid(), kind: 'video', name: 'فيديو 1', clips: [] },
      { id: uid(), kind: 'audio', name: 'صوت 1', clips: [] },
      { id: uid(), kind: 'text', name: 'نصوص', clips: [] },
    ],
  },
  media: [], selected: null, selection: new Set(), anchorSel: null, clipboard: [], peaks: new Map(),
  markers: [], proxies: new Map(), proxyPending: new Set(), silences: [],
  time: 0, playing: false,
  zoom: 70, pxPerSec: 70, snap: true,
  activeTab: 'media', inspectorTab: 'basic',
  hoverPreview: null, hoverFilter: null, hoverText: null, hoverMask: null,
};

/* ---------- history + autosave ---------- */
let commitTimer = null;
let autosaveTimer = null;
let activeExportId = null;
let activeSegmentId = null;
let progressMode = 'export';

function updateHistoryUI() {
  const h = window.KCHistory; if (!h) return;
  const u = $('undoBtn'), r = $('redoBtn');
  if (u) { u.disabled = !h.canUndo(); u.title = h.canUndo() ? `تراجع: ${h.undoLabel()} (Ctrl+Z)` : 'تراجع (Ctrl+Z)'; }
  if (r) { r.disabled = !h.canRedo(); r.title = h.canRedo() ? `إعادة: ${h.redoLabel()} (Ctrl+Y)` : 'إعادة (Ctrl+Y)'; }
}

function commit(label = 'تعديل') {
  if (commitTimer) { clearTimeout(commitTimer); commitTimer = null; }
  window.KCHistory?.commit(state.project, label);
  clearFrameCache();
  updateHistoryUI(); scheduleAutosave();
}

function commitSoon(label = 'تعديل') {
  if (commitTimer) clearTimeout(commitTimer);
  commitTimer = setTimeout(() => {
    commitTimer = null;
    window.KCHistory?.commit(state.project, label);
    updateHistoryUI(); scheduleAutosave();
  }, 450);
}

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    window.api?.autosaveProject?.(state.project).catch(() => {});
  }, 2500);
}

function restoreHistory(snap, label) {
  if (state.playing) togglePlay();
  state.project = snap;
  state.project.filter = state.project.filter || 'none';
  state.project.adjust = state.project.adjust || { bright: 0, contrast: 0, sat: 0, temp: 0 };
  if (state.selected && !findClip(state.selected.trackId, state.selected.clipId)) state.selected = null;
  const liveKeys = new Set(allClips().map((c) => selKey(c._track.id, c.id)));
  state.selection = new Set([...state.selection].filter((k) => liveKeys.has(k)));
  state.anchorSel = null;
  state.time = clamp(state.time, 0, state.project.duration || 0);
  const ids = new Set(allClips().map((c) => c.id));
  [...audioNodes.keys()].forEach((id) => {
    if (!ids.has(id)) { const el = audioNodes.get(id); el.pause(); audioNodes.delete(id); }
  });
  updateTrackGains(); syncAdjustInputs(); highlightFilter();
  renderAll(); updateHistoryUI(); toast(label || 'تم التراجع');
}

function undo() {
  const snap = window.KCHistory?.undo(state.project);
  if (snap) restoreHistory(snap, `تراجع: ${window.KCHistory.label()}`);
  else toast('مفيش حاجة للتراجع');
}

function redo() {
  const snap = window.KCHistory?.redo(state.project);
  if (snap) restoreHistory(snap, `إعادة: ${window.KCHistory.label()}`);
  else toast('مفيش حاجة للإعادة');
}

let sfxAudio = null;
let hoverRaf = null;

const videoEls = new Map();
const imageEls = new Map();
const audioNodes = new Map();
let rafId = null, lastFrameAt = 0, toastTimer = null;

/* ---------- audio engine (Fairlight-style monitoring) ---------- */
let audioCtx = null, masterGain = null, analyser = null, vuData = null, sfxGain = null;
const trackGains = new Map();
let masterVolume = 1, masterMuted = false, outputDeviceId = '';

function ensureAudioGraph() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {}); return audioCtx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    audioCtx = new AC();
    masterGain = audioCtx.createGain(); masterGain.gain.value = masterMuted ? 0 : masterVolume;
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.75;
    vuData = new Uint8Array(analyser.fftSize);
    sfxGain = audioCtx.createGain(); sfxGain.gain.value = 0.65;
    masterGain.connect(analyser); analyser.connect(audioCtx.destination); sfxGain.connect(masterGain);
    if (outputDeviceId && typeof audioCtx.setSinkId === 'function') {
      audioCtx.setSinkId(outputDeviceId).catch(() => {});
    }
    audioCtx.resume().catch(() => {});
  } catch (e) { audioCtx = null; }
  return audioCtx;
}

function getTrackGain(trackId) {
  if (!audioCtx || !masterGain) return null;
  if (!trackGains.has(trackId)) { const g = audioCtx.createGain(); g.connect(masterGain); trackGains.set(trackId, g); }
  return trackGains.get(trackId);
}

function connectElementToAudio(el, trackId, clip) {
  if (!audioCtx || el._kcConnected) return;
  try {
    const src = audioCtx.createMediaElementSource(el);
    const clipGain = audioCtx.createGain();
    clipGain.gain.value = 1;
    // A light high-pass + compressor approximates afftdn in the browser.
    // Parameters are updated from the clip in syncAudio().
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 20;
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = 0; comp.knee.value = 30; comp.ratio.value = 1;
    src.connect(clipGain); clipGain.connect(hp); hp.connect(comp);
    comp.connect(getTrackGain(trackId) || audioCtx.destination);
    el._kcConnected = true;
    el._kcClipGain = clipGain;
    el._kcHP = hp; el._kcComp = comp;
    el.muted = false;
    el.volume = 1;
  } catch (e) { /* fallback: element plays directly */ }
}

function updateTrackGains() {
  const anySolo = state.project.tracks.some((t) => t.solo);
  state.project.tracks.forEach((t) => {
    const g = getTrackGain(t.id); if (!g || !audioCtx) return;
    const audible = !t.muted && (!anySolo || t.solo);
    g.gain.setTargetAtTime(audible ? (t.volume ?? 1) : 0, audioCtx.currentTime, 0.02);
  });
  if (masterGain && audioCtx) masterGain.gain.setTargetAtTime(masterMuted ? 0 : masterVolume, audioCtx.currentTime, 0.02);
}

function setSinkOn(el) {
  if (outputDeviceId && typeof el.setSinkId === 'function') el.setSinkId(outputDeviceId).catch(() => {});
}

async function applyOutputDevice(id) {
  outputDeviceId = id || '';
  const els = [...videoEls.values(), ...audioNodes.values()];
  if (sfxAudio) els.push(sfxAudio);
  for (const el of els) setSinkOn(el);
  if (audioCtx && typeof audioCtx.setSinkId === 'function') {
    try { await audioCtx.setSinkId(outputDeviceId || 'default'); } catch (e) { /* keep system default */ }
  }
}

async function populateAudioDevices() {
  const sel = $('deviceSel');
  try {
    const devs = await navigator.mediaDevices?.enumerateDevices?.() || [];
    const outs = devs.filter((d) => d.kind === 'audiooutput');
    if (!outs.length) { sel.innerHTML = '<option value="">الجهاز الافتراضي</option>'; return; }
    const real = outs.find((d) => /speaker|output|realtek|high definition/i.test(d.label || '') && !/virtual|audioRelay/i.test(d.label || ''));
    const good = real || outs.find((d) => d.deviceId === 'default') || outs[0];
    sel.innerHTML = '<option value="">الجهاز الافتراضي</option>' + outs.map((d, i) =>
      `<option value="${d.deviceId}">${escapeHtml(d.label || 'جهاز ' + (i + 1))}</option>`).join('');
    sel.value = good.deviceId; await applyOutputDevice(good.deviceId);
  } catch (e) { sel.innerHTML = '<option value="">الجهاز الافتراضي</option>'; }
}

function drawVuLoop() {
  requestAnimationFrame(drawVuLoop);
  const c = $('vuMeter'); if (!c) return;
  const ctx = c.getContext('2d'), w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);
  let level = 0;
  if (analyser && audioCtx) {
    analyser.getByteTimeDomainData(vuData);
    let sum = 0;
    for (let i = 0; i < vuData.length; i++) { const v = (vuData[i] - 128) / 128; sum += v * v; }
    level = Math.min(1, Math.sqrt(sum / vuData.length) * 3.2);
  } else if (state.playing) level = 0.25;
  const bars = 18, gap = 1, bw = (w - gap * (bars - 1)) / bars;
  for (let i = 0; i < bars; i++) {
    ctx.fillStyle = (i / bars) >= level ? '#242430' : i > bars * 0.88 ? '#ff5f6d' : i > bars * 0.7 ? '#ffd75e' : '#38e08a';
    ctx.fillRect(i * (bw + gap), 1, bw, h - 2);
  }
  const on = level > 0.015;
  $('audioLed').classList.toggle('on', on);
  $('audioState').textContent = masterMuted ? 'الصوت مكتوم' : on ? 'الصوت شغال' : state.playing ? 'مفيش إشارة — جرّب جهاز تاني' : 'الصوت متوقف';
}

/* ---------- model ---------- */
function allClips() { return state.project.tracks.flatMap((t) => t.clips.map((c) => ({ ...c, _track: t }))); }
function getTrack(id) { return state.project.tracks.find((t) => t.id === id); }
function findClip(trackId, clipId) { const t = getTrack(trackId); return t ? t.clips.find((c) => c.id === clipId) : null; }

function recomputeDuration() {
  let max = 0;
  allClips().forEach((c) => { max = Math.max(max, Number(c.start || 0) + Number(c.duration || 0)); });
  state.project.duration = Math.round(max * 100) / 100;
}

function makeMediaClip(media, start) {
  return {
    id: uid(), type: 'media', src: media.path, name: media.name,
    mediaKind: media.kind, hasAudio: !!media.hasAudio,
    width: media.width, height: media.height,
    start: Math.round(start * 100) / 100,
    duration: media.kind === 'image' ? 5 : Math.max(0.1, (media.duration || 5) / (media.speed || 1)),
    inPoint: 0, volume: 1, speed: media.speed || 1,
    sourceDuration: media.sourceDuration || media.duration || 5,
  };
}

function addMediaToTrack(media, start, kindHint, opts = {}) {
  const kind = kindHint || (media.kind === 'audio' ? 'audio' : 'video');
  let track = state.project.tracks.find((t) => t.kind === kind);
  if (!track) { track = { id: uid(), kind, name: kind === 'audio' ? 'صوت' : 'فيديو', clips: [] }; state.project.tracks.push(track); }
  const clip = makeMediaClip({ ...media, kind: media.kind === 'audio' || kind === 'audio' ? 'audio' : media.kind }, start);
  track.clips.push(clip);
  state.selected = { trackId: track.id, clipId: clip.id };
  recomputeDuration(); renderAll();
  if (!opts.silent) commit('إضافة مقطع');
  toast(`أُضيف: ${media.name}`);
  return clip;
}

async function freezeFrame() {
  const canvas = $('preview');
  const hasContent = !$('previewEmpty') || $('previewEmpty').style.display === 'none';
  if (!hasContent) { toast('ما فيش إطار في المعاينة لتجميده'); return; }
  try {
    let dataUrl = null, filePath = null;
    try { dataUrl = canvas.toDataURL('image/png'); filePath = await window.api.saveFrame(dataUrl); }
    catch (e) {
      const clip = activeVisualClip(state.time);
      if (!clip) throw new Error('مفيش مقطع فيديو في اللحظة دي');
      const srcTime = (clip.inPoint || 0) + (state.time - clip.start) * (clip.speed || 1);
      filePath = await window.api.grabFrame(clip.src, srcTime);
      dataUrl = toUrl(filePath);
    }
    const media = {
      name: `إطار مجمد ${fmtTime(state.time)}`, path: filePath, kind: 'image',
      duration: 3, sourceDuration: 3, hasAudio: false,
      width: canvas.width, height: canvas.height, thumb: dataUrl,
    };
    state.media.push(media);
    renderMedia();
    const clip = addMediaToTrack(media, state.time, 'video', { silent: true });
    if (clip) { clip.duration = 3; refreshTimings(); }
    commit('تجميد إطار');
    toast('❄ تم تجميد الإطار وإضافته للخط الزمني');
  } catch (e) { toast('فشل تجميد الإطار: ' + (e.message || e)); }
}

function activeVisualClip(t) {
  const list = allClips().filter((c) => c.type === 'media' && c.mediaKind !== 'audio' &&
    getTrack(c._track.id).kind === 'video' && !getTrack(c._track.id).hidden &&
    t >= c.start && t < c.start + c.duration);
  return list[list.length - 1] || null;
}

function targetVisualClip() {
  if (state.selected) {
    const c = findClip(state.selected.trackId, state.selected.clipId);
    if (c && c.type === 'media' && c.mediaKind !== 'audio') return c;
  }
  return activeVisualClip(state.time);
}

function toggleMirror(axis) {
  const c = targetVisualClip();
  if (!c) { toast('اختار مقطع فيديو أو صورة أول'); return; }
  const key = axis === 'v' ? 'mirrorV' : 'mirrorH';
  c[key] = !c[key];
  renderAll(); commit('مرآة / انعكاس');
  toast(c[key] ? (axis === 'v' ? '↕ انعكاس رأسي' : '↔ مرآة أفقية') : 'اتشال الانعكاس');
}

async function reverseSelected() {
  const c = targetVisualClip();
  if (!c) { toast('اختار مقطع فيديو أول'); return; }
  if (c.mediaKind === 'image') { toast('الصورة ملهاش عكس — جرّب مقطع فيديو'); return; }
  toast('⏳ جاري تجهيز المقطع المعكوس...');
  try {
    const srcDuration = Math.max(0.1, c.duration * (c.speed || 1));
    let out;
    try { out = await window.api.reverseClip(c.src, c.inPoint || 0, srcDuration, !!c.hasAudio); }
    catch (e) { out = await window.api.reverseClip(c.src, c.inPoint || 0, srcDuration, false); }
    const old = audioNodes.get(c.id);
    if (old) { old.pause(); audioNodes.delete(c.id); }
    c.src = out; c.inPoint = 0; c.duration = Math.round(srcDuration * 100) / 100; c.speed = 1;
    c.segMatte = null; c.segMode = null; c.segStart = null; c.segDuration = null;
    state.media.push({
      name: c.name + ' (معكوس)', path: out, kind: 'video', duration: c.duration,
      sourceDuration: c.duration, hasAudio: !!c.hasAudio, thumb: toUrl(out),
    });
    renderMedia(); renderAll(); commit('عكس المقطع'); toast('✔ اتنفّذ العكس');
  } catch (e) { toast('فشل العكس: ' + (e.message || e)); }
}

/* ---------- AI background / person isolation ---------- */
let segmentBusy = false;
let segmentClipId = null;

function segModeLabel(mode) { return mode === 'person' ? 'عزل الأشخاص' : 'عزل الخلفية'; }

function showProgress(title, setup = false) {
  $('progressTitle').textContent = title;
  $('exportModal').classList.add('show');
  $('exportSetup').classList.toggle('hidden', !setup);
  $('exportProgressBox').classList.toggle('hidden', setup);
  $('progressFill').style.width = '0%';
  $('progressText').textContent = '0%';
  progressMode = setup ? 'export-setup' : (title.includes('عزل') ? 'segment' : 'export');
}

function clearSegmentation(c) {
  if (!c || !c.segMatte) { toast('مفيش عزل مفعّل على المقطع'); return; }
  c.segMatte = null; c.segMode = null; c.segStart = null; c.segDuration = null;
  renderAll(); commit('إلغاء العزل'); toast('اتشال العزل');
}

async function applySegmentation(mode) {
  const c = targetVisualClip();
  if (!c) { toast('اختار مقطع فيديو أو صورة أول'); return; }
  if (segmentBusy) { toast('في عملية عزل شغالة بالفعل'); return; }
  segmentBusy = true; segmentClipId = c.id;
  const label = segModeLabel(mode);
  showProgress(`⏳ جاري ${label}...`);
  try {
    const image = c.mediaKind === 'image';
    const fps = state.project.fps || 30;
    const pw = state.project.width || 1920, ph = state.project.height || 1080;
    const width = Math.min(960, pw);
    const height = Math.max(2, Math.round(width * ph / pw));
    const sourceDuration = Math.max(0.1, Number(c.sourceDuration || c.duration || 1));
    const start = image ? 0 : clamp(Number(c.inPoint || 0), 0, Math.max(0, sourceDuration - 0.1));
    const duration = image ? 1 : clamp(Number(c.duration || 1) * (c.speed || 1), 0.1, Math.max(0.1, sourceDuration - start));
    const out = await window.api.segmentClip({
      src: c.src, mode, image, start, duration, fps, width, height, clipId: c.id,
    });
    if (!out) { toast('اتلغى العزل'); return; }
    c.segMatte = out; c.segMode = mode; c.segStart = start; c.segDuration = duration;
    renderAll(); commit(label); toast(`✔ تم ${label}`);
  } catch (e) {
    toast(`فشل ${label}: ${(e && e.message ? e.message : e)}`.slice(0, 300));
  } finally {
    segmentBusy = false; segmentClipId = null; activeSegmentId = null;
    $('exportModal').classList.remove('show');
    const st = $('segStatus'); if (st && c.segMatte) st.textContent = `مفعّل: ${segModeLabel(c.segMode)}`;
  }
}

function addTextClip(preset, start) {
  const track = state.project.tracks.find((t) => t.kind === 'text') || { id: uid(), kind: 'text', name: 'نصوص', clips: [] };
  if (!getTrack(track.id)) state.project.tracks.push(track);
  const clip = {
    id: uid(), type: 'text', name: preset.name, text: preset.text,
    start: Math.round((start ?? state.time) * 100) / 100, duration: preset.duration || 3,
    x: preset.x ?? 0.5, y: preset.y ?? 0.5, fontSize: preset.fontSize || 72,
    color: preset.color || '#ffffff', fontFamily: 'Cairo', bold: preset.bold ?? true,
  };
  track.clips.push(clip);
  state.selected = { trackId: track.id, clipId: clip.id };
  recomputeDuration(); renderAll(); commit('إضافة نص');
  return clip;
}

function addTransition(preset) {
  const track = state.project.tracks.find((t) => t.kind === 'video') || state.project.tracks[0];
  const clip = {
    id: uid(), type: 'transition', name: preset.name, effect: preset.effect,
    start: Math.round(state.time * 100) / 100, duration: preset.duration || 0.5,
  };
  track.clips.push(clip);
  state.selected = { trackId: track.id, clipId: clip.id };
  recomputeDuration(); renderAll(); commit('إضافة انتقال'); toast(`أُضيف انتقال: ${preset.name}`);
}

/* ---------- multi-selection & editing ---------- */
const selKey = (trackId, clipId) => `${trackId}:${clipId}`;

function selectedClips() {
  const out = [];
  state.project.tracks.forEach((t) => t.clips.forEach((c) => {
    if (state.selection.has(selKey(t.id, c.id))) out.push({ track: t, clip: c });
  }));
  if (!out.length && state.selected) {
    const t = getTrack(state.selected.trackId);
    const c = t && findClip(t.id, state.selected.clipId);
    if (c) out.push({ track: t, clip: c });
  }
  return out.filter((x) => !x.track.locked);
}

function syncSelectionUI() {
  document.querySelectorAll('.clip[data-selkey]').forEach((el) => {
    el.classList.toggle('selected', state.selection.has(el.dataset.selkey));
  });
}

function selectClip(track, clip, additive, range) {
  const key = selKey(track.id, clip.id);
  if (range && state.anchorSel) {
    const a = state.anchorSel;
    const sameTrack = a.trackId === track.id;
    const pool = sameTrack ? track.clips.map((c) => ({ track, clip: c })) : selectedClips();
    const lo = Math.min(a.start, Number(clip.start || 0)), hi = Math.max(a.start, Number(clip.start || 0));
    state.selection = new Set(pool.filter((x) => x.clip.start >= lo - 0.001 && x.clip.start <= hi + 0.001)
      .map((x) => selKey(x.track.id, x.clip.id)));
  } else if (additive) {
    if (state.selection.has(key)) state.selection.delete(key);
    else state.selection.add(key);
    state.anchorSel = { trackId: track.id, clipId: clip.id, start: clip.start };
  } else {
    state.selection = new Set([key]);
    state.anchorSel = { trackId: track.id, clipId: clip.id, start: clip.start };
  }
  if (!state.selected || !state.selection.has(selKey(state.selected.trackId, state.selected.clipId))) {
    state.selected = { trackId: track.id, clipId: clip.id };
  }
  syncSelectionUI(); renderInspector();
}

function clearSelection() {
  state.selection.clear(); state.anchorSel = null; state.selected = null;
  syncSelectionUI(); renderInspector();
}

function deleteSelected(ripple = false) {
  const items = selectedClips();
  if (!items.length) return;
  items.forEach(({ track, clip }) => {
    track.clips = track.clips.filter((c) => c.id !== clip.id);
    if (ripple) track.clips.forEach((c) => {
      if (c.start > clip.start) c.start = Math.max(0, Math.round((c.start - clip.duration) * 100) / 100);
    });
  });
  clearSelection(); recomputeDuration(); renderAll();
  commit(ripple ? 'حذف مع دفع للخلف' : 'حذف مقطع');
  toast(ripple ? 'اتحذف والخط الزمني اتقفل' : 'اتحذف المقطع');
}

function duplicateSelected() {
  const items = selectedClips();
  if (!items.length) { toast('اختار مقطع أول'); return; }
  const next = new Set();
  items.forEach(({ track, clip }) => {
    const copy = JSON.parse(JSON.stringify(clip));
    copy.id = uid();
    insertClipWithRipple(copy, track, Math.max(clip.start + clip.duration, state.time), copy.id);
    next.add(selKey(track.id, copy.id));
  });
  state.selection = next;
  const first = items[0];
  state.selected = { trackId: first.track.id, clipId: [...next][0].split(':')[1] };
  state.anchorSel = null;
  recomputeDuration(); renderAll(); commit('تكرار مقطع'); toast(`اتكرّر ${items.length} مقطع`);
}

function copySelected() {
  const items = selectedClips();
  if (!items.length) { toast('اختار مقطع أول'); return; }
  state.clipboard = items.map(({ clip }) => JSON.parse(JSON.stringify(clip)));
  toast(`اتنسخ ${items.length} مقطع`);
}

function pasteClips() {
  if (!state.clipboard.length) { toast('النسخة فاضية'); return; }
  const next = new Set(); let count = 0;
  state.clipboard.forEach((src) => {
    const kind = src.type === 'text' ? 'text' : (src.mediaKind === 'audio' ? 'audio' : 'video');
    const track = state.project.tracks.find((t) => t.kind === kind && !t.locked);
    if (!track) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid();
    insertClipWithRipple(copy, track, state.time + count * 0.05, copy.id);
    next.add(selKey(track.id, copy.id)); count++;
  });
  if (!count) { toast('مفيش مسار مناسب للصق'); return; }
  state.selection = next;
  const firstKey = [...next][0];
  state.selected = { trackId: firstKey.split(':')[0], clipId: firstKey.split(':')[1] };
  recomputeDuration(); renderAll(); commit('لصق مقاطع'); toast(`اتلصق ${count} مقطع`);
}

function moveTrack(track, dir) {
  const i = state.project.tracks.indexOf(track), j = i + dir;
  if (i < 0 || j < 0 || j >= state.project.tracks.length) return;
  const arr = state.project.tracks;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  renderAll(); commit('ترتيب المسارات');
}

function selectAll() {
  state.selection = new Set();
  state.project.tracks.forEach((t) => {
    if (!t.locked) t.clips.forEach((c) => state.selection.add(selKey(t.id, c.id)));
  });
  const first = [...state.selection][0];
  if (first) { const [tid, cid] = first.split(':'); state.selected = { trackId: tid, clipId: cid }; }
  syncSelectionUI(); renderInspector(); toast(`اتحدد ${state.selection.size} مقطع`);
}

function splitClipAt(track, c, at) {
  if (!track || !c || c.type === 'transition') return null;
  if (at <= c.start + 0.05 || at >= c.start + c.duration - 0.05) return null;
  const firstDur = at - c.start;
  const allKfs = sortedKfs(c);
  const second = { ...c, id: uid(), start: Math.round(at * 100) / 100,
    duration: Math.round((c.duration - firstDur) * 100) / 100,
    inPoint: (c.inPoint || 0) + firstDur * (c.speed || 1),
    keyframes: allKfs.filter((k) => k.t >= at) };
  c.keyframes = allKfs.filter((k) => k.t < at);
  c.duration = Math.round(firstDur * 100) / 100;
  track.clips.push(second);
  return second;
}

function splitSelected() {
  if (!state.selected) return;
  const c = findClip(state.selected.trackId, state.selected.clipId); if (!c) return;
  if (c.type === 'transition') { toast('لا يمكن تقسيم الانتقال'); return; }
  const second = splitClipAt(getTrack(state.selected.trackId), c, state.time);
  if (!second) { toast('حط رأس التشغيل جوه المقطع'); return; }
  state.selected = { trackId: state.selected.trackId, clipId: second.id };
  recomputeDuration(); renderAll(); commit('تقسيم مقطع'); toast('تم التقسيم');
}

/* ---------- keyframes & masks ---------- */
function baseKf(c) {
  const base = { ...KF_DEFAULT, x: c.type === 'text' ? Number(c.x ?? 0.5) : 0.5, y: c.type === 'text' ? Number(c.y ?? 0.5) : 0.5 };
  if (c.mask) Object.assign(base, MASK_KF_DEFAULT, {
    maskScale: Number(c.maskScale ?? 1), maskRotation: Number(c.maskRotation ?? 0),
    maskX: Number(c.maskX ?? 0.5), maskY: Number(c.maskY ?? 0.5),
    maskOpen: Number(c.maskOpen ?? 1), maskFeather: Number(c.maskFeather ?? 0),
  });
  return base;
}

function sortedKfs(c) { return [...(c.keyframes || [])].sort((a, b) => a.t - b.t); }

function discreteAt(c, t, key, fallback) {
  let v = fallback;
  sortedKfs(c).forEach((k) => { if (k.t <= t && k[key] != null) v = k[key]; });
  return v;
}

function evalKfs(c, t) {
  const base = baseKf(c);
  const kfs = sortedKfs(c);
  if (!kfs.length) return base;
  if (t <= kfs[0].t) return { ...base, ...kfs[0] };
  if (t >= kfs[kfs.length - 1].t) return { ...base, ...kfs[kfs.length - 1] };
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (t >= a.t && t <= b.t) {
      const p = (t - a.t) / Math.max(0.001, b.t - a.t);
      const eased = window.KFEasing.ease(p, a.easing);
      const out = {};
      Object.keys(base).forEach((k) => {
        out[k] = Number(a[k] ?? base[k]) + (Number(b[k] ?? base[k]) - Number(a[k] ?? base[k])) * eased;
      });
      return out;
    }
  }
  return base;
}

function kfAt(c, t) { return (c.keyframes || []).find((k) => Math.abs(k.t - t) < 0.02); }

// Audio level at an absolute timeline time, using the same easing as export.
function volumeAt(c, t) {
  const base = Number(c.volume ?? 1);
  const pts = (c.keyframes || [])
    .filter((k) => k.volume != null && Number.isFinite(Number(k.volume)))
    .map((k) => ({ t: Number(k.t), v: Number(k.volume), easing: k.easing || 'linear' }))
    .sort((a, b) => a.t - b.t);
  if (!pts.length) return base;
  if (t <= pts[0].t) return pts[0].v;
  if (t >= pts[pts.length - 1].t) return pts[pts.length - 1].v;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (t >= a.t && t <= b.t) {
      const p = (t - a.t) / Math.max(0.001, b.t - a.t);
      return a.v + (b.v - a.v) * window.KFEasing.ease(p, a.easing);
    }
  }
  return base;
}

function fadeGainAt(c, t) {
  const local = t - Number(c.start || 0);
  const dur = Math.max(0.01, Number(c.duration || 1));
  const fi = clamp(Number(c.fadeIn) || 0, 0, dur / 2);
  const fo = clamp(Number(c.fadeOut) || 0, 0, dur / 2);
  let g = 1;
  if (fi > 0 && local < fi) g *= clamp(local / fi, 0, 1);
  if (fo > 0 && local > dur - fo) g *= clamp((dur - local) / fo, 0, 1);
  return g;
}

// Peak-based normalization: the exact same gain is written into the clip and
// used by FFmpeg, so preview and export agree without loudnorm's lookahead.
function computeNormGain(c) {
  const peaks = state.peaks.get(c.src);
  if (!peaks || !peaks.length) return 1;
  const from = Math.max(0, Number(c.inPoint || 0) * PEAKS_PER_SEC);
  const span = Math.max(0.05, Number(c.duration || 1) * Number(c.speed || 1) * PEAKS_PER_SEC);
  let max = 0;
  for (let i = Math.floor(from); i < Math.min(peaks.length, Math.ceil(from + span)); i++) {
    max = Math.max(max, Number(peaks[i]) || 0);
  }
  if (max < 0.001) return 1;
  return Math.round(clamp(0.95 / max, 0.1, 4) * 1000) / 1000;
}

function normGainAt(c) { return c.normalize ? clamp(Number(c.normGain || 1), 0.1, 4) : 1; }

function refreshNormGains(src) {
  allClips().forEach((c) => {
    if (clipHasAudio(c) && c.src === src && c.normalize) c.normGain = computeNormGain(c);
  });
}

function addVolumeKeyframe(c) {
  const at = clamp(state.time, c.start, c.start + c.duration);
  let kf = kfAt(c, at);
  if (!kf) { kf = { t: Math.round(at * 100) / 100, ...evalKfs(c, at) }; (c.keyframes = c.keyframes || []).push(kf); }
  kf.volume = Number(c.volume ?? 1);
  renderAll(); commit('كي فريم للصوت'); toast('◇ اتنضاف كي فريم للصوت');
}

function addKeyframe(t) {
  if (!state.selected) { toast('اختار مقطع أول'); return; }
  const c = findClip(state.selected.trackId, state.selected.clipId); if (!c || c.type === 'transition') { toast('اختار مقطع صالح'); return; }
  c.keyframes = c.keyframes || [];
  const at = Math.max(c.start, Math.min(c.start + c.duration, t));
  const existing = kfAt(c, at);
  if (existing) { Object.assign(existing, evalKfs(c, at), { t: at }); toast('اتحدّثت النقطة المفتاحية'); }
  else { c.keyframes.push({ t: at, ...evalKfs(c, at) }); toast('أُضيفت نقطة مفتاحية'); }
  renderAll(); commit('نقطة مفتاحية');
}

function applyAnimPreset(key) {
  if (!state.selected) { toast('اختار مقطع أول'); return; }
  const c = findClip(state.selected.trackId, state.selected.clipId); if (!c || c.type === 'transition') { toast('اختار مقطع صالح'); return; }
  const s = c.start, d = c.duration, e = s + d;
  const base = evalKfs(c, s);
  const mk = (t, v) => ({ t: Math.round(t * 100) / 100, ...KF_DEFAULT, ...base, ...v });
  if (key === 'in') c.keyframes = [mk(s, { opacity: 0, scale: 0.7 }), mk(Math.min(e, s + Math.min(0.6, d * 0.4)), { opacity: 1, scale: 1 }), mk(e, {})];
  if (key === 'out') c.keyframes = [mk(s, {}), mk(Math.max(s, e - Math.min(0.6, d * 0.4)), {}), mk(e, { opacity: 0, scale: 1.15 })];
  if (key === 'pulse') c.keyframes = [mk(s, {}), mk((s + e) / 2, { scale: 1.18 }), mk(e, {})];
  if (key === 'slide') c.keyframes = [mk(s, { x: 0.25, opacity: 0 }), mk(Math.min(e, s + Math.min(0.7, d * 0.5)), { x: 0.5, opacity: 1 }), mk(e, {})];
  renderAll(); commit('أنيميشن'); toast('اتطبّق الأنيميشن');
}

function applyMask(key) {
  if (!state.selected) { toast('اختار مقطع أول'); return; }
  const c = findClip(state.selected.trackId, state.selected.clipId);
  if (!c || c.type !== 'media' || c.mediaKind === 'audio') { toast('الماسك شغال على مقاطع الفيديو والصور'); return; }
  c.mask = c.mask === key ? null : key;
  c.maskScale = c.maskScale || 1;
  c.maskMode = c.maskMode || 'in';
  renderAll(); commit('ماسك'); toast(c.mask ? `اتطبّق ماسك: ${MASK_PRESETS.find((m) => m.key === key).name}` : 'اتشال الماسك');
}

const maskImgs = new Map();
const maskAlphaCanvases = new Map();

function getMaskImg(key) {
  if (!maskImgs.has(key)) { const im = new Image(); im.src = `../assets/masks/${key}.png`; maskImgs.set(key, im); }
  return maskImgs.get(key);
}

// Mask PNGs are grayscale (white shape / black background) for FFmpeg.
// Canvas compositing needs that luminance converted into an alpha channel.
function getMaskAlpha(key) {
  if (maskAlphaCanvases.has(key)) return maskAlphaCanvases.get(key);
  const im = getMaskImg(key);
  if (!im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas');
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(im, 0, 0);
  const data = cx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const luminance = data.data[i];
    data.data[i] = 255; data.data[i + 1] = 255; data.data[i + 2] = 255;
    data.data[i + 3] = luminance;
  }
  cx.putImageData(data, 0, 0);
  maskAlphaCanvases.set(key, c);
  return c;
}

const maskTintCanvases = new Map();
function getMaskTint(key) {
  if (maskTintCanvases.has(key)) return maskTintCanvases.get(key);
  const src = getMaskAlpha(key);
  if (!src) return null;
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const cx = c.getContext('2d');
  cx.drawImage(src, 0, 0);
  cx.globalCompositeOperation = 'source-in';
  cx.fillStyle = '#5ab6ff';
  cx.fillRect(0, 0, c.width, c.height);
  maskTintCanvases.set(key, c);
  return c;
}

function maskGeometryAt(c, t, W, H) {
  const k = evalKfs(c, t);
  const mk = { ...MASK_KF_DEFAULT, ...k };
  const open = clamp(mk.maskOpen ?? 1, 0, 1);
  const scale = clamp(mk.maskScale ?? 1, 0.1, 3);
  const drawn = scale * open;
  return {
    cx: W / 2 + ((mk.maskX ?? 0.5) - 0.5) * W,
    cy: H / 2 + ((mk.maskY ?? 0.5) - 0.5) * H,
    rot: (mk.maskRotation || 0) * Math.PI / 180,
    mk, scale, open, drawn,
    w: W * drawn, h: H * drawn,
  };
}

let maskOverlayHandles = null;
let maskDrag = null;

function drawMaskOverlay(ctx, W, H, t) {
  maskOverlayHandles = null;
  if (!state.selected || state.hoverMask) return;
  const c = findClip(state.selected.trackId, state.selected.clipId);
  if (!c || c.type !== 'media' || c.mediaKind === 'audio') return;
  const track = getTrack(state.selected.trackId);
  if (!track || track.hidden || track.kind !== 'video') return;
  if (t < c.start || t >= c.start + c.duration) return;
  const shape = discreteAt(c, t, 'maskShape', c.mask);
  if (!shape) return;

  const g = maskGeometryAt(c, t, W, H);
  const cos = Math.cos(g.rot), sin = Math.sin(g.rot);
  const rp = (lx, ly) => ({ x: g.cx + lx * cos - ly * sin, y: g.cy + lx * sin + ly * cos });
  const tint = getMaskTint(shape);
  ctx.save();
  if (tint) {
    ctx.globalAlpha = 0.16;
    ctx.translate(g.cx, g.cy); ctx.rotate(g.rot);
    ctx.drawImage(tint, -g.w / 2, -g.h / 2, g.w, g.h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = 'rgba(90,182,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  const corners = [rp(-g.w / 2, -g.h / 2), rp(g.w / 2, -g.h / 2), rp(g.w / 2, g.h / 2), rp(-g.w / 2, g.h / 2)];
  ctx.beginPath();
  corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath(); ctx.stroke();
  ctx.setLineDash([]);
  const top = rp(0, -g.h / 2);
  const rotate = rp(0, -g.h / 2 - 28);
  ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(rotate.x, rotate.y); ctx.stroke();

  const handles = {
    move: { x: g.cx, y: g.cy, color: '#ffd75e' },
    scale: { ...rp(g.w / 2, 0), color: '#5ab6ff' },
    rotate: { ...rotate, color: '#7bffc0' },
    open: { ...rp(0, g.h / 2), color: '#ff8fa3' },
  };
  Object.entries(handles).forEach(([name, h]) => {
    ctx.fillStyle = h.color; ctx.strokeStyle = '#0e1015'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x, h.y, name === 'move' ? 7 : 6, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  });
  maskOverlayHandles = handles;

  ctx.font = '700 12px Cairo, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
  ctx.fillText('اسحب المقابض لتعديل الماسك', W / 2, 14);
  ctx.restore();
}

function previewPoint(e) {
  const canvas = $('preview');
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * canvas.width / Math.max(1, r.width),
    y: (e.clientY - r.top) * canvas.height / Math.max(1, r.height),
  };
}

function hitMaskHandle(p) {
  if (!maskOverlayHandles) return null;
  for (const [name, h] of Object.entries(maskOverlayHandles)) {
    if (Math.hypot(p.x - h.x, p.y - h.y) <= 14) return name;
  }
  return null;
}

function syncMaskInputs(c) {
  const values = {
    mx: c.maskX, my: c.maskY, mrot: c.maskRotation,
    msc: c.maskScale, mopen: c.maskOpen, mfeather: c.maskFeather,
  };
  Object.entries(values).forEach(([id, v]) => {
    const input = $('m_' + id);
    if (input && document.activeElement !== input) input.value = v;
    const label = $('kv_m_' + id);
    if (label && v != null) label.textContent = Number(v).toFixed(2);
  });
}

function onPreviewPointerDown(e) {
  if (e.button !== 0 || !state.selected) return;
  const handle = hitMaskHandle(previewPoint(e));
  if (!handle) return;
  const c = findClip(state.selected.trackId, state.selected.clipId);
  if (!c) return;
  const W = $('preview').width, H = $('preview').height;
  const g = maskGeometryAt(c, state.time, W, H);
  maskDrag = {
    handle, clipId: c.id, start: previewPoint(e), g,
    startVals: {
      x: g.mk.maskX ?? 0.5, y: g.mk.maskY ?? 0.5,
      scale: g.scale, open: g.open, rotation: g.mk.maskRotation || 0,
    },
  };
  e.preventDefault(); e.stopPropagation();
  try { $('preview').setPointerCapture?.(e.pointerId); } catch (err) { /* synthetic events */ }
  $('preview').style.cursor = 'grabbing';
}

function onPreviewPointerMove(e) {
  const p = previewPoint(e);
  if (!maskDrag) {
    $('preview').style.cursor = hitMaskHandle(p) ? 'grab' : 'default';
    return;
  }
  const c = findClip(state.selected.trackId, state.selected.clipId);
  if (!c || c.id !== maskDrag.clipId) return;
  const W = $('preview').width, H = $('preview').height;
  const g = maskDrag.g, s = maskDrag.startVals;
  const dx = p.x - maskDrag.start.x, dy = p.y - maskDrag.start.y;
  if (maskDrag.handle === 'move') {
    setMaskValue(c, 'maskX', clamp(s.x + dx / W, 0, 1));
    setMaskValue(c, 'maskY', clamp(s.y + dy / H, 0, 1));
  } else if (maskDrag.handle === 'scale') {
    const cos = Math.cos(g.rot), sin = Math.sin(g.rot);
    const lx = (p.x - g.cx) * cos + (p.y - g.cy) * sin;
    const sx = (maskDrag.start.x - g.cx) * cos + (maskDrag.start.y - g.cy) * sin;
    const factor = clamp(lx / Math.max(1, sx), 0.1, 3);
    const drawn = clamp(g.drawn * factor, 0.1, 3);
    setMaskValue(c, 'maskScale', clamp(drawn / Math.max(0.05, g.open), 0.1, 3));
  } else if (maskDrag.handle === 'rotate') {
    let deg = Math.atan2(p.y - g.cy, p.x - g.cx) * 180 / Math.PI + 90;
    deg = ((deg + 180) % 360 + 360) % 360 - 180;
    setMaskValue(c, 'maskRotation', Math.round(deg));
  } else if (maskDrag.handle === 'open') {
    const cos = Math.cos(g.rot), sin = Math.sin(g.rot);
    const ly = -(p.x - g.cx) * sin + (p.y - g.cy) * cos;
    const drawn = clamp(2 * ly / H, 0.1, 3);
    setMaskValue(c, 'maskOpen', clamp(drawn / Math.max(0.05, g.scale), 0, 1));
  }
  syncMaskInputs(c);
  drawPreview();
  e.preventDefault();
}

function onPreviewPointerUp() {
  if (!maskDrag) return;
  const handle = maskDrag.handle;
  maskDrag = null;
  $('preview').style.cursor = 'default';
  renderAll(); commit(`تعديل الماسك (${handle})`);
}

function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

/* ---------- tabs ---------- */
function setupTabs() {
  document.querySelectorAll('.rail-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.rail-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.activeTab = b.dataset.tab;
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
      $('tab-' + state.activeTab).classList.remove('hidden');
      const titles = { media: 'الوسائط', audio: 'الصوت', text: 'النص', transitions: 'الانتقالات', effects: 'التأثيرات', filters: 'الفلاتر', masks: 'الماسكات', adjust: 'ضبط الصورة', tools: 'الأدوات الذكية' };
      $('panelTitle').textContent = titles[state.activeTab];
      $('importBtnSide').style.display = state.activeTab === 'media' || state.activeTab === 'audio' ? 'grid' : 'none';
    });
  });
  document.querySelectorAll('.inspector-tabs button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.inspector-tabs button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active'); state.inspectorTab = b.dataset.itab; renderInspector();
    });
  });
}

function hoverOn(el) { el.classList.add('previewing'); }
function hoverOff(el) { el.classList.remove('previewing'); }

function startHoverAnim() {
  if (hoverRaf) return;
  const loop = () => { drawPreview(); hoverRaf = requestAnimationFrame(loop); };
  hoverRaf = requestAnimationFrame(loop);
}
function stopHoverAnim() {
  if (hoverRaf) { cancelAnimationFrame(hoverRaf); hoverRaf = null; }
  drawPreview();
}
function clearHoverPreviews(el) {
  if (el) hoverOff(el);
  state.hoverPreview = null; state.hoverFilter = null; state.hoverText = null; state.hoverMask = null;
  stopHoverAnim();
}

function playSfxPreview(file) {
  ensureAudioGraph();
  if (sfxAudio) { sfxAudio.pause(); sfxAudio.currentTime = 0; }
  sfxAudio = new Audio('../assets/sfx/' + file);
  sfxAudio.volume = 0.65;
  setSinkOn(sfxAudio);
  if (audioCtx && sfxGain) {
    try { const src = audioCtx.createMediaElementSource(sfxAudio); src.connect(sfxGain); } catch (e) { /* direct fallback */ }
  }
  sfxAudio.play().catch(() => {});
}

async function addSfxClip(preset) {
  const abs = await window.api.assetPath('sfx/' + preset.file);
  addMediaToTrack({
    name: preset.name + '.wav', path: abs, kind: 'audio',
    duration: preset.duration, sourceDuration: preset.duration,
    width: 0, height: 0, hasAudio: true,
  }, state.time, 'audio');
  playSfxPreview(preset.file);
}

function renderPresets() {
  $('textPresets').innerHTML = TEXT_PRESETS.map((p, i) =>
    `<div class="preset text-p" data-tp="${i}"><span class="p-icon ico-float" style="color:${p.color}">${escapeHtml(p.text.slice(0, 1))}</span><span class="p-name">${p.name}</span></div>`).join('');
  document.querySelectorAll('[data-tp]').forEach((el) => {
    el.addEventListener('mouseenter', () => { hoverOn(el); state.hoverText = TEXT_PRESETS[Number(el.dataset.tp)]; drawPreview(); });
    el.addEventListener('mouseleave', () => clearHoverPreviews(el));
    el.addEventListener('click', () => { clearHoverPreviews(el); addTextClip(TEXT_PRESETS[Number(el.dataset.tp)]); });
  });

  $('transitionPresets').innerHTML = TRANSITION_PRESETS.map((p, i) =>
    `<div class="preset" data-tr="${i}"><span class="p-icon ico-spin" style="color:#f0a13a">◈</span><span class="p-name">${p.name}</span></div>`).join('');
  document.querySelectorAll('[data-tr]').forEach((el) => {
    el.addEventListener('mouseenter', () => { hoverOn(el); state.hoverPreview = TRANSITION_PRESETS[Number(el.dataset.tr)]; startHoverAnim(); });
    el.addEventListener('mouseleave', () => clearHoverPreviews(el));
    el.addEventListener('click', () => { clearHoverPreviews(el); addTransition(TRANSITION_PRESETS[Number(el.dataset.tr)]); });
  });

  $('effectPresets').innerHTML = EFFECT_PRESETS.map((p, i) =>
    `<div class="preset" data-ef="${i}"><span class="p-icon ico-twinkle" style="color:#c06ee0">✦</span><span class="p-name">${p.name}</span></div>`).join('');
  document.querySelectorAll('[data-ef]').forEach((el) => {
    el.addEventListener('mouseenter', () => { hoverOn(el); state.hoverPreview = EFFECT_PRESETS[Number(el.dataset.ef)]; startHoverAnim(); });
    el.addEventListener('mouseleave', () => clearHoverPreviews(el));
    el.addEventListener('click', () => { clearHoverPreviews(el); addTransition(EFFECT_PRESETS[Number(el.dataset.ef)]); });
  });

  $('filterPresets').innerHTML = FILTER_PRESETS.map((p, i) =>
    `<div class="preset" data-fl="${i}"><span class="p-icon ico-float" style="color:${i === 0 ? '#fff' : '#7b6bff'}">◐</span><span class="p-name">${p.name}</span></div>`).join('');
  document.querySelectorAll('[data-fl]').forEach((el) => {
    el.addEventListener('mouseenter', () => { hoverOn(el); state.hoverFilter = FILTER_PRESETS[Number(el.dataset.fl)].filter; drawPreview(); });
    el.addEventListener('mouseleave', () => clearHoverPreviews(el));
    el.addEventListener('click', () => {
      state.project.filter = FILTER_PRESETS[Number(el.dataset.fl)].filter;
      clearHoverPreviews(el); highlightFilter();
      drawPreview(); commit('فلتر لون'); toast('تم تطبيق الفلتر على المشروع');
    });
  });

  $('sfxList').innerHTML = SFX_PRESETS.map((p, i) =>
    `<div class="preset" data-sx="${i}"><span class="p-icon ${p.anim}" style="color:#4fd6a8">${p.icon}</span><span class="p-name">${p.name}</span></div>`).join('');
  document.querySelectorAll('[data-sx]').forEach((el) => {
    el.addEventListener('mouseenter', () => { hoverOn(el); playSfxPreview(SFX_PRESETS[Number(el.dataset.sx)].file); });
    el.addEventListener('mouseleave', () => hoverOff(el));
    el.addEventListener('click', () => addSfxClip(SFX_PRESETS[Number(el.dataset.sx)]));
  });

  $('maskPresets').innerHTML = MASK_PRESETS.map((p, i) =>
    `<div class="preset" data-mk="${i}"><span class="p-icon ${p.anim}" style="color:#59d0ff">${p.icon}</span><span class="p-name">${p.name}</span></div>`).join('');
  document.querySelectorAll('[data-mk]').forEach((el) => {
    el.addEventListener('mouseenter', () => { hoverOn(el); state.hoverMask = MASK_PRESETS[Number(el.dataset.mk)].key; startHoverAnim(); });
    el.addEventListener('mouseleave', () => clearHoverPreviews(el));
    el.addEventListener('click', () => { clearHoverPreviews(el); applyMask(MASK_PRESETS[Number(el.dataset.mk)].key); });
  });
  highlightFilter();
}

/* ---------- render ---------- */
function renderAll() { renderMedia(); renderAudioMedia(); renderTexts(); renderRuler(); renderTracks(); renderInspector(); updatePlaybackUI(); drawPreview(); updateProjectTitle(); }

function updateProjectTitle() {
  $('projectTitle').innerHTML = `${escapeHtml(state.project.name || 'مشروع جديد')} <span>· 16:9 · ${state.project.fps}fps</span>`;
}

function renderMedia() {
  const grid = $('mediaGrid'); grid.innerHTML = '';
  state.media.filter((m) => m.kind !== 'audio').forEach((m, i) => {
    const item = document.createElement('div');
    item.className = 'media-item'; item.draggable = true; item.dataset.index = state.media.indexOf(m);
    const thumb = m.kind === 'audio' ? '<div class="media-thumb audio">♪</div>' : `<img class="media-thumb" src="${toUrl(m.thumb || m.path)}" alt="" />`;
    item.innerHTML = `${thumb}<div class="media-name" title="${m.name}">${m.name}</div>
      <div class="media-dur">${m.kind === 'image' ? 'صورة' : fmtTime(m.duration).slice(3)}</div>`;
    item.addEventListener('click', () => addMediaToTrack(m, state.time));
    item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(state.media.indexOf(m))); e.dataTransfer.effectAllowed = 'copy'; });
    grid.appendChild(item);
  });
  $('mediaHint').style.display = state.media.length ? 'none' : 'block';
}

function renderAudioMedia() {
  const grid = $('audioGrid'); grid.innerHTML = '';
  state.media.filter((m) => m.kind === 'audio').forEach((m) => {
    const item = document.createElement('div');
    item.className = 'media-item'; item.draggable = true; item.dataset.index = state.media.indexOf(m);
    item.innerHTML = `<div class="media-thumb audio">♪</div><div class="media-name">${m.name}</div>`;
    item.addEventListener('click', () => addMediaToTrack(m, state.time, 'audio'));
    item.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', String(state.media.indexOf(m))));
    grid.appendChild(item);
  });
}

function renderTexts() {
  const list = $('textList'); list.innerHTML = '';
  state.project.tracks.filter((t) => t.kind === 'text').forEach((t) => t.clips.forEach((c) => {
    const el = document.createElement('div'); el.className = 'text-item';
    el.innerHTML = `<span>✎ ${escapeHtml(c.text || '')}</span><small>${fmtTime(c.start).slice(3)}</small>`;
    el.addEventListener('click', () => { state.selected = { trackId: t.id, clipId: c.id }; state.time = c.start; renderInspector(); renderTracks(); updatePlaybackUI(); drawPreview(); });
    list.appendChild(el);
  }));
}

function timelineWidth() { return Math.max(1600, Math.ceil(state.project.duration * state.pxPerSec) + 400); }

function renderRuler() {
  const ruler = $('ruler'); const w = timelineWidth();
  $('timelineInner').style.width = `${126 + w}px`; ruler.style.width = `${w}px`; ruler.innerHTML = '';
  const step = state.pxPerSec >= 55 ? 1 : 2;
  for (let s = 0; s <= w / state.pxPerSec; s += step) {
    const tick = document.createElement('div'); tick.className = 'tick'; tick.style.left = `${s * state.pxPerSec}px`;
    if (s % (step * 5) === 0) tick.innerHTML = `<span>${fmtTime(s).slice(3, 8)}</span>`;
    ruler.appendChild(tick);
  }
  (state.markers || []).forEach((m) => {
    const tick = document.createElement('div');
    tick.className = 'marker-tick'; tick.style.left = `${Number(m) * state.pxPerSec}px`;
    tick.title = fmtTime(m); ruler.appendChild(tick);
  });
}

const PEAKS_PER_SEC = 20;

function clipHasAudio(c) {
  return !!c && c.type === 'media' && c.mediaKind !== 'image' && !!c.hasAudio;
}

function requestPeaks(src) {
  if (!src || state.peaks.has(src)) return;
  state.peaks.set(src, null);
  window.api?.audioPeaks?.(src).then((p) => {
    state.peaks.set(src, Array.isArray(p) ? p : []);
    refreshNormGains(src);
    document.querySelectorAll('canvas.waveform').forEach((cv) => {
      if (cv.dataset.src === src) drawWaveform(cv);
    });
  }).catch(() => { state.peaks.set(src, []); });
}

function drawWaveform(cv) {
  const peaks = state.peaks.get(cv.dataset.src);
  const w = cv.width, h = cv.height;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (!peaks || !peaks.length || !w) return;
  const inP = Number(cv.dataset.in) || 0;
  const span = Math.max(0.05, (Number(cv.dataset.dur) || 1) * (Number(cv.dataset.speed) || 1));
  ctx.fillStyle = 'rgba(255,255,255,.62)';
  for (let x = 0; x < w; x += 2) {
    const idx = Math.floor((inP + (x / w) * span) * PEAKS_PER_SEC);
    const v = peaks[idx] || 0;
    const bh = Math.max(1, Math.round(v * (h - 2)));
    ctx.fillRect(x, Math.floor((h - bh) / 2), 1, bh);
  }
}

function renderTracks() {
  const root = $('tracks'); root.innerHTML = '';
  state.project.tracks.forEach((track) => {
    const row = document.createElement('div'); row.className = 'track-row' + (track.locked ? ' locked' : '');
    const head = document.createElement('div'); head.className = 'track-head';
    const vol = track.volume ?? 1;
    head.innerHTML = `<div class="track-name">${escapeHtml(track.name)}</div><div class="track-meta">${track.clips.length} مقطع</div>
      ${track.kind !== 'text' ? `<div class="track-vol-row"><input type="range" class="track-vol" data-vol min="0" max="1.5" step="0.01" value="${vol}" title="مستوى صوت المسار" /><span class="track-vol-val">${Math.round(vol * 100)}%</span></div>` : ''}
      <div class="track-actions">
        <button class="mini-btn" data-act="mute" title="كتم المسار">${track.muted ? '🔇' : '🔈'}</button>
        <button class="mini-btn ${track.solo ? 'solo-on' : ''}" data-act="solo" title="عزل المسار (Solo)">S</button>
        <button class="mini-btn" data-act="hide">${track.hidden ? '◌' : '◉'}</button>
        <button class="mini-btn ${track.locked ? 'lock-on' : ''}" data-act="lock" title="قفل/فتح المسار">${track.locked ? '🔒' : '🔓'}</button>
        <button class="mini-btn" data-act="up" title="تحريك المسار لأعلى">▲</button>
        <button class="mini-btn" data-act="down" title="تحريك المسار لأسفل">▼</button>
        <button class="mini-btn" data-act="del">✕</button>
      </div>`;
    const volSlider = head.querySelector('[data-vol]');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        track.volume = Number(e.target.value);
        head.querySelector('.track-vol-val').textContent = Math.round(track.volume * 100) + '%';
        updateTrackGains(); drawPreview(); commitSoon('صوت المسار');
      });
      volSlider.addEventListener('change', () => commit('صوت المسار'));
    }
    head.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); const act = b.dataset.act;
      if (act === 'mute') track.muted = !track.muted;
      if (act === 'solo') track.solo = !track.solo;
      if (act === 'hide') track.hidden = !track.hidden;
      if (act === 'lock') track.locked = !track.locked;
      if (act === 'up') { moveTrack(track, -1); return; }
      if (act === 'down') { moveTrack(track, 1); return; }
      if (act === 'del' && state.project.tracks.length > 1) { state.project.tracks = state.project.tracks.filter((t) => t.id !== track.id); trackGains.delete(track.id); }
      updateTrackGains(); recomputeDuration(); renderAll(); commit('خصائص المسار');
    }));

    const lane = document.createElement('div'); lane.className = 'track-lane'; lane.dataset.trackId = track.id;
    track.clips.forEach((c) => {
      const el = document.createElement('div');
      const kind = c.type === 'text' ? 'text' : c.type === 'transition' ? 'transition' : c.mediaKind;
      el.className = `clip ${kind}${(state.selection.has(selKey(track.id, c.id)) || (state.selected && state.selected.clipId === c.id)) ? ' selected' : ''}`;
      el.dataset.selkey = selKey(track.id, c.id);
      el.style.left = `${Number(c.start || 0) * state.pxPerSec}px`;
      el.style.width = `${Math.max(kind === 'transition' ? 34 : 14, Number(c.duration || 0) * state.pxPerSec)}px`;
      if (c.type === 'media' && c.mediaKind !== 'audio') {
        const m = state.media.find((x) => x.path === c.src);
        if (m) el.style.backgroundImage = `url("${toUrl(m.thumb || m.path)}")`;
      }
      const kfDots = (c.keyframes || []).map((k) => `<i class="kf-dot" style="left:${(k.t - c.start) * state.pxPerSec}px"></i>`).join('');
      el.innerHTML = `<span class="clip-label">${escapeHtml(c.type === 'text' ? c.text : c.name || '')}</span>
        ${c.mask ? '<span class="mask-badge">◑</span>' : ''}${kfDots}
        ${c.type !== 'transition' ? '<span class="clip-handle left"></span><span class="clip-handle"></span>' : ''}`;
      if (clipHasAudio(c)) {
        const cv = document.createElement('canvas');
        cv.className = 'waveform';
        cv.dataset.src = c.src || '';
        cv.dataset.in = c.inPoint || 0;
        cv.dataset.dur = c.duration || 1;
        cv.dataset.speed = c.speed || 1;
        cv.width = Math.max(1, Math.round(Number(c.duration || 1) * state.pxPerSec));
        cv.height = 44;
        el.appendChild(cv);
        requestPeaks(c.src);
        drawWaveform(cv);
      }
      el.addEventListener('pointerdown', (e) => startClipDrag(e, track, c, el));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        selectClip(track, c, !!(e.ctrlKey || e.metaKey), !!e.shiftKey);
        renderTracks(); showCtxMenu(e);
      });
      lane.appendChild(el);
    });

    lane.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    lane.addEventListener('drop', (e) => {
      e.preventDefault(); const m = state.media[Number(e.dataTransfer.getData('text/plain'))]; if (!m) return;
      const rect = lane.getBoundingClientRect();
      const start = Math.max(0, (e.clientX - rect.left) / state.pxPerSec);
      const clip = makeMediaClip(m, start);
      if (!canDropOnTrack(clip, track)) { toast('الملف مش مناسب للمسار ده'); return; }
      track.clips.push(clip);
      insertClipWithRipple(clip, track, start, clip.id);
      state.selected = { trackId: track.id, clipId: clip.id };
      updatePlaybackUI(); renderAll(); commit('إضافة مقطع بالسحب'); toast(`أُضيف: ${m.name}`);
    });
    lane.addEventListener('pointerdown', (e) => { if (e.target === lane) { clearSelection(); renderTracks(); } });
    row.appendChild(head); row.appendChild(lane); root.appendChild(row);
  });
}

function canDropOnTrack(clip, track) {
  if (clip.type === 'media') return clip.mediaKind === 'audio' ? track.kind === 'audio' : track.kind === 'video';
  if (clip.type === 'text') return track.kind === 'text';
  if (clip.type === 'transition') return track.kind === 'video';
  return false;
}

function snapStart(raw, clip, excludeId) {
  if (!state.snap) return Math.max(0, raw);
  const edges = [0, state.time];
  state.project.tracks.forEach((t) => t.clips.forEach((c) => {
    if (c.id !== excludeId) { edges.push(c.start, Math.round((c.start + c.duration) * 100) / 100); }
  }));
  let best = raw, dist = 0.18;
  edges.forEach((edge) => {
    [raw, raw + clip.duration].forEach((pos, i) => {
      const d = Math.abs(pos - edge);
      if (d < dist) { dist = d; best = i === 0 ? edge : edge - clip.duration; }
    });
  });
  return Math.max(0, Math.round(best * 100) / 100);
}

function insertClipWithRipple(clip, track, desiredStart, excludeId) {
  const others = track.clips.filter((c) => c.id !== (excludeId || clip.id));
  const overlaps = (pos) => others.some((c) => pos < c.start + c.duration - 0.02 && pos + clip.duration > c.start + 0.02);
  let s = Math.max(0, Math.round(desiredStart * 100) / 100);
  if (state.snap) {
    const candidates = [0, state.time, ...others.flatMap((c) => [c.start, Math.round((c.start + c.duration) * 100) / 100])];
    let best = s, dist = 0.18;
    candidates.forEach((v) => { const d = Math.abs(v - s); if (d < dist) { dist = d; best = v; } });
    if (!overlaps(best)) s = Math.max(0, best);
  }
  let guard = 0;
  while (guard++ < 50) {
    const blocker = others
      .filter((c) => s < c.start + c.duration - 0.02 && s + clip.duration > c.start + 0.02)
      .sort((a, b) => a.start - b.start)[0];
    if (!blocker) break;
    const shift = Math.round((s + clip.duration - blocker.start) * 100) / 100;
    others.forEach((c) => { if (c.start >= blocker.start - 0.02) c.start = Math.round((c.start + shift) * 100) / 100; });
  }
  clip.start = Math.round(s * 100) / 100;
  track.clips = [...others, clip].sort((a, b) => a.start - b.start);
}

function startClipDrag(e, track, clip, el) {
  if (e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    selectClip(track, clip, !!(e.ctrlKey || e.metaKey), !!e.shiftKey);
    return;
  }
  if (track.locked) { toast('المسار مقفول — افتحه من زر 🔓'); return; }
  selectClip(track, clip, false, false);
  el.classList.add('dragging');

  const hit = e.target.classList;
  const mode = hit.contains('clip-handle') ? (hit.contains('left') ? 'left' : 'right') : 'move';
  const startX = e.clientX;
  const origStart = Number(clip.start || 0), origDur = Number(clip.duration || 0);
  const origIn = Number(clip.inPoint || 0);
  const origKeys = (clip.keyframes || []).map((k) => ({ ...k }));
  let targetTrack = track;
  const guide = $('snapGuide');

  const move = (ev) => {
    const delta = (ev.clientX - startX) / state.pxPerSec;
    if (mode === 'right') {
      let d = origDur + delta;
      if (clip.type === 'media' && clip.mediaKind === 'video') d = Math.min(d, Math.max(0.1, (clip.sourceDuration || 9999) - origIn));
      clip.duration = Math.max(0.1, Math.round(d * 100) / 100);
    } else if (mode === 'left') {
      let ns = Math.max(0, Math.min(origStart + origDur - 0.1, origStart + delta));
      if (clip.type === 'media' && clip.mediaKind === 'video') ns = Math.max(origStart - origIn / (clip.speed || 1), ns);
      ns = Math.round(ns * 100) / 100;
      const diff = ns - origStart;
      clip.start = ns;
      clip.duration = Math.max(0.1, Math.round((origDur - diff) * 100) / 100);
      if (clip.type === 'media') clip.inPoint = Math.max(0, Math.round((origIn + diff * (clip.speed || 1)) * 100) / 100);
      clip.keyframes = origKeys.map((k) => ({ ...k, t: Math.round((k.t + diff) * 100) / 100 }));
    } else {
      const raw = origStart + delta;
      const ns = snapStart(raw, clip, clip.id);
      clip.start = ns;
      if (ns !== Math.round(raw * 100) / 100 && ns > 0) {
        guide.style.display = 'block';
        guide.style.left = `${ns * state.pxPerSec}px`;
      } else guide.style.display = 'none';
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.track-lane');
      document.querySelectorAll('.track-lane.drop-target').forEach((n) => n.classList.remove('drop-target'));
      if (under) {
        const t = getTrack(under.dataset.trackId);
        if (t && canDropOnTrack(clip, t)) { targetTrack = t; under.classList.add('drop-target'); }
        else targetTrack = track;
      }
    }
    el.style.left = `${clip.start * state.pxPerSec}px`;
    el.style.width = `${Math.max(14, clip.duration * state.pxPerSec)}px`;
    recomputeDuration(); updatePlaybackUI();
  };

  const up = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    guide.style.display = 'none';
    document.querySelectorAll('.track-lane.drop-target').forEach((n) => n.classList.remove('drop-target'));
    el.classList.remove('dragging');
    if (mode === 'move') {
      const desired = clip.start;
      if (targetTrack.id !== track.id) {
        track.clips = track.clips.filter((c) => c.id !== clip.id);
        targetTrack.clips.push(clip);
      } else if (Math.abs(desired - origStart) < 0.25) {
        clip.start = origStart;
        targetTrack.clips.sort((a, b) => a.start - b.start);
        renderAll(); return;
      }
      insertClipWithRipple(clip, targetTrack, desired, clip.id);
      const shift = Math.round((clip.start - origStart) * 100) / 100;
      clip.keyframes = origKeys.map((k) => ({ ...k, t: Math.max(clip.start, Math.min(clip.start + clip.duration, Math.round((k.t + shift) * 100) / 100)) }));
    } else {
      clip.keyframes = (clip.keyframes || []).filter((k) => k.t >= clip.start && k.t <= clip.start + clip.duration);
    }
    recomputeDuration(); renderAll(); commit(mode === 'move' ? 'تحريك مقطع' : 'قص مقطع');
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

function drawCurveEditor(cv, easing) {
  if (!cv) return;
  const ctx = cv.getContext('2d'), w = cv.width, h = cv.height, pad = 10;
  const iw = w - pad * 2, ih = h - pad * 2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'var(--bg3)'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff18'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const x = pad + (iw * i) / 4, y = pad + (ih * i) / 4;
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
  }
  const colors = { linear: '#8b95a7', easeIn: '#ff7a59', easeOut: '#24c6dc', easeInOut: '#ffe27a' };
  window.KFEasing.EASINGS.forEach((e) => {
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const x = i / 48, y = window.KFEasing.ease(x, e);
      const px = pad + x * iw, py = h - pad - y * ih;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.strokeStyle = colors[e] || '#fff';
    ctx.lineWidth = e === easing ? 3 : 1.2;
    ctx.globalAlpha = e === easing ? 1 : 0.35;
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.font = '9px Cairo, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(window.KFEasing.EASING_LABELS[easing] || easing, pad + 2, h - 2);
}

function renderMotionInspector(c) {
  const box = $('inspector');
  const cur = evalKfs(c, state.time);
  const slider = (id, label, min, max, step, val) =>
    `<div class="field"><label>${label} <b class="kv" id="kv_${id}">${Number(val).toFixed(2)}</b></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" /></div>`;
  box.innerHTML = `<div class="inspector-title">حركة المقطع</div><div class="inspector-sub">${escapeHtml(c.name || c.text || '')}</div>
    <button class="wide-btn" id="kfAdd">＋ إضافة نقطة عند رأس التشغيل (${fmtTime(state.time).slice(3)})</button>
    <div class="section-title">أنيميشن جاهز</div>
    <div class="preset-grid">${ANIM_PRESETS.map((p) => `<div class="preset" data-an="${p.key}"><span class="p-icon ico-float">${p.icon}</span><span class="p-name">${p.name}</span></div>`).join('')}</div>
    <div class="section-title">القيم عند رأس التشغيل</div>
    ${slider('kf_x', 'أفقي', 0, 1, 0.01, cur.x)}
    ${slider('kf_y', 'رأسي', 0, 1, 0.01, cur.y)}
    ${slider('kf_scale', 'الحجم', 0.2, 3, 0.01, cur.scale)}
    ${slider('kf_rot', 'دوران', -180, 180, 1, cur.rotation)}
    ${slider('kf_op', 'شفافية', 0, 1, 0.01, cur.opacity)}
    <div class="section-title">منحنى الانتقال</div>
    <canvas id="curveEditor" class="curve-editor" width="220" height="90" title="اضغط على المنحنى اللي عايزه — بيغيّر الانتقال من النقطة المختارة لللي بعدها"></canvas>
    <div class="curve-legend">${window.KFEasing.EASINGS.map((e) => `<span data-curve="${e}">${window.KFEasing.EASING_LABELS[e]}</span>`).join('')}</div>
    <div class="section-title">النقاط المفتاحية (${(c.keyframes || []).length})</div>
    <div class="kf-list">${sortedKfs(c).map((k, i) => `<div class="kf-item">
      <span class="kf-time" data-kfgo="${i}" title="اذهب للنقطة">${fmtTime(k.t).slice(3)}</span>
      <select class="kf-easing" data-kfeasing="${i}" title="منحنى الانتقال من النقطة دي لللي بعدها">
        ${window.KFEasing.EASINGS.map((e) => `<option value="${e}" ${(k.easing || 'linear') === e ? 'selected' : ''}>${window.KFEasing.EASING_LABELS[e]}</option>`).join('')}
      </select>
      <button class="mini-btn" data-kfdel="${i}">✕</button>
    </div>`).join('') || '<div class="inspector-sub">ما فيش نقاط — اضغط «إضافة نقطة»</div>'}</div>`;

  $('kfAdd').addEventListener('click', () => addKeyframe(state.time));
  const activeKf = sortedKfs(c).find((k) => k.t >= state.time - 0.02) || sortedKfs(c)[0];
  const activeEasing = (activeKf && activeKf.easing) || 'linear';
  const curveCv = $('curveEditor');
  drawCurveEditor(curveCv, activeEasing);
  const pickCurve = (easing) => {
    const k = sortedKfs(c).find((x) => x.t >= state.time - 0.02) || sortedKfs(c)[0];
    if (!k) { toast('ضيف نقطة مفتاحية الأول'); return; }
    k.easing = easing; drawCurveEditor(curveCv, easing);
    document.querySelectorAll('[data-kfeasing]').forEach((el) => {
      if (el.closest('.kf-item')?.querySelector('.kf-time')?.textContent === fmtTime(k.t).slice(3)) el.value = easing;
    });
    drawPreview(); commit('منحنى كي فريم');
  };
  curveCv?.addEventListener('pointerdown', (e) => {
    const r = curveCv.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1);
    const y = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    let best = 'linear', dist = Infinity;
    window.KFEasing.EASINGS.forEach((name) => {
      const d = Math.abs(window.KFEasing.ease(x, name) - y);
      if (d < dist) { dist = d; best = name; }
    });
    pickCurve(best);
  });
  document.querySelectorAll('[data-curve]').forEach((el) => el.addEventListener('click', () => pickCurve(el.dataset.curve)));
  document.querySelectorAll('[data-an]').forEach((el) => el.addEventListener('click', () => applyAnimPreset(el.dataset.an)));
  document.querySelectorAll('[data-kfgo]').forEach((el) => el.addEventListener('click', () => {
    const k = sortedKfs(c)[Number(el.dataset.kfgo)]; if (k) setTime(k.t);
  }));
  document.querySelectorAll('[data-kfeasing]').forEach((el) => el.addEventListener('change', (e) => {
    const k = sortedKfs(c)[Number(el.dataset.kfeasing)];
    if (k) { k.easing = e.target.value; drawPreview(); commit('منحنى كي فريم'); }
  }));
  document.querySelectorAll('[data-kfdel]').forEach((el) => el.addEventListener('click', () => {
    const idx = Number(el.dataset.kfdel); const k = sortedKfs(c)[idx];
    c.keyframes = (c.keyframes || []).filter((x) => x !== k); renderAll(); commit('حذف نقطة مفتاحية');
  }));
  const bindKf = (id, key) => {
    $(id).addEventListener('input', (e) => {
      const v = Number(e.target.value); $('kv_' + id).textContent = v.toFixed(2);
      let k = kfAt(c, state.time);
      if (!k) { k = { t: state.time, ...evalKfs(c, state.time) }; (c.keyframes = c.keyframes || []).push(k); }
      k[key] = v; drawPreview(); commitSoon('نقطة مفتاحية');
    });
    $(id).addEventListener('change', () => { renderAll(); commit('نقطة مفتاحية'); });
  };
  bindKf('kf_x', 'x'); bindKf('kf_y', 'y'); bindKf('kf_scale', 'scale'); bindKf('kf_rot', 'rotation'); bindKf('kf_op', 'opacity');
}

function maskSlider(id, label, min, max, step, value, prop) {
  return `<div class="field"><label>${label} <b class="kv" id="kv_m_${id}">${Number(value).toFixed(2)}</b><button class="kf-mini" data-mkf="${prop}" title="إضافة كي فريم">◇</button></label>
    <input type="range" id="m_${id}" min="${min}" max="${max}" step="${step}" value="${value}" /></div>`;
}

function setMaskValue(c, prop, value) {
  c[prop] = value;
  const kf = kfAt(c, state.time);
  if (kf) kf[prop] = value;
}

function addMaskKeyframe(c, prop) {
  const at = clamp(state.time, c.start, c.start + c.duration);
  let kf = kfAt(c, at);
  if (!kf) { kf = { t: Math.round(at * 100) / 100, ...evalKfs(c, at) }; c.keyframes = c.keyframes || []; c.keyframes.push(kf); }
  kf[prop] = c[prop];
  renderAll(); commit('كي فريم للماسك'); toast('◇ اتنضاف كي فريم للماسك');
}

function renderInspector() {
  const box = $('inspector');
  const note = '';
  if (!state.selected) { box.innerHTML = note + '<div class="empty-inspector">اختر مقطعاً من الخط الزمني لتعديل خصائصه</div>'; return; }
  const c = findClip(state.selected.trackId, state.selected.clipId); if (!c) { box.innerHTML = note; return; }
  const track = getTrack(state.selected.trackId);
  if (state.inspectorTab === 'motion' && c.type !== 'transition') { renderMotionInspector(c); return; }

  if (c.type === 'transition') {
    box.innerHTML = note + `<div class="inspector-title">${escapeHtml(c.name)}</div><div class="inspector-sub">انتقال</div>
      <div class="field-row"><div class="field"><label>البداية (ث)</label><input type="number" id="f_start" min="0" step="0.01" value="${c.start}" /></div>
      <div class="field"><label>المدة (ث)</label><input type="number" id="f_dur" min="0.1" step="0.01" value="${c.duration}" /></div></div>`;
    $('f_start').addEventListener('input', (e) => { c.start = Math.max(0, Number(e.target.value)); refreshTimings(); commitSoon('توقيت انتقال'); });
    $('f_dur').addEventListener('input', (e) => { c.duration = Math.max(0.1, Number(e.target.value)); refreshTimings(); commitSoon('توقيت انتقال'); });
    return;
  }

  if (c.type === 'text') {
    box.innerHTML = note + `<div class="inspector-title">نص</div><div class="inspector-sub">${track.name}</div>
      <div class="field"><label>المحتوى</label><textarea id="f_text">${escapeHtml(c.text)}</textarea></div>
      <div class="section-title">المظهر</div>
      <div class="field-row"><div class="field"><label>الحجم</label><input type="number" id="f_size" min="12" max="300" value="${c.fontSize}" /></div>
      <div class="field"><label>اللون</label><input type="color" id="f_color" value="${c.color}" /></div></div>
      <div class="field-row"><div class="field"><label>أفقي</label><input type="number" id="f_x" min="0" max="1" step="0.01" value="${c.x}" /></div>
      <div class="field"><label>رأسي</label><input type="number" id="f_y" min="0" max="1" step="0.01" value="${c.y}" /></div></div>
      <label style="font-size:10px;color:var(--dim)"><input type="checkbox" id="f_bold" ${c.bold ? 'checked' : ''} /> عريض</label>
      <div class="section-title">التوقيت</div>
      <div class="field-row"><div class="field"><label>البداية (ث)</label><input type="number" id="f_start" min="0" step="0.01" value="${c.start}" /></div>
      <div class="field"><label>المدة (ث)</label><input type="number" id="f_dur" min="0.1" step="0.01" value="${c.duration}" /></div></div>`;
    const bind = (id, key, cast) => $(id).addEventListener('input', (e) => {
      c[key] = cast ? cast(e.target.value) : e.target.value;
      if (key === 'x' || key === 'y') c[key] = clamp(c[key], 0, 1);
      refreshTimings(); drawPreview(); commitSoon('تعديل نص');
    });
    ['f_text', 'f_size', 'f_color', 'f_x', 'f_y', 'f_start', 'f_dur'].forEach((id) => {
      $(id).addEventListener('change', () => commit('تعديل نص'));
    });
    bind('f_text', 'text'); bind('f_size', 'fontSize', Number); bind('f_color', 'color');
    bind('f_x', 'x', Number); bind('f_y', 'y', Number); bind('f_start', 'start', Number); bind('f_dur', 'duration', Number);
    $('f_bold').addEventListener('change', (e) => { c.bold = e.target.checked; drawPreview(); commit('تعديل نص'); });
    return;
  }

  box.innerHTML = note + `<div class="inspector-title">${escapeHtml(c.name || 'مقطع')}</div><div class="inspector-sub">${track.name} · ${c.mediaKind}</div>
    <div class="field"><label>المسار</label><select id="f_track">${state.project.tracks.filter((t) => t.kind !== 'text').map((t) => `<option value="${t.id}" ${t.id === track.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div>
    <div class="section-title">التوقيت</div>
    <div class="field-row"><div class="field"><label>البداية (ث)</label><input type="number" id="f_start" min="0" step="0.01" value="${c.start}" /></div>
    <div class="field"><label>المدة (ث)</label><input type="number" id="f_dur" min="0.1" step="0.01" value="${c.duration}" /></div></div>
    <div class="field"><label>نقطة الدخول (ث)</label><input type="number" id="f_in" min="0" step="0.01" value="${c.inPoint || 0}" /></div>
    ${clipHasAudio(c) ? `<div class="field"><label>الصوت <button class="kf-mini" id="kfVol" title="كي فريم لمستوى الصوت">◇</button></label><input type="range" id="f_vol" min="0" max="2" step="0.05" value="${c.volume ?? 1}" /></div>
    <div class="field-row"><div class="field"><label>تلاشي الدخول (ث)</label><input type="number" id="f_fadein" min="0" max="${Math.round(c.duration / 2)}" step="0.05" value="${c.fadeIn || 0}" /></div>
      <div class="field"><label>تلاشي الخروج (ث)</label><input type="number" id="f_fadeout" min="0" max="${Math.round(c.duration / 2)}" step="0.05" value="${c.fadeOut || 0}" /></div></div>
      <div class="field-row"><label class="check-field"><input type="checkbox" id="f_normalize" ${c.normalize ? 'checked' : ''} /> تطبيع مستوى الصوت</label>
        <label class="check-field"><input type="checkbox" id="f_denoise" ${c.denoise ? 'checked' : ''} /> تقليل الضوضاء</label></div>
      <div class="hint mini-hint">التطبيع بيحسب جهد ثابت من قمم الصوت — المعاينة والتصدير متطابقين. تقليل الضوضاء تقريبي في المعاينة.</div>` : ''}
    <div class="section-title">السرعة والماسك</div>
    <div class="field-row"><div class="field"><label>السرعة ×</label><input type="number" id="f_speed" min="0.25" max="4" step="0.05" value="${c.speed || 1}" /></div>
      <div class="field"><label>حجم الماسك</label><input type="number" id="f_mscale" min="0.4" max="1.6" step="0.05" value="${c.maskScale || 1}" /></div></div>
    <div class="speed-btns"><button class="mini-btn" data-sp="0.5">0.5×</button><button class="mini-btn" data-sp="1">1×</button><button class="mini-btn" data-sp="2">2×</button></div>
    ${c.mediaKind !== 'audio' ? `
    <div class="section-title">عزل الذكاء — خلفية / أشخاص</div>
    <div class="seg-btns">
      <button class="mini-btn ${c.segMode === 'general' ? 'on' : ''}" id="inspSegGeneral">🪄 عزل خلفية</button>
      <button class="mini-btn ${c.segMode === 'person' ? 'on' : ''}" id="inspSegPerson">🧍 عزل أشخاص</button>
      <button class="mini-btn" id="inspSegClear">✕ إلغاء</button>
    </div>
    <div class="seg-status" id="segStatus">${c.segMatte ? `مفعّل: ${segModeLabel(c.segMode)}` : 'بدون عزل — اختار زرار للتشغيل'}</div>
    <div class="seg-btns">
      <button class="mini-btn" id="pickBg">🖼 اختيار خلفية</button>
      <button class="mini-btn" id="clearBg">✕ إزالة الخلفية</button>
    </div>
    <div class="field-row">
      <div class="field"><label>نعومة حافة العزل (px)</label><input type="number" id="f_edge" min="0" max="12" step="0.5" value="${c.edgeFeather || 0}" /></div>
      <label class="check-field"><input type="checkbox" id="f_smooth" ${c.matteSmooth ? 'checked' : ''} /> تنعيم زمني</label>
    </div>
    <div class="section-title">الماسك — شكل / اتجاه / حجم / فتح وقفل</div>
    <div class="field-row">
      <div class="field"><label>الشكل <button class="kf-mini" data-mkf="maskShape" title="كي فريم للشكل">◇</button></label>
        <select id="f_mask"><option value="">بدون</option>${MASK_PRESETS.map((m) => `<option value="${m.key}" ${c.mask === m.key ? 'selected' : ''}>${m.name}</option>`).join('')}</select></div>
      <div class="field"><label>الاتجاه <button class="kf-mini" data-mkf="maskMode" title="كي فريم للاتجاه">◇</button></label>
        <select id="f_maskMode"><option value="in" ${(c.maskMode || 'in') === 'in' ? 'selected' : ''}>داخل (IN)</option><option value="out" ${c.maskMode === 'out' ? 'selected' : ''}>خارج (OUT)</option></select></div>
    </div>
    <div class="mask-controls">
      ${maskSlider('mx', 'موضع أفقي', 0, 1, 0.01, c.maskX ?? 0.5, 'maskX')}
      ${maskSlider('my', 'موضع رأسي', 0, 1, 0.01, c.maskY ?? 0.5, 'maskY')}
      ${maskSlider('mrot', 'الاتجاه °', -180, 180, 1, c.maskRotation ?? 0, 'maskRotation')}
      ${maskSlider('msc', 'الحجم', 0.2, 2, 0.01, c.maskScale ?? 1, 'maskScale')}
      ${maskSlider('mopen', 'فتح / قفل', 0, 1, 0.01, c.maskOpen ?? 1, 'maskOpen')}
      ${maskSlider('mfeather', 'نعومة الحافة', 0, 1, 0.01, c.maskFeather ?? 0, 'maskFeather')}
    </div>` : ''}
    <div class="section-title">معلومات</div><div class="inspector-sub">${c.width ? `${c.width}×${c.height}` : ''} ${c.hasAudio ? '· يوجد صوت' : ''}</div>`;
  $('f_track').addEventListener('change', (e) => {
    const dest = getTrack(e.target.value); track.clips = track.clips.filter((x) => x.id !== c.id); dest.clips.push(c);
    state.selected.trackId = dest.id; renderAll(); commit('نقل مقطع لمسار');
  });
  $('f_start').addEventListener('input', (e) => { c.start = Math.max(0, Number(e.target.value)); refreshTimings(); drawPreview(); commitSoon('توقيت مقطع'); });
  $('f_dur').addEventListener('input', (e) => { c.duration = Math.max(0.1, Number(e.target.value)); refreshTimings(); drawPreview(); commitSoon('توقيت مقطع'); });
  $('f_in').addEventListener('input', (e) => { c.inPoint = Math.max(0, Number(e.target.value)); drawPreview(); commitSoon('نقطة دخول'); });
  $('f_vol')?.addEventListener('input', (e) => { c.volume = Number(e.target.value); commitSoon('صوت مقطع'); });
  ['f_start', 'f_dur', 'f_in', 'f_vol'].forEach((id) => $(id)?.addEventListener('change', () => commit('خصائص مقطع')));
  [['f_fadein', 'fadeIn'], ['f_fadeout', 'fadeOut']].forEach(([id, key]) => {
    const el = $(id); if (!el) return;
    el.addEventListener('input', (e) => { c[key] = clamp(Number(e.target.value) || 0, 0, c.duration / 2); commitSoon('تلاشي صوت'); });
    el.addEventListener('change', () => commit('تلاشي صوت'));
  });
  $('kfVol')?.addEventListener('click', () => addVolumeKeyframe(c));
  $('f_normalize')?.addEventListener('change', (e) => {
    c.normalize = e.target.checked;
    if (c.normalize) { c.normGain = computeNormGain(c); if (c.normGain === 1) requestPeaks(c.src); }
    renderAll(); commit('تطبيع الصوت');
    toast(c.normalize ? `تطبيع ×${c.normGain}` : 'اتلغى التطبيع');
  });
  $('f_denoise')?.addEventListener('change', (e) => {
    c.denoise = e.target.checked; renderAll(); commit('تقليل الضوضاء');
  });
  const setSpeed = (v) => {
    c.speed = clamp(Number(v) || 1, 0.25, 4);
    if (c.mediaKind !== 'image') c.duration = Math.max(0.1, Math.round(((c.sourceDuration || 5) / c.speed) * 100) / 100);
    refreshTimings(); drawPreview();
  };
  $('f_speed').addEventListener('change', (e) => { setSpeed(e.target.value); commit('سرعة المقطع'); });
  document.querySelectorAll('[data-sp]').forEach((b) => b.addEventListener('click', () => { setSpeed(b.dataset.sp); renderInspector(); commit('سرعة المقطع'); }));
  if ($('f_mscale')) {
    $('f_mscale').addEventListener('input', (e) => { c.maskScale = clamp(Number(e.target.value) || 1, 0.4, 1.6); drawPreview(); commitSoon('حجم الماسك'); });
    $('f_mscale').addEventListener('change', () => commit('حجم الماسك'));
  }
  if ($('f_mask')) $('f_mask').addEventListener('change', (e) => {
    c.mask = e.target.value || null;
    const kf = kfAt(c, state.time); if (kf) kf.maskShape = c.mask;
    renderTracks(); drawPreview(); commit('شكل الماسك');
  });
  if ($('f_maskMode')) $('f_maskMode').addEventListener('change', (e) => {
    c.maskMode = e.target.value;
    const kf = kfAt(c, state.time); if (kf) kf.maskMode = c.maskMode;
    drawPreview(); commit('اتجاه الماسك');
  });
  const maskInputs = [
    ['m_mx', 'maskX', 'mx'], ['m_my', 'maskY', 'my'], ['m_mrot', 'maskRotation', 'mrot'],
    ['m_msc', 'maskScale', 'msc'], ['m_mopen', 'maskOpen', 'mopen'], ['m_mfeather', 'maskFeather', 'mfeather'],
  ];
  maskInputs.forEach(([id, prop, short]) => {
    const input = $(id); if (!input) return;
    input.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      setMaskValue(c, prop, v);
      const label = $('kv_m_' + short); if (label) label.textContent = v.toFixed(2);
      drawPreview(); commitSoon('خصائص الماسك');
    });
    input.addEventListener('change', () => commit('خصائص الماسك'));
  });
  if ($('inspSegGeneral')) $('inspSegGeneral').addEventListener('click', () => applySegmentation('general'));
  if ($('inspSegPerson')) $('inspSegPerson').addEventListener('click', () => applySegmentation('person'));
  if ($('inspSegClear')) $('inspSegClear').addEventListener('click', () => clearSegmentation(c));
  if ($('pickBg')) $('pickBg').addEventListener('click', async () => {
    const items = await window.api.openMedia(); const m = items && items[0];
    if (!m || m.error) return;
    c.bgSrc = m.path; c.bgKind = m.kind === 'image' ? 'image' : 'video';
    renderAll(); commit('تغيير الخلفية'); toast('اتضافت الخلفية — العزل لازم يكون مفعّل');
  });
  if ($('clearBg')) $('clearBg').addEventListener('click', () => {
    c.bgSrc = null; c.bgKind = null; renderAll(); commit('إزالة الخلفية');
  });
  if ($('f_edge')) $('f_edge').addEventListener('input', (e) => {
    c.edgeFeather = clamp(Number(e.target.value) || 0, 0, 12); drawPreview(); commitSoon('نعومة الحافة');
  });
  if ($('f_smooth')) $('f_smooth').addEventListener('change', (e) => {
    c.matteSmooth = e.target.checked; drawPreview(); commit('تنعيم زمني');
  });
  document.querySelectorAll('[data-mkf]').forEach((b) => b.addEventListener('click', () => addMaskKeyframe(c, b.dataset.mkf)));
}

function refreshTimings() { recomputeDuration(); renderTracks(); renderRuler(); updatePlaybackUI(); }

/* ---------- preview ---------- */
function requestProxy(src) {
  if (!src || state.proxies.has(src) || state.proxyPending.has(src)) return;
  state.proxyPending.add(src);
  window.api?.proxyFor?.(src).then((p) => {
    if (p && p !== src) { state.proxies.set(src, p); drawPreview(); }
  }).catch(() => {}).finally(() => state.proxyPending.delete(src));
}

function videoSourceFor(src) { return state.proxies.get(src) || src; }

function getVideo(src) {
  requestProxy(src);
  const use = videoSourceFor(src);
  if (!videoEls.has(use)) {
    const v = document.createElement('video'); v.src = toUrl(use); v.muted = true; v.playsInline = true; v.preload = 'auto';
    setSinkOn(v); videoEls.set(use, v);
  }
  return videoEls.get(use);
}
function getImage(src) {
  if (!imageEls.has(src)) { const im = new Image(); im.src = toUrl(src); imageEls.set(src, im); }
  return imageEls.get(src);
}

// Seek to the nearest real frame (proxies are all-keyframe) and redraw only
// once the decoded frame has actually been presented.
function seekVideo(v, target, done) {
  const tol = Math.max(0.02, 0.5 / (state.project.fps || 30));
  if (v.seeking || Math.abs(v.currentTime - target) <= tol) return false;
  v.currentTime = clamp(target, 0, Math.max(0, (v.duration || target + 1) - tol));
  if (typeof v.requestVideoFrameCallback === 'function') {
    v.requestVideoFrameCallback(() => { if (!state.playing) done(); });
  } else {
    v.addEventListener('seeked', () => { if (!state.playing) done(); }, { once: true });
  }
  return true;
}

const frameCache = new Map();
function cachedFrame(el, key) {
  if (state.playing || !el || !el.videoWidth) return el;
  if (frameCache.has(key)) return frameCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = el.videoWidth; cv.height = el.videoHeight;
  cv.getContext('2d').drawImage(el, 0, 0);
  frameCache.set(key, cv);
  if (frameCache.size > 120) frameCache.delete(frameCache.keys().next().value);
  return cv;
}
function clearFrameCache() { frameCache.clear(); }

function getSegMatte(c, target) {
  if (!c.segMatte) return null;
  if (c.mediaKind === 'image') return { source: getImage(c.segMatte), time: 0 };
  const v = getVideo(c.segMatte);
  return { source: v, time: Math.max(0, target - Number(c.segStart ?? c.inPoint ?? 0)) };
}

function getBgSource(c, target) {
  if (!c.bgSrc) return null;
  if (c.bgKind === 'image' || /\.(png|jpe?g|webp|bmp)$/i.test(c.bgSrc)) {
    return { source: getImage(c.bgSrc), time: 0 };
  }
  const v = getVideo(c.bgSrc);
  return { source: v, time: Math.max(0, target - Number(c.start || 0)) };
}

function getAudioNode(c) {
  if (!audioNodes.has(c.id)) {
    const el = c.mediaKind === 'video' ? getVideo(c.src) : new Audio(toUrl(c.src));
    if (c.mediaKind !== 'video') { el.preload = 'auto'; setSinkOn(el); }
    el.muted = true;
    connectElementToAudio(el, c._track?.id, c);
    audioNodes.set(c.id, el);
  }
  return audioNodes.get(c.id);
}

function pauseAllAudio() {
  audioNodes.forEach((el) => {
    el.pause();
    if (el._kcClipGain && audioCtx) el._kcClipGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
    else el.muted = true;
  });
}

function syncAudio(t, all) {
  const active = all.filter((c) => c.type === 'media' && c.mediaKind !== 'image' &&
    !getTrack(c._track.id).hidden && t >= c.start && t < c.start + c.duration);
  const activeIds = new Set(active.map((c) => c.id));
  audioNodes.forEach((el, id) => {
    if (!activeIds.has(id)) { el.pause(); el.muted = true; }
  });
  const anySolo = state.project.tracks.some((tr) => tr.solo);
  active.forEach((c) => {
    const el = getAudioNode(c);
    connectElementToAudio(el, c._track?.id, c);
    const target = (c.inPoint || 0) + (t - c.start);
    const tr = getTrack(c._track.id);
    const audible = !tr.muted && (!anySolo || tr.solo);
    const shouldHear = c.hasAudio && audible;
    const level = clamp(volumeAt(c, t) * fadeGainAt(c, t) * normGainAt(c), 0, 2);
    if (audioCtx && el._kcHP && el._kcComp) {
      el._kcHP.frequency.setTargetAtTime(c.denoise ? 140 : 20, audioCtx.currentTime, 0.05);
      el._kcComp.threshold.setTargetAtTime(c.denoise ? -38 : 0, audioCtx.currentTime, 0.05);
      el._kcComp.ratio.setTargetAtTime(c.denoise ? 6 : 1, audioCtx.currentTime, 0.05);
      el._kcComp.knee.setTargetAtTime(c.denoise ? 6 : 30, audioCtx.currentTime, 0.05);
    }
    if (el._kcConnected && el._kcClipGain && audioCtx) {
      el._kcClipGain.gain.setTargetAtTime(shouldHear ? level : 0, audioCtx.currentTime, 0.02);
    } else {
      const trVol = audioCtx ? 1 : (tr.volume ?? 1);
      el.volume = clamp(level * trVol, 0, 2);
      el.muted = !shouldHear || !state.playing;
    }
    if (state.playing) {
      const drift = Math.abs(el.currentTime - target);
      if (el.paused || drift > 0.4) {
        el.currentTime = clamp(target, 0, Math.max(0, (el.duration || target + 1) - 0.05));
      }
      if (el.paused) el.play().catch(() => {});
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - target) > 0.15) el.currentTime = target;
    }
  });
}
function drawCover(ctx, el, W, H) {
  const sw = el.videoWidth || el.naturalWidth, sh = el.videoHeight || el.naturalHeight;
  if (!sw || !sh) return;
  const scale = Math.max(W / sw, H / sh), dw = sw * scale, dh = sh * scale;
  ctx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

const fxCanvas = document.createElement('canvas');
const fxCtx = fxCanvas.getContext('2d');
let sampleCanvas = null;

function getSampleCanvas(W, H) {
  if (sampleCanvas && sampleCanvas.width === W && sampleCanvas.height === H) return sampleCanvas;
  sampleCanvas = document.createElement('canvas'); sampleCanvas.width = W; sampleCanvas.height = H;
  const c = sampleCanvas.getContext('2d');
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#ff7a59'); g.addColorStop(0.5, '#7b6bff'); g.addColorStop(1, '#24c6dc');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#ffffff22';
  for (let i = -H; i < W; i += 70) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 35, 0); c.lineTo(i + 35 + H, H); c.lineTo(i + H, H); c.fill(); }
  c.fillStyle = '#fff'; c.font = '800 92px Cairo, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = '#0008'; c.shadowBlur = 18; c.fillText('KON CUT', W / 2, H / 2);
  return sampleCanvas;
}

function drawTransformed(target, source, W, H, k, filter) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return false;
  target.save();
  target.filter = filter || 'none';
  target.globalAlpha = clamp(k.opacity ?? 1, 0, 1);
  target.translate(W / 2 + (k.x - 0.5) * W, H / 2 + (k.y - 0.5) * H);
  target.rotate((k.rotation || 0) * Math.PI / 180);
  target.scale(k.scale || 1, k.scale || 1);
  if (k.mirrorH || k.mirrorV) target.scale(k.mirrorH ? -1 : 1, k.mirrorV ? -1 : 1);
  target.translate(-W / 2, -H / 2);
  const s = Math.max(W / sw, H / sh), dw = sw * s, dh = sh * s;
  target.drawImage(source, (W - dw) / 2, (H - dh) / 2, dw, dh);
  target.restore();
  return true;
}

const matteHistory = new Map();
function smoothedMatte(segSource, W, H) {
  const key = segSource;
  const raw = document.createElement('canvas'); raw.width = W; raw.height = H;
  raw.getContext('2d').drawImage(segSource, 0, 0, W, H);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const c = out.getContext('2d'); c.drawImage(raw, 0, 0);
  const prev = matteHistory.get(key);
  if (prev) {
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
    c.drawImage(prev, 0, 0); c.drawImage(raw, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  matteHistory.set(key, out);
  return out;
}

function paintSource(ctx, source, W, H, k, filter, maskKey, maskScale, maskMode, segSource, segInvert, bgSource, edgeFeather, smooth) {
  k = { ...KF_DEFAULT, ...k };
  if (!maskKey && !segSource) { drawTransformed(ctx, source, W, H, k, filter); return; }
  if (bgSource && segSource) drawCover(ctx, bgSource, W, H);
  fxCanvas.width = W; fxCanvas.height = H;
  fxCtx.clearRect(0, 0, W, H);
  drawTransformed(fxCtx, source, W, H, { ...k, opacity: 1 }, filter);
  if (maskKey) {
    const im = getMaskAlpha(maskKey);
    if (im) {
      const mk = { ...MASK_KF_DEFAULT, ...k };
      const cx = W / 2 + ((mk.maskX ?? 0.5) - 0.5) * W;
      const cy = H / 2 + ((mk.maskY ?? 0.5) - 0.5) * H;
      const open = clamp(mk.maskOpen ?? 1, 0, 1);
      const scale = clamp(mk.maskScale || maskScale || 1, 0.1, 3) * open;
      const feather = clamp(mk.maskFeather ?? 0, 0, 1) * 24;
      const w = W * scale, h = H * scale;
      fxCtx.save();
      fxCtx.globalCompositeOperation = maskMode === 'out' ? 'destination-out' : 'destination-in';
      fxCtx.globalAlpha = 1;
      if (feather) fxCtx.filter = `blur(${feather.toFixed(1)}px)`;
      fxCtx.translate(cx, cy);
      fxCtx.rotate((mk.maskRotation || 0) * Math.PI / 180);
      fxCtx.drawImage(im, -w / 2, -h / 2, w, h);
      fxCtx.restore();
    }
  }
  if (segSource && (segSource.readyState >= 2 || (segSource.complete && segSource.naturalWidth))) {
    fxCtx.save();
    fxCtx.globalCompositeOperation = segInvert ? 'destination-out' : 'destination-in';
    fxCtx.globalAlpha = 1;
    fxCtx.filter = Number(edgeFeather) > 0 ? `blur(${Number(edgeFeather).toFixed(1)}px)` : 'none';
    const matte = smooth ? smoothedMatte(segSource, W, H) : segSource;
    fxCtx.drawImage(matte, 0, 0, W, H);
    fxCtx.restore();
  }
  ctx.save(); ctx.globalAlpha = clamp(k.opacity, 0, 1); ctx.drawImage(fxCanvas, 0, 0); ctx.restore();
}

function syncAdjustInputs() {
  const a = state.project.adjust || { bright: 0, contrast: 0, sat: 0, temp: 0 };
  [['adjBright', 'bright'], ['adjContrast', 'contrast'], ['adjSat', 'sat'], ['adjTemp', 'temp']].forEach(([id, key]) => {
    const el = $(id); if (el) el.value = a[key] ?? 0;
  });
}

function highlightFilter() {
  document.querySelectorAll('#filterPresets .preset').forEach((el) => {
    const p = FILTER_PRESETS[Number(el.dataset.fl)];
    const on = p && p.filter === (state.project.filter || 'none');
    el.style.borderColor = on ? 'var(--accent)' : '';
  });
}

function cssFilter() {
  const a = state.project.adjust || { bright: 0, contrast: 0, sat: 0, temp: 0 };
  const base = state.hoverFilter || state.project.filter || 'none';
  const parts = [base === 'none' ? '' : base];
  if (a.bright) parts.push(`brightness(${1 + a.bright / 100})`);
  if (a.contrast) parts.push(`contrast(${1 + a.contrast / 100})`);
  if (a.sat) parts.push(`saturate(${1 + a.sat / 100})`);
  if (a.temp) parts.push(a.temp > 0 ? `sepia(${a.temp / 200})` : `hue-rotate(${a.temp}deg)`);
  return parts.filter(Boolean).join(' ') || 'none';
}

function drawPreview() {
  const canvas = $('preview'), ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  ctx.filter = 'none'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const t = state.time;
  const all = allClips();
  syncAudio(t, all);
  const mediaActive = all.filter((c) => c.type === 'media' && getTrack(c._track.id).kind === 'video' && !getTrack(c._track.id).hidden && t >= c.start && t < c.start + c.duration);
  const anyText = all.some((c) => c.type === 'text');
  const anyTrans = all.some((c) => c.type === 'transition');
  const hovering = state.hoverPreview || state.hoverFilter || state.hoverText || state.hoverMask;
  $('previewEmpty').style.display = (!mediaActive.length && !anyText && !anyTrans && !hovering) ? 'grid' : 'none';

  const filter = cssFilter();
  mediaActive.forEach((c) => {
    const target = (c.inPoint || 0) + (t - c.start) * (c.speed || 1);
    const k = evalKfs(c, t);
    k.mirrorH = !!c.mirrorH; k.mirrorV = !!c.mirrorV;
    const shape = discreteAt(c, t, 'maskShape', c.mask);
    const mode = discreteAt(c, t, 'maskMode', c.maskMode || 'in');
    const seg = getSegMatte(c, target);
    const bg = c.bgSrc ? getBgSource(c, target) : null;
    const bgReady = bg && (bg.source instanceof HTMLVideoElement
      ? bg.source.readyState >= 2 : (bg.source.complete && bg.source.naturalWidth));
    const segInvert = !shape && mode === 'out' && !!seg;
    let src = null;
    if (c.mediaKind === 'image') {
      src = getImage(c.src);
      if (!src.complete || !src.naturalWidth) return;
    } else {
      src = getVideo(c.src);
      if (src.readyState < 2) { src.addEventListener('loadeddata', () => { if (!state.playing) drawPreview(); }, { once: true }); return; }
      if (!state.playing && seekVideo(src, target, drawPreview)) return;
    }
    if (seg && seg.source instanceof HTMLVideoElement && !state.playing &&
        seekVideo(seg.source, seg.time, drawPreview)) return;
    if (bg && bg.source instanceof HTMLVideoElement && !state.playing &&
        seekVideo(bg.source, bg.time, drawPreview)) return;
    const frameKey = `${videoSourceFor(c.src || '')}|${Math.round(target * (state.project.fps || 30))}`;
    const drawSrc = c.mediaKind === 'image' ? src : cachedFrame(src, frameKey);
    try {
      paintSource(ctx, drawSrc, W, H, k, filter, shape, k.maskScale, mode,
        seg && seg.source, segInvert, bgReady ? bg.source : null, c.edgeFeather, c.matteSmooth);
    } catch (e) { /* not ready */ }
  });
  ctx.filter = 'none';

  all.filter((c) => c.type === 'transition' && t >= c.start && t < c.start + c.duration).forEach((c) => {
    const p = (t - c.start) / c.duration;
    const alpha = Math.sin(Math.PI * clamp(p, 0, 1));
    const color = c.effect === 'white' || c.effect === 'flash' ? '255,255,255' : c.effect === 'gray' ? '120,120,130' : '0,0,0';
    ctx.fillStyle = `rgba(${color},${alpha.toFixed(3)})`; ctx.fillRect(0, 0, W, H);
  });

  all.filter((c) => c.type === 'text' && t >= c.start && t < c.start + c.duration).forEach((c) => {
    const arabic = /[\u0600-\u06ff]/.test(c.text || '');
    const k = evalKfs(c, t);
    ctx.save();
    ctx.globalAlpha = clamp(k.opacity, 0, 1);
    ctx.translate(k.x * W, k.y * H); ctx.rotate((k.rotation || 0) * Math.PI / 180); ctx.scale(k.scale || 1, k.scale || 1);
    ctx.direction = arabic ? 'rtl' : 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${c.bold ? '700 ' : ''}${c.fontSize || 72}px ${c.fontFamily || 'Cairo'}, sans-serif`;
    ctx.fillStyle = c.color || '#ffffff'; ctx.shadowColor = '#000000aa'; ctx.shadowBlur = 12;
    ctx.fillText(c.text || '', 0, 0); ctx.restore();
  });

  if (state.hoverText) {
    const p = state.hoverText;
    ctx.save(); ctx.globalAlpha = 0.85;
    ctx.direction = /[\u0600-\u06ff]/.test(p.text) ? 'rtl' : 'ltr';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${p.bold ? '700 ' : ''}${p.fontSize}px Cairo, sans-serif`;
    ctx.fillStyle = p.color; ctx.shadowColor = '#000'; ctx.shadowBlur = 14;
    ctx.fillText(p.text, (p.x ?? 0.5) * W, (p.y ?? 0.5) * H); ctx.restore();
  }

  if (state.hoverPreview) {
    const eff = state.hoverPreview.effect;
    const phase = (performance.now() % 1200) / 1200;
    const alpha = 0.25 + 0.55 * Math.sin(Math.PI * phase);
    const color = eff === 'white' || eff === 'flash' ? '255,255,255' : eff === 'gray' ? '120,120,130' : '0,0,0';
    ctx.fillStyle = `rgba(${color},${alpha.toFixed(3)})`; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff';
    ctx.font = '700 28px Cairo, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
    ctx.fillText('◈  ' + state.hoverPreview.name, W / 2, H - 46); ctx.restore();
  }

  if (state.hoverMask) {
    const p = MASK_PRESETS.find((m) => m.key === state.hoverMask);
    const pulseScale = 0.94 + 0.06 * Math.sin(performance.now() / 260);
    ctx.save(); ctx.globalAlpha = 0.92;
    paintSource(ctx, getSampleCanvas(W, H), W, H, { ...KF_DEFAULT }, 'none', state.hoverMask, pulseScale);
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = '700 26px Cairo, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
    ctx.fillText('◑  ' + (p ? p.name : ''), W / 2, H - 42); ctx.restore();
  }

  drawMaskOverlay(ctx, W, H, t);
}

/* ---------- playback ---------- */
function updatePlaybackUI() {
  $('curTime').textContent = fmtTime(state.time);
  $('totalTime').textContent = fmtTime(state.project.duration);
  $('projectDur').textContent = `المدة: ${fmtTime(state.project.duration)}`;
  $('seek').max = Math.max(0.01, state.project.duration); $('seek').value = state.time;
  $('playhead').style.left = `${126 + state.time * state.pxPerSec}px`;
}
function setTime(t) { state.time = clamp(t, 0, state.project.duration || 0); updatePlaybackUI(); drawPreview(); }
function togglePlay() {
  if (state.project.duration <= 0) { toast('ما فيش محتوى للتشغيل'); return; }
  ensureAudioGraph(); updateTrackGains();
  state.playing = !state.playing; $('playBtn').textContent = state.playing ? '❚❚' : '▶';
  if (state.playing) {
    if (state.time >= state.project.duration) state.time = 0;
    lastFrameAt = performance.now();
    const tick = (now) => {
      if (!state.playing) return;
      state.time += (now - lastFrameAt) / 1000; lastFrameAt = now;
      if (state.time >= state.project.duration) { state.time = state.project.duration; state.playing = false; $('playBtn').textContent = '▶'; }
      updatePlaybackUI(); drawPreview();
      if (state.playing) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  } else { cancelAnimationFrame(rafId); pauseAllAudio(); drawPreview(); }
}
function stopPlayback() { state.playing = false; cancelAnimationFrame(rafId); pauseAllAudio(); $('playBtn').textContent = '▶'; setTime(0); }

/* ---------- detection & transcription ---------- */
function analysisClip() {
  const sel = state.selected && findClip(state.selected.trackId, state.selected.clipId);
  if (sel && sel.type === 'media' && sel.src) return sel;
  return activeVisualClip(state.time);
}

function showDetect(lines) {
  const box = $('detectResults'); if (!box) return;
  box.innerHTML = lines.length ? lines.map((s) => escapeHtml(s)).join('<br>') : 'ما فيش نتائج';
}

async function detectScenesUI() {
  const c = analysisClip(); if (!c) { toast('اختار مقطع الأول'); return; }
  toast('⏳ جاري كشف المشاهد...');
  try {
    state.markers = await window.api.detectScenes(c.src, 0.4);
    renderRuler();
    showDetect(state.markers.map((t) => `🎬 ${fmtTime(t)}`));
    toast(`اتلقت ${state.markers.length} قطعة`);
  } catch (e) { toast('فشل الكشف: ' + (e.message || e)); }
}

function splitScenesUI() {
  const c = analysisClip(); if (!c || !state.markers.length) { toast('اعمل كشف مشاهد الأول'); return; }
  const track = getTrack(c._track?.id || state.selected?.trackId); if (!track) return;
  const marks = state.markers.filter((t) => t > c.start + 0.05 && t < c.start + c.duration - 0.05)
    .sort((a, b) => b - a);
  marks.forEach((t) => splitClipAt(track, findClip(track.id, c.id), t));
  recomputeDuration(); renderAll(); commit('تقسيم عند المشاهد'); toast(`اتقسّم ${marks.length} مرة`);
}

async function detectSilenceUI() {
  const c = analysisClip(); if (!c) { toast('اختار مقطع الأول'); return; }
  toast('⏳ جاري كشف الصمت...');
  try {
    state.silences = await window.api.detectSilence(c.src, '-35dB', 0.4);
    showDetect(state.silences.map((s) => `🔇 ${fmtTime(s.start)} → ${fmtTime(s.end)}`));
    toast(`اتلقت ${state.silences.length} فترات صمت`);
  } catch (e) { toast('فشل الكشف: ' + (e.message || e)); }
}

function removeSilenceUI() {
  const c = analysisClip(); if (!c || !state.silences.length) { toast('اعمل كشف صمت الأول'); return; }
  const track = getTrack(c._track?.id || state.selected?.trackId); if (!track) return;
  const ranges = state.silences.filter((s) => s.start < c.start + c.duration && s.end > c.start);
  const cuts = [];
  ranges.forEach((s) => {
    cuts.push(clamp(s.start, c.start + 0.02, c.start + c.duration - 0.02));
    cuts.push(clamp(s.end, c.start + 0.02, c.start + c.duration - 0.02));
  });
  const pieces = [findClip(track.id, c.id)].filter(Boolean);
  [...new Set(cuts.map((t) => Math.round(t * 100) / 100))].sort((a, b) => b - a).forEach((t) => {
    const piece = pieces.find((p) => t > p.start + 0.02 && t < p.start + p.duration - 0.02);
    if (piece) { const second = splitClipAt(track, piece, t); if (second) pieces.push(second); }
  });
  let removed = 0;
  pieces.forEach((p) => {
    if (ranges.some((s) => p.start >= s.start - 0.03 && p.start + p.duration <= s.end + 0.03)) {
      track.clips = track.clips.filter((x) => x.id !== p.id); removed++;
    }
  });
  clearSelection(); recomputeDuration(); renderAll(); commit('حذف الصمت'); toast(`اتحذف ${removed} جزء صمت`);
}

async function transcribeUI() {
  const c = analysisClip(); if (!c) { toast('اختار مقطع الأول'); return; }
  toast('⏳ جاري استخراج النص العربي...');
  try {
    const segs = await window.api.transcribe(c.src);
    if (!segs || !segs.length) { toast('مفيش كلام واضح في المقطع'); return; }
    let added = 0;
    segs.forEach((s) => {
      const at = Math.max(0, c.start + Number(s.start || 0));
      const clip = addTextClip({ name: 'ترجمة', text: s.text, duration: Math.max(0.4, Number(s.end) - Number(s.start)), fontSize: 48, x: 0.5, y: 0.86 }, at);
      if (clip) added++;
    });
    showDetect(segs.map((s) => `${fmtTime(s.start)}  ${s.text}`));
    toast(`اتضافت ${added} ترجمة`);
  } catch (e) { toast('فشل الاستخراج: ' + (e.message || e)); }
}

/* ---------- events ---------- */
async function importMedia() {
  const items = await window.api.openMedia(); if (!items || !items.length) return;
  items.forEach((m) => {
    if (m.error) return;
    m.sourceDuration = m.duration; state.media.push(m);
    if (m.kind === 'video') requestProxy(m.path);
  });
  renderMedia(); renderAudioMedia(); toast(`تم استيراد ${items.length} ملف`);
}
$('importBtn').addEventListener('click', importMedia);
$('importBtnSide').addEventListener('click', importMedia);
$('addTextBtn').addEventListener('click', () => addTextClip(TEXT_PRESETS[0]));
$('playBtn').addEventListener('click', togglePlay);
$('stopBtn').addEventListener('click', stopPlayback);
$('deleteBtn').addEventListener('click', deleteSelected);
$('splitBtn').addEventListener('click', splitSelected);
$('detectScenesBtn').addEventListener('click', detectScenesUI);
$('splitScenesBtn').addEventListener('click', splitScenesUI);
$('detectSilenceBtn').addEventListener('click', detectSilenceUI);
$('removeSilenceBtn').addEventListener('click', removeSilenceUI);
$('transcribeBtn').addEventListener('click', transcribeUI);
$('copyReportBtn').addEventListener('click', async () => {
  try {
    const report = await window.api.getReport();
    await navigator.clipboard.writeText(report || 'ما فيش أخطاء مسجّلة');
    toast('اتنسخ تقرير الأخطاء');
  } catch (e) { toast('ما قدرتش أنسخ التقرير'); }
});

$('masterVol').addEventListener('input', (e) => { masterVolume = Number(e.target.value); ensureAudioGraph(); updateTrackGains(); });
$('muteBtn').addEventListener('click', () => {
  masterMuted = !masterMuted; $('muteBtn').textContent = masterMuted ? '🔇' : '🔊';
  ensureAudioGraph(); updateTrackGains();
});
$('deviceSel').addEventListener('change', (e) => applyOutputDevice(e.target.value));
$('testSoundBtn').addEventListener('click', () => { ensureAudioGraph(); updateTrackGains(); playSfxPreview('ding.wav'); });

$('seek').addEventListener('input', (e) => setTime(Number(e.target.value)));
$('ruler').addEventListener('pointerdown', (e) => { const r = $('ruler').getBoundingClientRect(); setTime((e.clientX - r.left) / state.pxPerSec); });

$('zoom').addEventListener('input', (e) => { state.pxPerSec = Number(e.target.value); renderRuler(); renderTracks(); updatePlaybackUI(); });
$('snapBtn').addEventListener('click', () => { state.snap = !state.snap; $('snapBtn').classList.toggle('active', state.snap); toast(state.snap ? 'المحاذاة مفعّلة' : 'المحاذاة متوقفة'); });
$('fitBtn').addEventListener('click', () => { state.pxPerSec = clamp(Math.floor(($('timelineScroll').clientWidth - 150) / Math.max(1, state.project.duration)), 20, 200); $('zoom').value = state.pxPerSec; renderRuler(); renderTracks(); updatePlaybackUI(); });

$('freezeBtn').addEventListener('click', freezeFrame);
$('mirrorBtn').addEventListener('click', () => toggleMirror('h'));
$('reverseBtn').addEventListener('click', reverseSelected);
$('segGeneralBtn').addEventListener('click', () => applySegmentation('general'));
$('segPersonBtn').addEventListener('click', () => applySegmentation('person'));

$('preview').addEventListener('pointerdown', onPreviewPointerDown);
window.addEventListener('pointermove', onPreviewPointerMove);
window.addEventListener('pointerup', onPreviewPointerUp);
window.addEventListener('pointercancel', onPreviewPointerUp);

const ctxMenu = $('ctxMenu');
function showCtxMenu(e) {
  e.preventDefault();
  ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - 190) + 'px';
  ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - 240) + 'px';
  ctxMenu.classList.add('show');
}
document.querySelector('.viewer').addEventListener('contextmenu', showCtxMenu);
ctxMenu.addEventListener('click', (e) => {
  const act = e.target.dataset.act; if (!act) return;
  ctxMenu.classList.remove('show');
  if (act === 'freeze') freezeFrame();
  if (act === 'mirrorH') toggleMirror('h');
  if (act === 'mirrorV') toggleMirror('v');
  if (act === 'reverse') reverseSelected();
  if (act === 'segGeneral') applySegmentation('general');
  if (act === 'segPerson') applySegmentation('person');
  if (act === 'segClear') clearSegmentation(targetVisualClip());
  if (act === 'duplicate') duplicateSelected();
  if (act === 'copy') copySelected();
  if (act === 'paste') pasteClips();
  if (act === 'rippleDelete') deleteSelected(true);
});
document.addEventListener('click', (e) => { if (!ctxMenu.contains(e.target)) ctxMenu.classList.remove('show'); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ctxMenu.classList.remove('show'); });

$('fullscreenBtn').addEventListener('click', () => {
  const v = document.querySelector('.viewer');
  if (document.fullscreenElement) document.exitFullscreen(); else v.requestFullscreen?.();
});
$('ratioSel').addEventListener('change', (e) => {
  const v = document.querySelector('.viewer');
  v.classList.remove('portrait', 'square');
  if (e.target.value === '9:16') v.classList.add('portrait');
  if (e.target.value === '1:1') v.classList.add('square');
});

['adjBright', 'adjContrast', 'adjSat', 'adjTemp'].forEach((id) => {
  $(id).addEventListener('input', () => {
    state.project.adjust = {
      bright: Number($('adjBright').value), contrast: Number($('adjContrast').value),
      sat: Number($('adjSat').value), temp: Number($('adjTemp').value),
    };
    drawPreview(); commitSoon('ضبط الصورة');
  });
  $(id).addEventListener('change', () => commit('ضبط الصورة'));
});

$('addVideoTrack').addEventListener('click', () => {
  const n = state.project.tracks.filter((t) => t.kind === 'video').length + 1;
  state.project.tracks.splice(1, 0, { id: uid(), kind: 'video', name: `فيديو ${n}`, clips: [] }); renderAll(); commit('مسار فيديو جديد');
});
$('addAudioTrack').addEventListener('click', () => {
  const n = state.project.tracks.filter((t) => t.kind === 'audio').length + 1;
  state.project.tracks.push({ id: uid(), kind: 'audio', name: `صوت ${n}`, clips: [] }); renderAll(); commit('مسار صوت جديد');
});

$('newBtn').addEventListener('click', () => {
  state.project.tracks.forEach((t) => { t.clips = []; }); state.media = []; state.selected = null; state.selection.clear(); state.anchorSel = null; state.time = 0;
  recomputeDuration(); renderAll(); commit('مشروع جديد'); toast('مشروع جديد');
});
function loadProject(p) {
  state.project = p;
  state.project.filter = state.project.filter || 'none';
  state.project.adjust = { bright: 0, contrast: 0, sat: 0, temp: 0, ...(p.adjust || {}) };
  state.selected = null; state.selection.clear(); state.anchorSel = null; state.time = 0;
  if (state.playing) togglePlay();
  recomputeDuration(); syncAdjustInputs(); highlightFilter(); renderAll();
  window.KCHistory.reset(state.project, 'فتح مشروع'); updateHistoryUI();
}

$('saveBtn').addEventListener('click', async () => { const p = await window.api.saveProject(state.project); if (p) toast('تم حفظ المشروع'); });
$('openBtn').addEventListener('click', async () => {
  const p = await window.api.openProject(); if (!p) return;
  loadProject(p); toast('تم فتح المشروع');
});
$('backupBtn').addEventListener('click', async () => {
  const p = await window.api.openBackup(); if (!p) { toast('مفيش نسخة احتياطية لهذا المشروع'); return; }
  loadProject(p); toast('اتفتحت النسخة الاحتياطية');
});
$('exportBtn').addEventListener('click', () => {
  if (!state.project.duration) { toast('الخط الزمني فاضي'); return; }
  $('expRes').value = `${state.project.width || 1920}x${state.project.height || 1080}`;
  $('expFps').value = String(state.project.fps || 30);
  $('expQuality').value = String(state.project.crf || 23);
  showProgress('إعدادات التصدير', true);
});

async function startExport() {
  const [w, h] = ($('expRes').value || '1920x1080').split('x').map(Number);
  state.project.width = w; state.project.height = h;
  state.project.fps = Number($('expFps').value) || 30;
  state.project.crf = Number($('expQuality').value) || 23;
  const out = await window.api.pickExportPath(state.project.name || 'output'); if (!out) return;
  activeExportId = null;
  showProgress('جاري التصدير…');
  const res = await window.api.exportVideo(state.project, out);
  $('exportModal').classList.remove('show');
  activeExportId = null;
  if (res.ok) toast('تم التصدير بنجاح');
  else if (res.cancelled) toast('اتلغى التصدير');
  else toast('فشل التصدير');
}
$('exportStartBtn').addEventListener('click', startExport);
$('exportCancelBtn').addEventListener('click', () => $('exportModal').classList.remove('show'));
$('progressCancelBtn').addEventListener('click', async () => {
  $('progressText').textContent = 'جاري الإلغاء…';
  if (progressMode === 'segment' && activeSegmentId) await window.api.cancelSegment(activeSegmentId);
  else if (activeExportId) await window.api.cancelExport(activeExportId);
});

window.addEventListener('error', (e) => {
  window.api?.logError?.('window.error', `${e.message} @ ${e.filename}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', (e) => {
  window.api?.logError?.('unhandledrejection', e.reason && (e.reason.stack || e.reason.message) || e.reason);
});

window.api.onProgress((p) => {
  if (p.id) activeExportId = p.id;
  if (p.cancelled) return;
  $('progressFill').style.width = `${clamp(Number(p.percent) || 0, 0, 100)}%`;
  $('progressText').textContent = `${clamp(Number(p.percent) || 0, 0, 100)}%`;
});
window.api.onSegmentProgress((p) => {
  if (p.id && !activeSegmentId) activeSegmentId = p.id;
  if (segmentClipId != null && p.clipId != null && p.clipId !== segmentClipId) return;
  const percent = clamp(Number(p.percent) || 0, 0, 100);
  $('progressFill').style.width = `${percent}%`;
  $('progressText').textContent = `${percent}%`;
  const st = $('segStatus'); if (st) st.textContent = `جاري العزل... ${percent}%`;
});

function isTypingTarget(el) {
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  return !['range', 'checkbox', 'radio', 'color', 'button'].includes(el.type);
}

document.addEventListener('keydown', (e) => {
  const cmd = e.ctrlKey || e.metaKey;
  if (cmd && e.code === 'KeyS') { e.preventDefault(); if (isTypingTarget(document.activeElement)) document.activeElement.blur(); $('saveBtn').click(); return; }
  if (cmd && e.code === 'KeyZ') {
    e.preventDefault();
    if (isTypingTarget(document.activeElement)) return;
    if (e.shiftKey) redo(); else undo();
    return;
  }
  if (cmd && e.code === 'KeyY') { e.preventDefault(); if (!isTypingTarget(document.activeElement)) redo(); return; }
  const typing = isTypingTarget(document.activeElement);
  if (cmd && !typing) {
    if (e.code === 'KeyC') { e.preventDefault(); copySelected(); return; }
    if (e.code === 'KeyV') { e.preventDefault(); pasteClips(); return; }
    if (e.code === 'KeyD') { e.preventDefault(); duplicateSelected(); return; }
    if (e.code === 'KeyA') { e.preventDefault(); selectAll(); return; }
  }
  if (typing) return;
  const mod = e.ctrlKey || e.metaKey || e.altKey;
  if (mod) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(e.shiftKey); }
  if (e.code === 'KeyS') { e.preventDefault(); splitSelected(); }
  if (e.code === 'KeyF') freezeFrame();
  if (e.code === 'KeyM') toggleMirror('h');
  if (e.code === 'KeyR') reverseSelected();
});

/* init */
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
setupTabs(); renderPresets(); recomputeDuration(); renderAll();
window.KCHistory.reset(state.project, 'بداية');
syncAdjustInputs(); updateHistoryUI();
populateAudioDevices(); drawVuLoop();
window.api?.runtime?.().then((r) => {
  const el = $('runtimeStatus');
  if (el && r) el.textContent = `${r.packaged ? 'نسخة مثبّتة' : 'نسخة تطوير'} · FFmpeg ${r.ffmpegReady ? 'جاهز' : 'مش موجود'} · ${r.appDir}`;
}).catch(() => {});
