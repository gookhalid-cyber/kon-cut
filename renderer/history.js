/* Kon Cut - project history (undo / redo). Original implementation. */
(function () {
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const H = {
    stack: [],
    index: -1,
    limit: 100,

    snapshot(project) { return clone(project); },

    reset(project, label = 'بداية') {
      this.stack = [this.snapshot(project)];
      this.index = 0;
      this.stack[0]._label = label;
      return this;
    },

    commit(project, label = 'تعديل') {
      const snap = this.snapshot(project);
      const current = this.stack[this.index];
      if (current) {
        const a = clone(current); const b = clone(snap);
        delete a._label; delete b._label;
        if (JSON.stringify(a) === JSON.stringify(b)) return false;
      }
      this.stack = this.stack.slice(0, this.index + 1);
      snap._label = label;
      this.stack.push(snap);
      if (this.stack.length > this.limit) this.stack.splice(0, this.stack.length - this.limit);
      this.index = this.stack.length - 1;
      return true;
    },

    undo(project) {
      if (!this.canUndo()) return null;
      this.index--;
      return this.snapshot(this.stack[this.index]);
    },

    redo(project) {
      if (!this.canRedo()) return null;
      this.index++;
      return this.snapshot(this.stack[this.index]);
    },

    canUndo() { return this.index > 0; },
    canRedo() { return this.index >= 0 && this.index < this.stack.length - 1; },
    label() { return this.stack[this.index]?._label || ''; },
    undoLabel() { return this.canUndo() ? this.stack[this.index - 1]?._label || '' : ''; },
    redoLabel() { return this.canRedo() ? this.stack[this.index + 1]?._label || '' : ''; },
  };

  window.KCHistory = H;
})();
