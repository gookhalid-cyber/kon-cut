const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Copy generated temp assets next to the project file and store relative paths.
function normalizeProject(data, projectPath, tempDir) {
  const copy = JSON.parse(JSON.stringify(data));
  const dir = path.dirname(projectPath);
  const base = path.basename(projectPath, path.extname(projectPath)).replace(/[^a-zA-Z0-9\u0600-\u06ff_-]+/g, '_');
  const assetsDir = path.join(dir, `${base}_assets`);
  const copied = new Map();
  const localize = (p) => {
    if (!p || typeof p !== 'string' || !path.isAbsolute(p)) return p;
    const abs = path.resolve(p);
    if (!tempDir || !abs.toLowerCase().startsWith(path.resolve(tempDir).toLowerCase() + path.sep)) return p;
    if (!copied.has(abs)) {
      fs.mkdirSync(assetsDir, { recursive: true });
      const hash = crypto.createHash('sha256').update(abs).digest('hex').slice(0, 16);
      const dest = path.join(assetsDir, hash + path.extname(abs));
      if (!fs.existsSync(dest)) fs.copyFileSync(abs, dest);
      copied.set(abs, dest);
    }
    return path.relative(dir, copied.get(abs)).split(path.sep).join('/');
  };
  (copy.tracks || []).forEach((t) => (t.clips || []).forEach((c) => {
    c.src = localize(c.src);
    c.segMatte = localize(c.segMatte);
  }));
  return copy;
}

// Resolve project-relative paths back to absolute paths when opening.
function denormalizeProject(data, projectPath) {
  const copy = JSON.parse(JSON.stringify(data));
  const dir = path.dirname(projectPath);
  const resolve = (p) => (!p || typeof p !== 'string' || path.isAbsolute(p)) ? p : path.resolve(dir, p);
  (copy.tracks || []).forEach((t) => (t.clips || []).forEach((c) => {
    c.src = resolve(c.src);
    c.segMatte = resolve(c.segMatte);
  }));
  return copy;
}

module.exports = { normalizeProject, denormalizeProject };
