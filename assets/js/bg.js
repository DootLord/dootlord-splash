// Low-resolution pixel-art background: dark glow, bone rings,
// corner rainbows, sparkles and drifting skeleton bits.
//
// The canvas is rendered at roughly 1/5th of the viewport and scaled up with
// nearest-neighbour filtering, so the whole scene is ~80k pixels regardless of
// screen size. Each frame is one typed-array copy of a pre-built base plus a
// few thousand sparse pixel writes (rings, rainbows) and ~100 tiny
// draws (sparkles, sprites). It runs at 30fps on purpose: cheaper, and it
// reads as pixel art.

const TAU = Math.PI * 2;
const FRAME_MS = 1000 / 30;

const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// 0xAABBGGRR (little-endian ImageData)
const pack = ([r, g, b]) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
const rgba = (hex) => pack(toRgb(hex));
const mix = (a, b, k) => a.map((c, i) => Math.round(c + (b[i] - c) * k));
const lighten = (hex, k = 0.55) => pack(mix(toRgb(hex), [255, 255, 255], k));

/* ---------- backdrop palette ----------
 * A plain dark field: a soft green glow behind the skull, dithered down in
 * LEVELS steps to near-black at the edges. */
const LEVELS = 7;
const GLOW = toRgb('#173a30');
const CARBON = toRgb('#0e1115');
const EDGE = toRgb('#07080a');

const PAL = new Uint32Array(LEVELS);
for (let l = 0; l < LEVELS; l++) {
  const k = l / (LEVELS - 1);
  PAL[l] = pack(k < 0.5 ? mix(GLOW, CARBON, k * 2) : mix(CARBON, EDGE, (k - 0.5) * 2));
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const RAINBOW_HEX = ['#ff4f79', '#ff9f43', '#ffe95c', '#3fe0ff', '#5b7bff', '#b061ff'];
const RAINBOW = RAINBOW_HEX.map(rgba);
const RAINBOW_LIGHT = RAINBOW_HEX.map((h) => lighten(h));

// `bone: true` rings are drawn as a chain of little bones (dashes with knobs)
const RINGS = [
  { r: 1.32, color: rgba('#2f8f72'), dashes: 3, duty: 0.72, speed: 0.012 },
  { r: 1.64, color: rgba('#9fe6cd'), bone: true, duty: 0.62, speed: -0.018 },
  { r: 2.0, color: rgba('#2b8f9a'), dashes: 5, duty: 0.55, speed: 0.03 },
  { r: 2.55, color: rgba('#7a52b3'), dashes: 48, duty: 0.34, speed: -0.008 },
  { r: 3.3, color: rgba('#5fa890'), bone: true, duty: 0.6, speed: 0.01 },
];

const SPARK_COLORS = ['#ffffff', '#ffe95c', '#b061ff', '#3fe0ff', '#ff4f79', '#7dffc8'];

/* ---------- skeleton sprites ---------- */

const SPRITE_COLORS = { X: '#46515c', H: '#b4c0cc', G: '#7dffc8', D: '#161a20' };
const makeSprite = (rows) => {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const x = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    x.fillStyle = SPRITE_COLORS[ch];
    x.fillRect(i, y, 1, 1);
  }));
  return c;
};
const SKULL = makeSprite([
  '.XXXXX.',
  'XHHXXXX',
  'XHXXXXX',
  'XGGXGGX',
  'XGGXGGX',
  'XXXDXXX',
  '.XXXXX.',
  '.XDXDX.',
]);
const BONES = [
  makeSprite([
    'HX....XX',
    '.HHXXXX.',
    'XX....XX',
  ]),
  makeSprite([
    'HX....',
    'XHX...',
    '.XHX..',
    '..XXX.',
    '...XXX',
    '....XX',
  ]),
  makeSprite([
    '....HX',
    '...HXX',
    '..HXX.',
    '.XXX..',
    'XXX...',
    'XX....',
  ]),
  makeSprite([
    'X.X',
    'HXX',
    '.H.',
    '.X.',
    '.X.',
    'XXX',
    'X.X',
  ]),
];

export function createBackground(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });

  // animatable by the intro timeline
  // `dim` (0..1) unwinds the rings again as the page scrolls past the splash
  const state = { rings: 0, rainbow: 0, sparks: 0, dim: 0 };

  // Size to the *largest* viewport so mobile URL-bar show/hide while scrolling
  // neither uncovers an edge nor forces a rebuild.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none';
  document.body.append(probe);
  const viewport = () => ({ vw: window.innerWidth, vh: Math.max(window.innerHeight, probe.offsetHeight) });
  let lastVw = 0, lastVh = 0;

  let px = 5, W = 0, H = 0;
  let image, buf, base;
  let center = {};
  let centerCss = null;

  let ringIdx, ringAng, ringK, ringThick;
  let ringDashes = [], ringKnob = [];
  let rbIdx, rbD, rbAng, rbWhich, bandW = 3;

  const ambient = [];
  const drifters = [];
  const bursts = [];
  const waves = [];

  let running = false, raf = 0, last = 0, t = 0;

  function build() {
    const { vw, vh } = viewport();
    lastVw = vw; lastVh = vh;
    px = Math.max(3, Math.round(Math.max(vw, vh) / 400));
    W = Math.ceil(vw / px);
    H = Math.ceil(vh / px);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W * px + 'px';
    canvas.style.height = H * px + 'px';
    ctx.imageSmoothingEnabled = false;

    image = ctx.createImageData(W, H);
    buf = new Uint32Array(image.data.buffer);
    base = new Uint32Array(W * H);

    const cx = centerCss ? centerCss.x / px : W * 0.5;
    const cy = centerCss ? centerCss.y / px : H * 0.4;
    const half = centerCss ? centerCss.half / px : Math.min(W, H) * 0.2;
    center = { lx: cx, ly: cy, lhalf: half };

    // dithered radial falloff from the skull's glow to black at the edges
    const falloff = Math.max(W, H) * 0.62;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - cx, dy = y - cy;
        const v = Math.min(1, Math.sqrt(dx * dx + dy * dy) / falloff) * (LEVELS - 1);
        const b = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        base[y * W + x] = PAL[Math.min(LEVELS - 1, Math.floor(v + b))];
      }
    }

    // rings: collect the pixels that sit on each circle (bone rings also keep
    // a one-pixel halo either side, used for the knobs at the bone ends)
    const radii = RINGS.map((r) => r.r * half);
    ringDashes = RINGS.map((r, k) => (r.bone ? Math.max(6, Math.round((TAU * radii[k]) / 15)) : r.dashes));
    ringKnob = RINGS.map((r, k) => (r.bone ? (1.7 * ringDashes[k]) / (TAU * radii[k]) : 0));
    const maxR = radii[radii.length - 1] + 2;
    const ri = [], ra = [], rk = [], rt = [];
    const y0 = Math.max(0, Math.floor(cy - maxR)), y1 = Math.min(H - 1, Math.ceil(cy + maxR));
    const x0 = Math.max(0, Math.floor(cx - maxR)), x1 = Math.min(W - 1, Math.ceil(cx + maxR));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxR) continue;
        for (let k = 0; k < radii.length; k++) {
          const off = Math.abs(d - radii[k]);
          if (off < (RINGS[k].bone ? 1.5 : 0.5)) {
            ri.push(y * W + x);
            ra.push((Math.atan2(dy, dx) + Math.PI) / TAU);
            rk.push(k);
            rt.push(off < 0.5 ? 0 : 1);
            break;
          }
        }
      }
    }
    ringIdx = Uint32Array.from(ri);
    ringAng = Float32Array.from(ra);
    ringK = Uint8Array.from(rk);
    ringThick = Uint8Array.from(rt);

    // rainbows: quarter arcs hugging the top-left and bottom-right corners
    const m = Math.min(W, H);
    bandW = Math.max(2, Math.round(m * 0.022));
    const r0 = m * 0.3, r1 = r0 + bandW * RAINBOW.length;
    const off = m * 0.08;
    const corners = [
      { x: -off, y: -off, sx: 1, sy: 1 },
      { x: W + off, y: H + off, sx: -1, sy: -1 },
    ];
    const bi = [], bd = [], ba = [], bw = [];
    corners.forEach((c, which) => {
      const reach = Math.ceil(r1 + 4);
      const xa = Math.max(0, Math.floor(Math.min(c.x, c.x + c.sx * reach)));
      const xb = Math.min(W - 1, Math.ceil(Math.max(c.x, c.x + c.sx * reach)));
      const ya = Math.max(0, Math.floor(Math.min(c.y, c.y + c.sy * reach)));
      const yb = Math.min(H - 1, Math.ceil(Math.max(c.y, c.y + c.sy * reach)));
      for (let y = ya; y <= yb; y++) {
        for (let x = xa; x <= xb; x++) {
          const dx = (x + 0.5 - c.x) * c.sx, dy = (y + 0.5 - c.y) * c.sy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < r0 - 3 || d > r1 + 3) continue;
          bi.push(y * W + x);
          bd.push(d - r0);
          ba.push(Math.atan2(dy, dx) / (Math.PI / 2));
          bw.push(which);
        }
      }
    });
    rbIdx = Uint32Array.from(bi);
    rbD = Float32Array.from(bd);
    rbAng = Float32Array.from(ba);
    rbWhich = Uint8Array.from(bw);

    // ambient sparkles
    ambient.length = 0;
    const count = Math.round((W * H) / 1300);
    for (let i = 0; i < count; i++) {
      ambient.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vy: -(0.6 + Math.random() * 2.4),
        sway: 0.5 + Math.random() * 2,
        ph: Math.random() * TAU,
        sp: 0.6 + Math.random() * 1.8,
        c: SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0],
        gate: Math.random(),
      });
    }

    // drifting skulls and bones
    drifters.length = 0;
    const dn = Math.max(4, Math.round((W * H) / 7000));
    for (let i = 0; i < dn; i++) {
      drifters.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vy: -(0.8 + Math.random() * 1.6),
        sway: 2 + Math.random() * 4,
        ph: Math.random() * TAU,
        img: i % 3 === 0 ? SKULL : BONES[(Math.random() * BONES.length) | 0],
        gate: Math.random(),
      });
    }
  }

  function draw(dt) {
    buf.set(base);

    // rings
    const ringsShown = state.rings * (1 - state.dim);
    if (ringsShown > 0) {
      const rot = RINGS.map((r) => t * r.speed);
      const rev = RINGS.map((_, k) => Math.max(0, Math.min(1, ringsShown * 1.8 - k * 0.2)));
      for (let i = 0, n = ringIdx.length; i < n; i++) {
        const k = ringK[i];
        const a = ringAng[i];
        if (a > rev[k]) continue;
        const ring = RINGS[k];
        let p = (a + rot[k]) * ringDashes[k];
        p -= Math.floor(p);
        if (p >= ring.duty) continue;
        if (ringThick[i] && p > ringKnob[k] && p < ring.duty - ringKnob[k]) continue;
        buf[ringIdx[i]] = ring.color;
      }
    }

    // rainbows
    if (state.rainbow > 0) {
      const amp = bandW * 0.35;
      const shimmer = t * 0.11;
      for (let i = 0, n = rbIdx.length; i < n; i++) {
        const a = rbAng[i];
        if (a > state.rainbow) continue;
        const w = rbWhich[i];
        const wob = Math.sin(a * 13 + t * 1.3 + w * 2.1) * amp;
        const b = Math.floor((rbD[i] + wob) / bandW);
        if (b < 0 || b > 5) continue;
        let s = a * 1.5 - shimmer + w * 0.5;
        s -= Math.floor(s);
        buf[rbIdx[i]] = s < 0.035 ? RAINBOW_LIGHT[b] : RAINBOW[b];
      }
    }

    ctx.putImageData(image, 0, 0);

    // drifting skulls and bones
    if (state.sparks > 0) {
      for (const p of drifters) {
        if (p.gate > state.sparks) continue;
        p.y += p.vy * dt;
        if (p.y < -10) { p.y = H + 4; p.x = Math.random() * W; }
        ctx.drawImage(p.img, Math.round(p.x + Math.sin(t * 0.3 + p.ph) * p.sway), Math.round(p.y));
      }
    }

    // shockwaves
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.age += dt;
      if (w.age < 0) continue;
      const k = w.age / w.life;
      if (k >= 1) { waves.splice(i, 1); continue; }
      const r = w.r0 + (w.r1 - w.r0) * (1 - (1 - k) * (1 - k));
      const gap = k > 0.55 ? 3 : 1; // breaks up into dashes as it fades
      ctx.fillStyle = w.c;
      const step = 1 / Math.max(1, r);
      let j = 0;
      for (let a = 0; a < TAU; a += step, j++) {
        if (gap > 1 && j % gap) continue;
        ctx.fillRect(Math.round(w.x + Math.cos(a) * r), Math.round(w.y + Math.sin(a) * r), 1, 1);
      }
    }

    // ambient sparkles
    if (state.sparks > 0) {
      for (const p of ambient) {
        if (p.gate > state.sparks) continue;
        p.y += p.vy * dt;
        if (p.y < -2) { p.y = H + 2; p.x = Math.random() * W; }
        const v = Math.sin(t * p.sp + p.ph);
        if (v < -0.35) continue;
        const x = Math.round(p.x + Math.sin(t * 0.4 + p.ph) * p.sway), y = Math.round(p.y);
        ctx.fillStyle = p.c;
        ctx.fillRect(x, y, 1, 1);
        if (v > 0.93) {
          ctx.fillRect(x - 1, y, 3, 1);
          ctx.fillRect(x, y - 1, 1, 3);
        }
      }
    }

    // burst / trail particles
    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.life -= dt;
      if (p.life <= 0) { bursts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.life / p.max;
      if (k < 0.3 && ((t * 20) | 0) & 1) continue; // flicker out
      if (p.img) {
        ctx.drawImage(p.img, Math.round(p.x - p.img.width / 2), Math.round(p.y - p.img.height / 2));
        continue;
      }
      const s = k > 0.6 ? p.size : 1;
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const elapsed = now - last;
    if (elapsed < FRAME_MS - 1) return;
    const dt = Math.min(0.1, elapsed / 1000);
    last = now;
    t += dt;
    draw(dt);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const v = viewport();
      if (v.vw === lastVw && v.vh === lastVh) return;
      build();
      if (!running) draw(0);
    }, 120);
  });

  build();

  return {
    state,
    start,
    stop,
    renderStatic() { draw(0); },

    // centre the rings and glow on an element (css px)
    setCenter(x, y, half) {
      if (centerCss && centerCss.x === x && centerCss.y === y && centerCss.half === half) return;
      centerCss = { x, y, half };
      build();
      if (!running) draw(0);
    },

    burst(xCss, yCss, count = 40, power = 1) {
      const x = xCss / px, y = yCss / px;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU;
        const v = (20 + Math.random() * 70) * power;
        const life = 0.5 + Math.random() * 0.8;
        const bone = i % 7 === 0;
        bursts.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 20,
          g: 70,
          life: bone ? life + 0.4 : life,
          max: bone ? life + 0.4 : life,
          size: Math.random() < 0.35 ? 2 : 1,
          c: RAINBOW_HEX[(Math.random() * RAINBOW_HEX.length) | 0],
          img: bone ? BONES[(Math.random() * BONES.length) | 0] : null,
        });
      }
      if (bursts.length > 600) bursts.splice(0, bursts.length - 600);
    },

    trail(xCss, yCss) {
      const life = 0.35 + Math.random() * 0.4;
      bursts.push({
        x: xCss / px + (Math.random() - 0.5) * 2,
        y: yCss / px + (Math.random() - 0.5) * 2,
        vx: (Math.random() - 0.5) * 8,
        vy: -4 - Math.random() * 8,
        g: 30,
        life, max: life,
        size: 1,
        c: SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0],
      });
    },

    wave(xCss, yCss) {
      const x = xCss / px, y = yCss / px;
      const reach = Math.max(W, H) * 0.55;
      const start = (center.lhalf || 20) * 1.1;
      ['#ffffff', '#ffe95c', '#ff4f79', '#b061ff'].forEach((c, i) => {
        waves.push({ x, y, r0: start, r1: reach - i * 6, life: 0.9, age: -i * 0.07, c });
      });
    },
  };
}
