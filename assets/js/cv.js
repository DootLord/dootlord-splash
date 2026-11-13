// The CV half of the site: renders the sections from content.js and wires up
// the scroll-driven motion (splash hand-off, sticky bar, reveals, spine).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const has = (a) => Array.isArray(a) && a.length > 0;

/* ---------- pixel sprites as CSS images ---------- */

const SPRITE_COLORS = { X: '#46515c', H: '#b4c0cc', G: '#7dffc8', D: '#161a20', C: '#2f8f72', N: '#7dffc8' };
function spriteUrl(rows) {
  const w = rows[0].length, h = rows.length;
  let rects = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${SPRITE_COLORS[ch]}"/>`;
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const SPRITES = {
  '--img-skull': ['.XXXXX.', 'XHHXXXX', 'XHXXXXX', 'XGGXGGX', 'XGGXGGX', 'XXXDXXX', '.XXXXX.', '.XDXDX.'],
  // one vertebra + a stretch of glowing cord; tiles vertically
  '--img-spine': ['.HXX.', 'HXXXX', '.XXX.', '..C..', '..C..'],
  '--img-chevron': ['N.....N', 'NN...NN', '.NN.NN.', '..NNN..', '...N...'],
};

/* ---------- markup ---------- */

const chips = (items) => (has(items) ? `<ul class="chips">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');

const head = (n, kicker, title) => `
  <header class="sec-head reveal">
    <p class="kicker"><span>${String(n).padStart(2, '0')}</span>${esc(kicker)}</p>
    <h2 class="gloss">${esc(title)}</h2>
    <span class="bone-rule" aria-hidden="true"></span>
  </header>`;

const SECTIONS = [
  {
    id: 'about', nav: 'About', kicker: 'character sheet',
    show: (c) => !!c.about,
    body: ({ about: a }) => `
      <div class="about-grid">
        <div class="panel reveal">
          <p class="lead">${esc(a.name)}</p>
          <p class="lead-role">${esc(a.role)}</p>
          ${(a.bio || []).map((p) => `<p>${esc(p)}</p>`).join('')}
        </div>
        ${has(a.stats) ? `
        <div class="panel reveal">
          <h3 class="panel-title">Stats</h3>
          <dl class="stats">
            ${a.stats.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}
          </dl>
        </div>` : ''}
      </div>
      ${has(a.education) ? `
      <div class="panel reveal edu">
        <h3 class="panel-title">Education</h3>
        <ul class="rows">
          ${a.education.map((e) => `
          <li>
            <span class="row-main">${esc(e.title)}</span>
            <span class="row-sub">${esc(e.place)}</span>
            <span class="row-when">${esc(e.period)}</span>
            ${has(e.projects) ? `
            <ul class="points edu-projects">
              ${e.projects.map((p) => `<li><span class="row-main">${esc(p.name)}</span> ${esc(p.summary)}</li>`).join('')}
            </ul>` : ''}
          </li>`).join('')}
        </ul>
      </div>` : ''}`,
  },
  {
    id: 'skills', nav: 'Skills', kicker: 'abilities',
    show: (c) => has(c.skills),
    body: ({ skills }) => `
      <div class="grid">
        ${skills.map((g) => `
        <div class="panel reveal">
          <h3 class="panel-title">${esc(g.group)}</h3>
          ${chips(g.items)}
        </div>`).join('')}
      </div>`,
  },
  {
    id: 'career', nav: 'Career', kicker: 'quest log',
    show: (c) => has(c.experience),
    body: ({ experience }) => `
      <div class="timeline">
        <span class="spine-skull" aria-hidden="true"></span>
        <span class="spine" aria-hidden="true"></span>
        <span class="spine-end" aria-hidden="true"></span>
        <ol>
          ${experience.map((j) => `
          <li class="job reveal">
            <span class="rib" aria-hidden="true"></span>
            <article class="panel">
              <h3 class="job-role">${esc(j.role)}</h3>
              <p class="job-meta">
                <span class="job-co">${esc(j.company)}</span>
                ${j.period ? `<span>${esc(j.period)}</span>` : ''}
                ${j.location ? `<span>${esc(j.location)}</span>` : ''}
              </p>
              ${j.summary ? `<p>${esc(j.summary)}</p>` : ''}
              ${has(j.points) ? `<ul class="points">${j.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
              ${chips(j.tags)}
            </article>
          </li>`).join('')}
        </ol>
      </div>`,
  },
  {
    id: 'projects', nav: 'Projects', kicker: 'loot',
    show: (c) => has(c.projects),
    body: ({ projects }) => `
      <div class="grid grid-wide">
        ${projects.map((p) => {
          const tag = p.href ? 'a' : 'div';
          const attrs = p.href ? ` href="${esc(p.href)}" rel="noopener"` : '';
          return `
        <${tag} class="panel project reveal"${attrs}>
          <h3 class="job-role">${esc(p.name)}</h3>
          <p>${esc(p.blurb)}</p>
          ${chips(p.tags)}
          ${p.href ? '<span class="open">open &gt;</span>' : ''}
        </${tag}>`;
        }).join('')}
      </div>`,
  },
  {
    id: 'personal', nav: 'Personal', kicker: 'side quests',
    show: (c) => has(c.personal),
    body: ({ personal }) => `
      <div class="grid">
        ${personal.map((p) => `
        <div class="panel reveal">
          <h3 class="panel-title">${esc(p.title)}</h3>
          <p>${esc(p.text)}</p>
        </div>`).join('')}
      </div>`,
  },
  {
    id: 'contact', nav: 'Contact', kicker: 'summon',
    show: (c) => !!c.contact && has(c.contact.links),
    body: ({ contact }) => `
      <div class="panel reveal contact">
        ${contact.blurb ? `<p>${esc(contact.blurb)}</p>` : ''}
        <div class="links">
          ${contact.links.filter((l) => l.href).map((l) => `<a class="btn" href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a>`).join('')}
        </div>
      </div>`,
  },
];

// exposes the sprites to CSS as --img-skull, --img-spine, --img-chevron
export function installSprites() {
  for (const [name, rows] of Object.entries(SPRITES)) {
    document.documentElement.style.setProperty(name, spriteUrl(rows));
  }
}

export function renderCV(root, nav, content) {
  installSprites();
  const shown = SECTIONS.filter((s) => s.show(content));
  root.innerHTML = shown.map((s, i) => `
    <section class="sec" id="${s.id}" aria-label="${s.nav}">
      ${head(i + 1, s.kicker, s.nav)}
      ${s.body(content)}
    </section>`).join('');
  nav.innerHTML = shown.map((s) => `<a href="#${s.id}">${s.nav}</a>`).join('') + '<a href="blog/">Blog</a>';
  return shown.map((s) => s.id);
}

/* ---------- motion ---------- */

export function initCVMotion({ gsap, ScrollTrigger, bg, reduced, ids }) {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const bar = $('#bar');
  const nav = $('#nav');
  const sfx = $('#sfx');

  /* in-page links glide rather than jump */
  const goTo = (hash) => {
    const el = hash === '#top' ? null : $(hash);
    const y = el ? el.getBoundingClientRect().top + window.scrollY - 64 : 0;
    if (reduced) { window.scrollTo(0, y); return; }
    const dist = Math.abs(y - window.scrollY);
    gsap.to(window, {
      scrollTo: { y, autoKill: true },
      duration: gsap.utils.clamp(0.7, 1.5, dist / 1400),
      ease: 'power2.inOut',
      overwrite: true,
    });
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    e.preventDefault();
    if (a.classList.contains('more') && !reduced) {
      const r = a.getBoundingClientRect();
      bg.burst(r.left + r.width / 2, r.top + r.height / 2, 30, 0.8);
    }
    goTo(a.getAttribute('href'));
    history.replaceState(null, '', a.getAttribute('href') === '#top' ? location.pathname : a.getAttribute('href'));
  });

  /* sticky bar swaps in as the splash leaves (and the SFX toggle bows out) */
  gsap.set(bar, { yPercent: -110, autoAlpha: 0 });
  const showBar = (on) => {
    const d = reduced ? 0 : 0.35;
    gsap.to(bar, { yPercent: on ? 0 : -110, autoAlpha: on ? 1 : 0, duration: d, ease: 'power3.out', overwrite: true });
    gsap.to(sfx, { autoAlpha: on ? 0 : 1, duration: d * 0.6, overwrite: true });
  };
  ScrollTrigger.create({
    trigger: '#cv',
    start: 'top 62%',
    onEnter: () => showBar(true),
    onLeaveBack: () => showBar(false),
  });

  /* nav highlight follows the section under the reader's eye */
  const links = new Map($$('a', nav).map((a) => [a.getAttribute('href').slice(1), a]));
  ids.forEach((id) => {
    ScrollTrigger.create({
      trigger: '#' + id,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: ({ isActive }) => {
        const a = links.get(id);
        a.classList.toggle('on', isActive);
        if (isActive) nav.scrollTo({ left: a.offsetLeft - nav.offsetWidth / 2 + a.offsetWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
      },
    });
  });

  /* "see more" bows out as soon as the reader starts scrolling, and returns at the very top */
  const more = $('.more');
  if (more) {
    ScrollTrigger.create({
      start: 2,
      end: 'max',
      onToggle: ({ isActive }) => more.classList.toggle('gone', isActive),
    });
  }

  const spine = $('.spine');
  const spineEnd = $('.spine-end');
  const setSpine = (p) => {
    spine.style.setProperty('--p', (p * 100).toFixed(1) + '%');
    spineEnd?.classList.toggle('on', p >= 0.995);
  };

  if (reduced) {
    if (spine) setSpine(1);
    return;
  }

  /* splash recedes and the rings unwind as you scroll away from it */
  gsap.timeline({ scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: 0.5 } })
    .fromTo('#stage', { yPercent: 0, scale: 1, opacity: 1 }, { yPercent: 12, scale: 0.84, opacity: 0, ease: 'none', duration: 1 }, 0)
    .fromTo(bg.state, { dim: 0 }, { dim: 1, ease: 'none', duration: 1 }, 0);

  /* "see more" arrow nudges downward */
  gsap.to('.more-arrow', { y: 6, duration: 0.6, ease: 'steps(3)', yoyo: true, repeat: -1 });

  /* the spine grows down the career timeline with the scroll */
  if (spine) {
    ScrollTrigger.create({
      trigger: '.timeline',
      start: 'top 75%',
      end: 'bottom 65%',
      scrub: true,
      onUpdate: ({ progress }) => setSpine(progress),
    });
    gsap.from('.spine-skull', {
      scale: 0, rotation: -30, duration: 0.5, ease: 'back.out(3)',
      scrollTrigger: { trigger: '.timeline', start: 'top 80%', once: true },
    });
  }

  /* everything else pops in as it arrives */
  gsap.set('.reveal', { opacity: 0, y: 30 });
  ScrollTrigger.batch('.reveal', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => {
      gsap.to(els, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.09, overwrite: true });
      els.forEach((el, i) => {
        const at = i * 0.09;
        const h = $('.gloss', el);
        if (h) gsap.fromTo(h, { '--sheen': '0%' }, { '--sheen': '100%', duration: 0.9, ease: 'none', delay: at + 0.2 });
        const rule = $('.bone-rule', el);
        if (rule) gsap.from(rule, { scaleX: 0, duration: 0.6, ease: 'steps(10)', delay: at + 0.1 });
        const rib = $('.rib', el);
        if (rib) gsap.from(rib, { scaleX: 0, duration: 0.3, ease: 'steps(5)', delay: at + 0.15 });
        const cs = $$('.chips li', el);
        if (cs.length) gsap.from(cs, { scale: 0, duration: 0.3, ease: 'back.out(2.5)', stagger: 0.03, delay: at + 0.25 });
        $$('.stats dd', el).forEach((dd, j) => {
          gsap.to(dd, { duration: 0.7, scrambleText: { text: dd.textContent, chars: '01+*#', speed: 0.6 }, ease: 'none', delay: at + 0.2 + j * 0.08 });
        });
      });
    },
  });
}
