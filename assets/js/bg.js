// Low-resolution pixel-art background.
//
// The canvas is rendered at roughly 1/5th of the viewport and scaled up with
// nearest-neighbour filtering, so the whole scene is ~80k pixels regardless of
// screen size. Each frame is one typed-array copy of a pre-dithered base plus
// a few thousand sparse pixel writes (rings + rainbows) and ~100 fillRects
// (sparkles). It runs at 30fps on purpose: cheaper, and it reads as pixel art.

const TAU = Math.PI * 2;
const FRAME_MS = 1000 / 30;

// 0xAABBGGRR (little-endian ImageData)
const rgba = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
};
const lighten = (hex, k = 0.55) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(c + (255 - c) * k);
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
};

const BASE_SHADES = ['#93edc4', '#88e6ba', '#7cdeb0', '#70d5a5', '#66cc9c'].map(rgba);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const RAINBOW_HEX = ['#ff4f79', '#ff9f43', '#ffe95c', '#3fe0ff', '#5b7bff', '#b061ff'];
const RAINBOW = RAINBOW_HEX.map(rgba);
const RAINBOW_LIGHT = RAINBOW_HEX.map((h) => lighten(h));

const RINGS = [
  { r: 1.32, color: rgba('#fff7d6'), dashes: 3, duty: 0.72, speed: 0.012 },
  { r: 1.62, color: rgba('#ffc6e4'), dashes: 24, duty: 0.5, speed: -0.02 },
  { r: 2.0, color: rgba('#d4fbff'), dashes: 5, duty: 0.55, speed: 0.03 },
  { r: 2.55, color: rgba('#ffffff'), dashes: 48, duty: 0.34, speed: -0.008 },
  { r: 3.3, color: rgba('#e0c8ff'), dashes: 7, duty: 0.6, speed: 0.016 },
];

const SPARK_COLORS = ['#ffffff', '#ffe95c', '#b061ff', '#3fe0ff', '#ff4f79', '#fff7d6'];

export function createBackground(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });

  // animatable by the intro timeline
  const state = { rings: 0, rainbow: 0, sparks: 0 };

  let px = 5, W = 0, H = 0;
  let image, buf, base;
  let center = { x: 0.5, y: 0.4, half: 0.1 }; // viewport fractions / css px set via setCenter
  let centerCss = null;

  let ringIdx, ringAng, ringK;
  let rbIdx, rbD, rbAng, rbWhich, bandW = 3;

  const ambient = [];
  const bursts = [];
  const waves = [];

  let running = false, raf = 0, last = 0, t = 0;

  function build() {
    const vw = window.innerWidth, vh = window.innerHeight;
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

    // dithered vertical gradient
    const n = BASE_SHADES.length - 1;
    for (let y = 0; y < H; y++) {
      const v = (y / H) * n;
      for (let x = 0; x < W; x++) {
        const b = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        base[y * W + x] = BASE_SHADES[Math.min(n, Math.floor(v + b))];
      }
    }

    const cx = centerCss ? centerCss.x / px : W * center.x;
    const cy = centerCss ? centerCss.y / px : H * center.y;
    const half = centerCss ? centerCss.half / px : Math.min(W, H) * 0.2;
    center = { ...center, lx: cx, ly: cy, lhalf: half };

    // rings: collect the pixels that sit on each circle
    const radii = RINGS.map((r) => r.r * half);
    const maxR = radii[radii.length - 1] + 1;
    const ri = [], ra = [], rk = [];
    const y0 = Math.max(0, Math.floor(cy - maxR)), y1 = Math.min(H - 1, Math.ceil(cy + maxR));
    const x0 = Math.max(0, Math.floor(cx - maxR)), x1 = Math.min(W - 1, Math.ceil(cx + maxR));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxR) continue;
        for (let k = 0; k < radii.length; k++) {
          if (Math.abs(d - radii[k]) < 0.5) {
            ri.push(y * W + x);
            ra.push((Math.atan2(dy, dx) + Math.PI) / TAU);
            rk.push(k);
            break;
          }
        }
      }
    }
    ringIdx = Uint32Array.from(ri);
    ringAng = Float32Array.from(ra);
    ringK = Uint8Array.from(rk);

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
  }

  function draw(dt) {
    buf.set(base);

    // rings
    if (state.rings > 0) {
      const rot = RINGS.map((r) => t * r.speed);
      const rev = RINGS.map((_, k) => Math.max(0, Math.min(1, state.rings * 1.8 - k * 0.2)));
      for (let i = 0, n = ringIdx.length; i < n; i++) {
        const k = ringK[i];
        const a = ringAng[i];
        if (a > rev[k]) continue;
        const ring = RINGS[k];
        let p = (a + rot[k]) * ring.dashes;
        p -= Math.floor(p);
        if (p < ring.duty) buf[ringIdx[i]] = ring.color;
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
    resizeTimer = setTimeout(() => { build(); if (!running) draw(0); }, 120);
  });

  build();

  return {
    state,
    start,
    stop,
    renderStatic() { draw(0); },

    // centre the rings on an element (css px)
    setCenter(x, y, half) {
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
        bursts.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 20,
          g: 70,
          life, max: life,
          size: Math.random() < 0.35 ? 2 : 1,
          c: RAINBOW_HEX[(Math.random() * RAINBOW_HEX.length) | 0],
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
