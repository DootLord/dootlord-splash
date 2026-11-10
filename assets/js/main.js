import { createBackground } from './bg.js';

/* ------------------------------------------------------------------ *
 * Config — edit these.
 * ------------------------------------------------------------------ */

// Buttons under the title. Leave empty to hide the row.
const LINKS = [
  { label: 'GitHub', href: 'https://github.com/DootLord' },
];

const TAGLINES = ['doot doot', 'bones, but shiny', 'powered by calcium', 'certified spooky', 'dootlord.meme'];

/* ------------------------------------------------------------------ */

const { gsap, ScrambleTextPlugin } = window;
gsap.registerPlugin(ScrambleTextPlugin);

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const rand = gsap.utils.random;

const stage = $('#stage');
const floatEl = $('#float');
const tilt = $('#tilt');
const card = $('#skull');
const title = $('#title');
const tag = $('#tag');
const linksEl = $('#links');
const hint = $('#hint');
const fx = $('#fx');
const sfxBtn = $('#sfx');
const sheen = $('#sheen');
const portrait = $('#portrait');

const bg = createBackground($('#bg'));

/* ---------- build DOM bits ---------- */

title.setAttribute('aria-label', title.textContent);
title.innerHTML = [...title.textContent]
  .map((c) => `<span class="ch" aria-hidden="true">${c}</span>`)
  .join('');
const letters = [...title.querySelectorAll('.ch')];

for (const l of LINKS) {
  const a = document.createElement('a');
  a.href = l.href;
  a.textContent = l.label;
  a.rel = 'noopener';
  linksEl.append(a);
}

if (!FINE) hint.textContent = 'tap the skull';

/* ---------- storage (may be unavailable) ---------- */

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

let doots = parseInt(store.get('doots', '0'), 10) || 0;
const showCount = () => { hint.textContent = `doots: ${doots}`; };
if (doots > 0) showCount();

/* ---------- sound: a tiny synthesised doot ---------- */

let soundOn = store.get('sfx', 'on') !== 'off';
let ac = null;
const NOTES = [233.08, 277.18, 311.13, 349.23, 415.3, 466.16, 349.23, 311.13];
let noteI = 0;

function syncSfx() {
  sfxBtn.textContent = soundOn ? 'SFX ON' : 'SFX OFF';
  sfxBtn.setAttribute('aria-pressed', String(soundOn));
}
syncSfx();
sfxBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  store.set('sfx', soundOn ? 'on' : 'off');
  syncSfx();
});

function playDoot() {
  if (!soundOn) return;
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;
    const f = NOTES[noteI++ % NOTES.length];

    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f * 0.92, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.035);

    const sub = ac.createOscillator();
    sub.type = 'square';
    sub.frequency.setValueAtTime(f / 2, t);

    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 4;
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + 0.04);
    lp.frequency.exponentialRampToValueAtTime(900, t + 0.22);

    const amp = ac.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
    amp.gain.setValueAtTime(0.14, t + 0.13);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);

    const subGain = ac.createGain();
    subGain.gain.value = 0.35;

    osc.connect(lp);
    sub.connect(subGain).connect(lp);
    lp.connect(amp).connect(ac.destination);
    osc.start(t); sub.start(t);
    osc.stop(t + 0.3); sub.stop(t + 0.3);
  } catch { /* no audio, no problem */ }
}

/* ---------- gloss mask: only the dark (skull) pixels catch the sheen ---------- */

async function buildSheenMask() {
  try {
    await portrait.decode();
    const c = document.createElement('canvas');
    c.width = portrait.naturalWidth;
    c.height = portrait.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(portrait, 0, 0);
    const img = x.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = lum < 62 ? 255 : 0;
    }
    x.putImageData(img, 0, 0);
    const blob = await new Promise((res) => c.toBlob(res));
    const url = `url(${URL.createObjectURL(blob)})`;
    sheen.style.webkitMaskImage = url;
    sheen.style.maskImage = url;
    sheen.classList.add('ready');
  } catch {
    // e.g. opened from file:// (tainted canvas) — just skip the sheen
  }
}

/* ---------- geometry ---------- */

function cardCenter() {
  // layout box, ignoring transforms
  let x = 0, y = 0, el = card;
  while (el) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
  return { x: x + card.offsetWidth / 2, y: y + card.offsetHeight / 2, half: card.offsetWidth / 2 };
}
function syncCenter() {
  const c = cardCenter();
  bg.setCenter(c.x, c.y, c.half);
}
let rz = 0;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(syncCenter, 150); });

/* ---------- pointer: tilt, layer parallax, sparkle trail ---------- */

const target = { nx: 0, ny: 0 };
const cur = { nx: 0, ny: 0 };
const fan = { v: 0 };
const applyFan = () => card.style.setProperty('--fan', fan.v.toFixed(3));

if (FINE && !RM) {
  let lastTrail = 0;
  window.addEventListener('pointermove', (e) => {
    target.nx = (e.clientX / window.innerWidth) * 2 - 1;
    target.ny = (e.clientY / window.innerHeight) * 2 - 1;
    if (e.timeStamp - lastTrail > 45) {
      lastTrail = e.timeStamp;
      bg.trail(e.clientX, e.clientY);
    }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { target.nx = target.ny = 0; });

  gsap.ticker.add((_, dt) => {
    const k = 1 - Math.exp(-dt / 140);
    const dx = target.nx - cur.nx, dy = target.ny - cur.ny;
    if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return;
    cur.nx += dx * k;
    cur.ny += dy * k;
    tilt.style.transform = `rotateX(${(-cur.ny * 7).toFixed(2)}deg) rotateY(${(cur.nx * 10).toFixed(2)}deg)`;
    card.style.setProperty('--sx', (-cur.nx * 2.5).toFixed(2) + 'px');
    card.style.setProperty('--sy', (-cur.ny * 2.5).toFixed(2) + 'px');
  });

  card.addEventListener('pointerenter', () => gsap.to(fan, { v: 1.6, duration: 0.35, ease: 'back.out(3)', onUpdate: applyFan, overwrite: true }));
  card.addEventListener('pointerleave', () => gsap.to(fan, { v: 1, duration: 0.5, ease: 'power2.out', onUpdate: applyFan, overwrite: true }));

  letters.forEach((l) => l.addEventListener('pointerenter', () => {
    if (gsap.isTweening(l)) return;
    gsap.timeline()
      .to(l, { yPercent: -22, rotation: rand(-8, 8), duration: 0.16, ease: 'power2.out' })
      .to(l, { yPercent: 0, rotation: 0, duration: 0.5, ease: 'bounce.out' });
    gsap.fromTo(l, { '--sheen': '0%' }, { '--sheen': '100%', duration: 0.5, ease: 'none' });
  }));
}

/* ---------- the doot ---------- */

const DOOT_COLORS = ['#ffffff', '#ffe95c', '#3fe0ff', '#ff4f79', '#b061ff', '#ff9f43'];
let live = 0;

function spawnDootText(x, y) {
  if (live > 14) return;
  live++;
  const el = document.createElement('span');
  el.className = 'doot';
  el.textContent = 'DOOT';
  el.style.setProperty('--c', DOOT_COLORS[doots % DOOT_COLORS.length]);
  fx.append(el);
  const dir = rand(-0.9, 0.15); // mostly up and to the right, like the jaw points
  const dist = rand(90, 190);
  gsap.timeline({ onComplete: () => { el.remove(); live--; } })
    .set(el, { x, y, xPercent: -50, yPercent: -50, scale: 0.2, rotation: rand(-25, 25) })
    .to(el, { scale: rand(1, 1.5), duration: 0.18, ease: 'back.out(4)' })
    .to(el, {
      x: x + Math.cos(dir) * dist,
      y: y + Math.sin(dir) * dist - 30,
      rotation: rand(-18, 18),
      duration: 0.9,
      ease: 'power2.out',
    }, 0)
    .to(el, { opacity: 0, scale: 0.6, duration: 0.25, ease: 'steps(4)' }, 0.65);
}

function doot() {
  doots++;
  store.set('doots', String(doots));
  showCount();
  playDoot();

  const r = card.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const mx = r.left + r.width * 0.86, my = r.top + r.height * 0.52; // the jaw

  bg.burst(mx, my, RM ? 12 : 46);
  if (!RM) bg.wave(cx, cy);
  spawnDootText(mx, my);
  if (RM) return;

  gsap.killTweensOf(card);
  gsap.timeline()
    .to(card, { scaleX: 1.1, scaleY: 0.9, rotation: rand(-5, 5), duration: 0.07, ease: 'power2.out' })
    .to(card, { scaleX: 1, scaleY: 1, rotation: 0, duration: 0.7, ease: 'elastic.out(1.1, 0.35)' });

  gsap.timeline()
    .to(fan, { v: 2.6, duration: 0.09, ease: 'power2.out', onUpdate: applyFan, overwrite: true })
    .to(fan, { v: card.matches(':hover') ? 1.6 : 1, duration: 0.8, ease: 'elastic.out(1, 0.4)', onUpdate: applyFan });

  gsap.fromTo('.eye', { opacity: 1, scale: 1.7 }, { opacity: 0.35, scale: 1, duration: 0.6, ease: 'power2.out', overwrite: true });
  gsap.fromTo(hint, { scale: 1.25 }, { scale: 1, duration: 0.3, ease: 'steps(4)' });
  sweepSheen(0.45);

  // every tenth doot the title celebrates
  if (doots % 10 === 0) titleWave(true);
}

card.addEventListener('click', doot);

/* ---------- reusable bits of motion ---------- */

function sweepSheen(duration = 0.9) {
  return gsap.fromTo('#sheen i', { xPercent: -140 }, { xPercent: 260, duration, ease: 'power1.inOut', overwrite: true });
}

function titleWave(big = false) {
  const tl = gsap.timeline();
  tl.to(letters, {
    yPercent: big ? -38 : -16,
    duration: 0.18,
    ease: 'power2.out',
    stagger: { each: 0.055, yoyo: true, repeat: 1, repeatDelay: 0.02 },
  }, 0);
  tl.fromTo(letters, { '--sheen': '0%' }, { '--sheen': '100%', duration: 0.55, ease: 'none', stagger: 0.055 }, 0);
  return tl;
}

function glint() {
  return gsap.timeline()
    .set('.glint', { opacity: 1, scale: 0, rotation: 0 })
    .to('.glint', { scale: 1, rotation: 45, duration: 0.22, ease: 'steps(4)' })
    .fromTo('.beam', { opacity: 1, scaleX: 0, rotation: -53 }, { scaleX: 1, duration: 0.2, ease: 'power2.out' }, 0.05)
    .to('.glint', { scale: 0, rotation: 90, duration: 0.3, ease: 'steps(5)' }, 0.3)
    .to('.beam', { opacity: 0, duration: 0.3, ease: 'steps(4)' }, 0.3)
    .set('.glint', { opacity: 0 });
}

function startIdle() {
  // hover-bob
  gsap.to(floatEl, { y: '-=10', duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  // eye smoulder
  gsap.to('.eye', { opacity: 0.85, scale: 1.15, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  // gloss sweep + glint, on a slow, slightly irregular clock
  const shine = () => {
    sweepSheen();
    gsap.delayedCall(0.35, glint);
    gsap.delayedCall(rand(5, 8), shine);
  };
  gsap.delayedCall(2.5, shine);

  // drip from the jaw
  const drip = () => {
    const fall = $('.art').offsetHeight * 0.42;
    gsap.timeline({ onComplete: () => gsap.delayedCall(rand(1.5, 4.5), drip) })
      .set('.drip', { opacity: 1, y: 0, scaleY: 0 })
      .to('.drip', { scaleY: 1, duration: 0.9, ease: 'steps(6)' })
      .to('.drip', { y: fall, scaleY: 1.6, duration: 0.55, ease: 'power2.in' })
      .set('.drip', { opacity: 0 });
  };
  gsap.delayedCall(1.2, drip);

  // title ripple
  const wave = () => { titleWave(); gsap.delayedCall(rand(7, 11), wave); };
  gsap.delayedCall(6, wave);

  // rotating tagline
  let ti = 0;
  const nextTag = () => {
    ti = (ti + 1) % TAGLINES.length;
    gsap.to(tag, {
      duration: 0.9,
      scrambleText: { text: TAGLINES[ti], chars: 'DOT01+*', speed: 0.5 },
      ease: 'none',
      onComplete: () => gsap.delayedCall(4.5, nextTag),
    });
  };
  gsap.delayedCall(5, nextTag);

  // pause the busywork when the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { gsap.globalTimeline.pause(); bg.stop(); }
    else { gsap.globalTimeline.resume(); bg.start(); }
  });
}

/* ---------- intro ---------- */

function intro() {
  // (the link buttons have their own CSS transform transitions, so move the row, not the buttons)
  const others = [tag.parentElement, linksEl, hint];

  if (RM) {
    Object.assign(bg.state, { rings: 1, rainbow: 1, sparks: 1 });
    bg.renderStatic();
    fan.v = 1; applyFan();
    gsap.set([stage, sfxBtn], { autoAlpha: 1 });
    gsap.from([stage, sfxBtn], { opacity: 0, duration: 0.6 });
    return;
  }

  bg.start();
  gsap.set([stage, sfxBtn], { autoAlpha: 1 });

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: startIdle });

  tl.to(bg.state, { rainbow: 1, duration: 1.4, ease: 'power2.inOut' }, 0)
    .to(bg.state, { rings: 1, duration: 1.6, ease: 'power2.inOut' }, 0.25)
    .to(bg.state, { sparks: 1, duration: 1.5, ease: 'none' }, 0.4)

    // skull pops in, rainbow layers fan out behind it
    .from(card, { scale: 0, rotation: -14, duration: 0.7, ease: 'back.out(1.8)' }, 0.2)
    .to(fan, { v: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)', onUpdate: applyFan }, 0.6)
    .from('.eye', { opacity: 0, scale: 0, duration: 0.5, ease: 'back.out(3)' }, 0.75)
    .add(() => { sweepSheen(0.8); glint(); }, 0.95)

    // title letters drop and bounce
    .from(letters, {
      yPercent: -160,
      opacity: 0,
      rotation: () => rand(-20, 20),
      duration: 0.75,
      ease: 'bounce.out',
      stagger: 0.06,
    }, 0.55)
    .fromTo(letters, { '--sheen': '0%' }, { '--sheen': '100%', duration: 0.6, ease: 'none', stagger: 0.05 }, 1.35)

    // the rest
    .from(others, { y: 18, opacity: 0, duration: 0.4, ease: 'steps(5)', stagger: 0.09 }, 1.25)
    .from(sfxBtn, { opacity: 0, duration: 0.4 }, 1.6)
    .to(tag, { duration: 0.8, scrambleText: { text: TAGLINES[0], chars: 'DOT01+*', speed: 0.5 }, ease: 'none' }, 1.3);
}

/* ---------- boot ---------- */

const timeout = (ms) => new Promise((r) => setTimeout(r, ms));

applyFan();
buildSheenMask();
Promise.race([
  Promise.all([document.fonts.ready, portrait.decode().catch(() => {})]),
  timeout(1500),
]).then(() => {
  syncCenter();
  intro();
});
