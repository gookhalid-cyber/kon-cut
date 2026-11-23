const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { TEMP_DIR } = require('./ffmpeg-builder');
const { normalizeProject, denormalizeProject } = require('./project-paths');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
const dir = fs.mkdtempSync(path.join(TEMP_DIR, 'paths-'));
const generated = path.join(dir, 'seg_generated.mp4');
fs.writeFileSync(generated, 'matte');
const external = path.join(require('os').tmpdir(), 'koncut-source-test.mp4');
fs.writeFileSync(external, 'source');

const projectPath = path.join(dir, 'film.montaj');
const project = {
  version: 2,
  tracks: [{ id: 'v', clips: [
    { id: 'c1', src: generated, segMatte: generated },
    { id: 'c2', src: external },
  ] }],
};

const saved = normalizeProject(project, projectPath, TEMP_DIR);
assert(fs.existsSync(path.join(dir, 'film_assets')), 'assets folder missing');
assert(/^film_assets\//.test(saved.tracks[0].clips[0].src), 'generated path not relative');
assert(saved.tracks[0].clips[1].src === external, 'external source path must stay absolute');

// Simulate cleaning temp: delete generated file, open from another machine path.
fs.unlinkSync(generated);
const opened = denormalizeProject(JSON.parse(JSON.stringify(saved)), projectPath);
assert(fs.existsSync(opened.tracks[0].clips[0].src), 'relocated asset missing after open');
assert(opened.tracks[0].clips[0].segMatte === opened.tracks[0].clips[0].src, 'matte path not resolved');

console.log('PROJECT PATHS: OK');
