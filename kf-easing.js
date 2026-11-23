/* Kon Cut - shared keyframe easing maths.
   Used by the renderer (preview) and FFmpeg builder (export) so both agree. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KFEasing = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const EASINGS = ['linear', 'easeIn', 'easeOut', 'easeInOut'];
  const EASING_LABELS = {
    linear: 'خطي',
    easeIn: 'تسارع',
    easeOut: 'تباطؤ',
    easeInOut: 'تسارع وتباطؤ',
  };

  const clamp01 = (p) => Math.max(0, Math.min(1, Number(p) || 0));

  // Preview-side easing.
  function ease(p, type) {
    p = clamp01(p);
    switch (type) {
      case 'easeIn': return p * p;
      case 'easeOut': return 1 - (1 - p) * (1 - p);
      case 'easeInOut': return p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
      default: return p;
    }
  }

  function num(v, digits) { return Number(v || 0).toFixed(digits == null ? 3 : digits); }

  // FFmpeg-side easing: pExpr is an expression evaluating to 0..1.
  function easeExpr(type, pExpr) {
    const p = `(${pExpr})`;
    switch (type) {
      case 'easeIn': return `${p}*${p}`;
      case 'easeOut': return `1-(1-${p})*(1-${p})`;
      case 'easeInOut': return `if(lt(${p},0.5),2*${p}*${p},1-2*(1-${p})*(1-${p}))`;
      default: return p;
    }
  }

  // Build an FFmpeg eval=frame expression for one animated property.
  // Commas inside if() are escaped once, at the end, for the filter parser.
  function kfExpression(kfs, prop, fallback, timeOffset = 0) {
    const pts = (kfs || [])
      .filter((k) => k[prop] != null && Number.isFinite(Number(k[prop])))
      .map((k) => ({ t: Number(k.t), v: Number(k[prop]), easing: k.easing || 'linear' }))
      .sort((a, b) => a.t - b.t);
    if (!pts.length) return num(fallback, 4);
    const tv = timeOffset ? `(t+${num(timeOffset)})` : 't';
    let expr = `if(lt(${tv},${num(pts[0].t)}),${num(pts[0].v, 4)},`;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const p = `(${tv}-${num(a.t)})/${num(Math.max(0.001, b.t - a.t))}`;
      expr += `if(lt(${tv},${num(b.t)}),${num(a.v, 4)}+(${num(b.v, 4)}-${num(a.v, 4)})*${easeExpr(a.easing, p)},`;
    }
    expr += num(pts[pts.length - 1].v, 4) + ')'.repeat(pts.length);
    return expr.replace(/,/g, '\\,');
  }

  return { EASINGS, EASING_LABELS, ease, easeExpr, kfExpression };
});
