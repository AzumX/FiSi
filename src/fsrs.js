// FSRS-4.5 scheduler (Free Spaced Repetition Scheduler), default parameters.
// Rating: 1 = Nochmal, 2 = Schwer, 3 = Gut, 4 = Leicht
const FSRS = (() => {
  const w = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  const DECAY = -0.5, FACTOR = 19 / 81;
  const MIN = 60e3, DAY = 864e5;
  const clampD = d => Math.min(10, Math.max(1, d));
  const initS = g => Math.max(0.1, w[g - 1]);
  const initD = g => clampD(w[4] - (g - 3) * w[5]);
  const retrievability = (elapsedDays, s) => Math.pow(1 + FACTOR * elapsedDays / s, DECAY);
  const nextD = (d, g) => clampD(w[7] * initD(3) + (1 - w[7]) * (d - w[6] * (g - 3)));
  const recallS = (d, s, r, g) => s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1)
    * (g === 2 ? w[15] : 1) * (g === 4 ? w[16] : 1));
  const forgetS = (d, s, r) => Math.min(s, w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r)));
  // same-day steps: "Nochmal" halves, "Schwer" trims stability (floor 0.1 days)
  const shortS = (s, g) => Math.max(0.1, s * (g === 1 ? 0.5 : g === 2 ? 0.8 : 1));

  // retention target 0.9 => interval == stability
  function intervalDays(s, opts) {
    const r = opts.retention || 0.9;
    let i = s / FACTOR * (Math.pow(r, 1 / DECAY) - 1);
    i = Math.max(1, Math.round(i));
    if (opts.maxInterval) i = Math.min(i, Math.max(1, opts.maxInterval));
    return i;
  }

  // st: {state:'new'|'learning'|'review'|'relearning', s, d, due, last, reps, lapses, step}
  function schedule(st, g, now, opts = {}) {
    const n = { ...st };
    n.reps = (st.reps || 0) + 1;
    n.last = now;
    const steps = [1, 10]; // minutes
    const relearn = [10];
    if (!st.state || st.state === 'new') {
      n.s = initS(g); n.d = initD(g); n.lapses = 0;
      if (g === 1) { n.state = 'learning'; n.step = 0; n.due = now + steps[0] * MIN; }
      else if (g === 2) { n.state = 'learning'; n.step = 0; n.due = now + 5 * MIN; }
      else if (g === 3) { n.state = 'learning'; n.step = 1; n.due = now + steps[1] * MIN; }
      else { n.state = 'review'; n.step = 0; n.due = now + intervalDays(n.s, opts) * DAY; }
      return n;
    }
    if (st.state === 'learning' || st.state === 'relearning') {
      const list = st.state === 'learning' ? steps : relearn;
      n.d = nextD(st.d, g);
      if (g === 1) { n.step = 0; n.s = shortS(st.s, 1); n.due = now + list[0] * MIN; }
      else if (g === 2) { n.s = shortS(st.s, 2); n.due = now + Math.round(list[Math.min(st.step || 0, list.length - 1)] * 1.5) * MIN; }
      else if (g === 3 && (st.step || 0) + 1 < list.length) { n.step = (st.step || 0) + 1; n.due = now + list[n.step] * MIN; }
      else {
        if (g === 4) n.s = Math.max(st.s, initS(4));
        n.state = 'review'; n.step = 0; n.due = now + intervalDays(n.s, opts) * DAY;
      }
      return n;
    }
    // review
    const elapsed = Math.max(0, (now - (st.last || now)) / DAY);
    const r = retrievability(elapsed, st.s);
    n.d = nextD(st.d, g);
    if (g === 1) {
      n.s = forgetS(st.d, st.s, r); n.lapses = (st.lapses || 0) + 1;
      n.state = 'relearning'; n.step = 0; n.due = now + relearn[0] * MIN;
    } else {
      n.s = recallS(st.d, st.s, r, g);
      let i = intervalDays(n.s, opts);
      n.due = now + i * DAY;
    }
    return n;
  }

  function preview(st, now, opts) {
    return [1, 2, 3, 4].map(g => schedule(st || { state: 'new' }, g, now, opts).due - now);
  }
  function fmtInterval(ms) {
    const m = ms / MIN;
    if (m < 60) return Math.max(1, Math.round(m)) + ' min';
    const h = m / 60; if (h < 24) return Math.round(h) + ' h';
    const d = ms / DAY; if (d < 31) return Math.round(d) + ' T';
    if (d < 365) return (d / 30.4).toFixed(1).replace('.', ',') + ' Mon';
    return (d / 365).toFixed(1).replace('.', ',') + ' J';
  }
  return { schedule, preview, fmtInterval, retrievability, DAY, MIN };
})();
