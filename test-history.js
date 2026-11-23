const assert = require('assert');

global.window = {};
require('./renderer/history');
const H = global.window.KCHistory;

let project = { duration: 0, tracks: [{ id: 't', clips: [] }] };
H.reset(project);
assert.strictEqual(H.canUndo(), false);
assert.strictEqual(H.canRedo(), false);

project.tracks[0].clips.push({ id: 'a', start: 0 });
assert.strictEqual(H.commit(project, 'add'), true);
assert.strictEqual(H.canUndo(), true);

project.tracks[0].clips[0].start = 5;
assert.strictEqual(H.commit(project, 'move'), true);

let snap = H.undo(project);
assert.strictEqual(snap.tracks[0].clips[0].start, 0);
assert.strictEqual(H.canRedo(), true);

snap = H.undo(project);
assert.strictEqual(snap.tracks[0].clips.length, 0);
assert.strictEqual(H.canUndo(), false);

snap = H.redo(project);
assert.strictEqual(snap.tracks[0].clips.length, 1);
assert.strictEqual(H.canRedo(), true);

// A new commit after undo must discard the redo branch.
snap = H.undo(project);
project = snap;
project.tracks[0].clips.push({ id: 'b' });
assert.strictEqual(H.commit(project, 'branch'), true);
assert.strictEqual(H.canRedo(), false);

// No-op commits must not create history entries.
const depth = H.stack.length;
assert.strictEqual(H.commit(project, 'noop'), false);
assert.strictEqual(H.stack.length, depth);

console.log('HISTORY: OK');
