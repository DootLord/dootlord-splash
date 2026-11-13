// The blog: lists the Markdown files in /posts and renders them in the site's
// style. Nothing here needs a build step or a commit per post — drop a .md
// file into the posts folder on the server and it shows up.
//
//   posts/2026-11-10-my-post.md   -> listed, newest first
//   posts/_draft.md               -> hidden from the list, viewable at ?p=_draft
//
// Optional front matter at the top of a post:
//
//   ---
//   title: My post
//   date: 2026-11-10
//   tags: dev, doot
//   summary: One line for the list page.
//   ---

import { createBackground } from './bg.js';
import { installSprites } from './cv.js';

const { gsap, ScrollTrigger, marked, hljs } = window;
gsap.registerPlugin(ScrollTrigger);

const POSTS = new URL('../posts/', location.href).href;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const view = $('#view');
const progress = $('#progress');
const readSpine = $('#read-spine');

installSprites();

/* ---------- background: same canvas as the main site, minus the rings ---------- */

const bg = createBackground($('#bg'));
if (RM) {
  Object.assign(bg.state, { rainbow: 1, sparks: 1 });
  bg.renderStatic();
} else {
  bg.start();
  gsap.to(bg.state, { rainbow: 1, duration: 1.4, ease: 'power2.inOut' });
  gsap.to(bg.state, { sparks: 1, duration: 1.5, ease: 'none', delay: 0.2 });
  if (FINE) {
    let last = 0;
    window.addEventListener('pointermove', (e) => {
      if (e.timeStamp - last < 45) return;
      last = e.timeStamp;
      bg.trail(e.clientX, e.clientY);
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { gsap.globalTimeline.pause(); bg.stop(); }
    else { gsap.globalTimeline.resume(); bg.start(); }
  });
}

/* ---------- loading posts ---------- */

const visible = (name) => /\.md$/i.test(name) && !/^[._]/.test(name);

// Works with an Nginx JSON listing, any HTML directory listing, or a plain
// posts/index.json array of file names if listings are switched off.
async function listFiles() {
  try {
    const r = await fetch(POSTS, { headers: { Accept: 'application/json' }, cache: 'no-cache' });
    if (r.ok) {
      const text = await r.text();
      let files;
      try {
        const listing = JSON.parse(text);
        files = (Array.isArray(listing) ? listing : listing.entries).map((e) => (typeof e === 'string' ? { name: e } : { name: e.name, mtime: e.mtime }));
      } catch {
        files = [...text.matchAll(/href="([^"?#]+\.md)"/gi)].map((m) => ({ name: decodeURIComponent(m[1].split('/').pop()) }));
      }
      files = files.filter((f) => visible(f.name));
      if (files.length) return files;
    }
  } catch { /* fall through to the manifest */ }
  try {
    const r = await fetch(POSTS + 'index.json', { cache: 'no-cache' });
    if (r.ok) return (await r.json()).map((name) => ({ name })).filter((f) => visible(f.name));
  } catch { /* no manifest either */ }
  return [];
}

const plain = (md) => md
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[*_`~]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

function parsePost(raw, file) {
  let body = raw.replace(/^﻿/, '');
  const meta = {};
  const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fm) {
    body = body.slice(fm[0].length);
    for (const line of fm[1].split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  const slug = file.name.replace(/\.md$/i, '');
  const dated = slug.match(/^(\d{4}-\d{2}-\d{2})-?(.*)$/);

  // a leading "# Heading" is the title, not part of the body
  const h1 = body.match(/^\s*#\s+(.+?)\s*(?:\r?\n|$)/);
  if (h1) body = body.slice(h1[0].length);
  const title = meta.title || (h1 && h1[1]) || ((dated && dated[2]) || slug).replace(/[-_]+/g, ' ').trim();

  const date = meta.date || (dated && dated[1]) || (file.mtime ? new Date(file.mtime).toISOString().slice(0, 10) : '');
  const tags = (meta.tags || '').replace(/^\[|\]$/g, '').split(',').map((t) => t.trim()).filter(Boolean);
  const mins = Math.max(1, Math.round(body.split(/\s+/).length / 220));

  let summary = meta.summary || '';
  if (!summary) {
    const para = body.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).find((b) => b && !/^(#|>|```|~~~|!\[|\||[-*+] |\d+\. |---|<)/.test(b));
    summary = para ? plain(para) : '';
    if (summary.length > 190) summary = summary.slice(0, 187).replace(/\s+\S*$/, '') + '…';
  }
  return { slug, title, date, tags, mins, summary, body };
}

async function fetchPost(file) {
  const r = await fetch(POSTS + encodeURIComponent(file.name), { cache: 'no-cache' });
  if (!r.ok) throw new Error(r.status);
  return parsePost(await r.text(), file);
}

let postsPromise = null;
const loadPosts = () => (postsPromise ??= (async () => {
  const files = await listFiles();
  const posts = (await Promise.all(files.map((f) => fetchPost(f).catch(() => null)))).filter(Boolean);
  return posts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));
})());

const fmtDate = (d) => {
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/* ---------- markup ---------- */

const chips = (tags, cls = '') => (tags.length ? `<ul class="chips ${cls}">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');
const metaLine = (p) => `<p class="post-meta">${p.date ? `<span>${esc(fmtDate(p.date))}</span>` : ''}<span>${p.mins} min read</span></p>`;

function indexHtml(posts) {
  const tags = [...new Set(posts.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b));
  return `
    <section class="sec blog-index">
      <header class="sec-head reveal">
        <p class="kicker"><span>${String(posts.length).padStart(2, '0')}</span>transmissions</p>
        <h1 class="gloss">Blog</h1>
        <span class="bone-rule" aria-hidden="true"></span>
      </header>
      ${tags.length > 1 ? `
      <div class="tagbar reveal" role="group" aria-label="Filter by tag">
        <button type="button" class="tag-btn on" data-tag="">all</button>
        ${tags.map((t) => `<button type="button" class="tag-btn" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>` : ''}
      ${posts.length ? `
      <div class="post-list">
        ${posts.map((p) => `
        <a class="panel project post-card reveal" href="?p=${encodeURIComponent(p.slug)}" data-post="${esc(p.slug)}" data-tags="${esc(p.tags.join('|'))}">
          ${metaLine(p)}
          <h2 class="post-card-title">${esc(p.title)}</h2>
          ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
          ${chips(p.tags)}
          <span class="open">read &gt;</span>
        </a>`).join('')}
      </div>` : `
      <div class="panel reveal empty">
        <span class="empty-skull" aria-hidden="true"></span>
        <p>Nothing here yet. The skeleton is still thinking of something to say.</p>
      </div>`}
    </section>`;
}

function postHtml(post, newer, older) {
  const nav = (p, label, cls) => (p ? `
        <a class="panel project ${cls}" href="?p=${encodeURIComponent(p.slug)}" data-post="${esc(p.slug)}">
          <span class="post-nav-label">${label}</span>
          <span class="post-nav-title">${esc(p.title)}</span>
        </a>` : '<span></span>');
  return `
    <article class="post">
      <a class="back" href="./" data-index>&lt; all posts</a>
      <header class="post-head">
        ${metaLine(post)}
        <h1 class="gloss post-title">${esc(post.title)}</h1>
        ${chips(post.tags, 'post-tags')}
        <span class="bone-rule" aria-hidden="true"></span>
      </header>
      <div class="prose" id="prose"></div>
      <footer class="post-end">
        <div class="bones-hr fin" aria-hidden="true"><i class="bone-rule"></i><b class="hr-skull"></b><i class="bone-rule"></i></div>
        <p class="fin-label">fin</p>
        <nav class="post-nav" aria-label="More posts">
          ${nav(newer, '&lt; newer', 'post-newer')}
          ${nav(older, 'older &gt;', 'post-older')}
        </nav>
      </footer>
    </article>`;
}

/* ---------- Markdown -> themed DOM ---------- */

const CALLOUTS = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'note', WARNING: 'warn', CAUTION: 'warn', DOOT: 'doot' };
const slugify = (s) => s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

function renderProse(target, md) {
  target.innerHTML = marked.parse(md, { gfm: true });

  // headings: anchors, and the big ones get the glossy treatment
  const seen = new Set();
  $$('h1, h2, h3, h4', target).forEach((h) => {
    let id = slugify(h.textContent) || 'section';
    while (seen.has(id)) id += '-';
    seen.add(id);
    h.id = id;
    if (h.tagName === 'H1' || h.tagName === 'H2') h.classList.add('gloss');
  });

  // links and images: resolve relative paths against the posts folder
  $$('a[href]', target).forEach((a) => {
    const href = a.getAttribute('href');
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
    } else if (/\.md$/i.test(href)) {
      const slug = href.split('/').pop().replace(/\.md$/i, '');
      a.setAttribute('href', '?p=' + encodeURIComponent(slug));
      a.dataset.post = slug;
    } else if (!href.startsWith('#') && !href.startsWith('/')) {
      a.setAttribute('href', POSTS + href);
    }
  });
  $$('img', target).forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (!/^([a-z][a-z0-9+.-]*:|\/)/i.test(src)) img.setAttribute('src', POSTS + src);
    img.loading = 'lazy';
    img.decoding = 'async';
    // an image on its own line becomes a framed figure with a caption
    // (a bare <img> line is an HTML block, so it sits straight in the prose)
    let p = img.parentElement;
    if (p === target) {
      p = document.createElement('p');
      img.replaceWith(p);
      p.append(img);
    }
    if (p.tagName === 'P' && p.childNodes.length === 1) {
      const fig = document.createElement('figure');
      fig.className = 'shot';
      const caption = img.title || img.alt;
      img.removeAttribute('title');
      fig.append(img);
      if (caption) {
        const cap = document.createElement('figcaption');
        cap.textContent = caption;
        fig.append(cap);
      }
      p.replaceWith(fig);
    }
  });

  // code blocks: a little terminal window with a copy button
  $$('pre > code', target).forEach((code) => {
    const pre = code.parentElement;
    const lang = (code.className.match(/language-([\w+#-]+)/) || [])[1] || '';
    if (lang && hljs.getLanguage(lang)) {
      try { code.innerHTML = hljs.highlight(code.textContent, { language: lang }).value; } catch { /* leave it plain */ }
    }
    const fig = document.createElement('figure');
    fig.className = 'code';
    fig.innerHTML = `
      <div class="code-bar">
        <span class="code-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="code-lang">${esc(lang || 'text')}</span>
        <button type="button" class="code-copy">copy</button>
      </div>`;
    pre.replaceWith(fig);
    fig.append(pre);
  });

  // blockquotes: "> [!NOTE]" style callouts, otherwise a quote with a spine
  $$('blockquote', target).forEach((q) => {
    const first = q.firstElementChild;
    const m = first && first.tagName === 'P' && first.innerHTML.match(/^\s*\[!(\w+)\]\s*(?:<br\s*\/?>)?\s*/i);
    const kind = m && CALLOUTS[m[1].toUpperCase()];
    if (kind) {
      first.innerHTML = first.innerHTML.slice(m[0].length);
      if (!first.textContent.trim() && !first.children.length) first.remove();
      q.className = `callout callout-${kind}`;
      const label = document.createElement('p');
      label.className = 'callout-label';
      label.textContent = m[1].toLowerCase();
      q.prepend(label);
    } else {
      q.className = 'quote';
      const spine = document.createElement('span');
      spine.className = 'q-spine';
      spine.setAttribute('aria-hidden', 'true');
      q.prepend(spine);
    }
  });

  // tables scroll sideways on small screens rather than breaking the page
  $$('table', target).forEach((t) => {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    t.replaceWith(wrap);
    wrap.append(t);
  });

  // horizontal rules become two bones and a skull
  $$('hr', target).forEach((hr) => {
    const div = document.createElement('div');
    div.className = 'bones-hr';
    div.setAttribute('role', 'separator');
    div.innerHTML = '<i class="bone-rule"></i><b class="hr-skull"></b><i class="bone-rule"></i>';
    hr.replaceWith(div);
  });

  const lead = $$(':scope > p', target)[0];
  if (lead && target.firstElementChild === lead && /^[A-Za-z]/.test(lead.textContent.trim())) lead.classList.add('lead-para');
}

/* ---------- motion ---------- */

let triggers = [];
const track = (t) => { triggers.push(t); return t; };
function clearMotion() {
  triggers.forEach((t) => t.kill());
  triggers = [];
  gsap.killTweensOf(progress);
}

// each kind of block arrives in its own way
function enter(el, delay) {
  const base = { opacity: 1, duration: 0.5, ease: 'power3.out', delay, overwrite: true, clearProps: 'transform,opacity' };
  if (el.matches('.shot')) {
    gsap.fromTo(el, { opacity: 0, scale: 0.9, rotation: -2, y: 24 }, { ...base, scale: 1, rotation: 0, y: 0, duration: 0.6, ease: 'back.out(1.6)' });
  } else if (el.matches('.code')) {
    gsap.fromTo(el, { opacity: 0, x: -26 }, { ...base, x: 0 });
    gsap.from($$('.code-dots i', el), { scale: 0, duration: 0.25, ease: 'back.out(4)', stagger: 0.07, delay: delay + 0.2 });
  } else if (el.matches('.quote')) {
    gsap.fromTo(el, { opacity: 0, x: 22 }, { ...base, x: 0 });
    const s = $('.q-spine', el);
    if (s) gsap.fromTo(s, { '--p': '0%' }, { '--p': '100%', duration: 0.7, ease: 'steps(10)', delay: delay + 0.15 });
  } else if (el.matches('.callout')) {
    gsap.fromTo(el, { opacity: 0, scale: 0.96, y: 16 }, { ...base, scale: 1, y: 0, ease: 'back.out(1.8)' });
  } else if (el.matches('.bones-hr')) {
    gsap.set(el, { opacity: 1 });
    gsap.from($('.hr-skull', el), { scale: 0, rotation: -40, duration: 0.45, ease: 'back.out(3)', delay });
    const [l, r] = $$('.bone-rule', el);
    gsap.from(l, { scaleX: 0, transformOrigin: '100% 50%', duration: 0.5, ease: 'steps(8)', delay: delay + 0.15 });
    gsap.from(r, { scaleX: 0, transformOrigin: '0% 50%', duration: 0.5, ease: 'steps(8)', delay: delay + 0.15 });
  } else if (el.matches('.gloss')) {
    gsap.fromTo(el, { opacity: 0, x: -18 }, { ...base, x: 0 });
    gsap.fromTo(el, { '--sheen': '0%' }, { '--sheen': '100%', duration: 0.8, ease: 'none', delay: delay + 0.15 });
  } else if (el.matches('ul, ol')) {
    gsap.set(el, { opacity: 1 });
    gsap.from(el.children, { opacity: 0, x: -14, duration: 0.35, ease: 'power2.out', stagger: 0.06, delay, clearProps: 'transform,opacity' });
  } else {
    gsap.fromTo(el, { opacity: 0, y: 22 }, { ...base, y: 0 });
  }
  const rule = el.matches('.sec-head, .post-head') && $('.bone-rule', el);
  if (rule) gsap.from(rule, { scaleX: 0, duration: 0.6, ease: 'steps(10)', delay: delay + 0.1 });
  const h = el.matches('.sec-head, .post-head') && $('.gloss', el);
  if (h) gsap.fromTo(h, { '--sheen': '0%' }, { '--sheen': '100%', duration: 0.9, ease: 'none', delay: delay + 0.2 });
  const cs = el.matches('.prose *') ? [] : $$('.chips li', el);
  if (cs.length) gsap.from(cs, { scale: 0, duration: 0.3, ease: 'back.out(2.5)', stagger: 0.03, delay: delay + 0.25 });
  // inline emphasis: bold stamps in, italics catch the sheen
  $$('strong', el).filter((s) => !s.closest('a, h1, h2, h3, h4')).forEach((s, i) => {
    // drop the class once it has played, or un-hovering would replay it
    s.addEventListener('animationend', (e) => { if (e.animationName === 'bold-zap') s.classList.remove('zap'); });
    gsap.delayedCall(delay + 0.35 + i * 0.12, () => s.classList.add('zap'));
  });
  $$('em', el).filter((e) => !e.closest('h1, h2, h3, h4')).forEach((e, i) => sweepEm(e, delay + 0.4 + i * 0.1));
}

function sweepEm(em, delay = 0) {
  gsap.fromTo(em, { '--sheen': '0%' }, { '--sheen': '100%', duration: 0.8, ease: 'none', delay, overwrite: true });
}

// italics re-catch the sheen whenever the pointer moves onto them
if (!RM) {
  view.addEventListener('mouseover', (e) => {
    const em = e.target.closest?.('.prose em');
    if (em && !em.contains(e.relatedTarget) && !gsap.isTweening(em)) sweepEm(em);
  });
}

function revealAll(els) {
  if (RM || !els.length) return;
  gsap.set(els, { opacity: 0 });
  ScrollTrigger.batch(els, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => batch.forEach((el, i) => enter(el, i * 0.07)),
  }).forEach(track);
}

/* ---------- views ---------- */

function showIndex(posts) {
  document.title = 'Blog — DOOTLORD';
  view.innerHTML = indexHtml(posts);
  document.body.classList.remove('reading');
  revealAll($$('.reveal', view));

  const cards = $$('.post-card', view);
  $$('.tag-btn', view).forEach((btn) => btn.addEventListener('click', () => {
    $$('.tag-btn', view).forEach((b) => b.classList.toggle('on', b === btn));
    const tag = btn.dataset.tag;
    const show = cards.filter((c) => !tag || c.dataset.tags.split('|').includes(tag));
    cards.forEach((c) => { c.hidden = !show.includes(c); });
    if (!RM) gsap.fromTo(show, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.3, ease: 'steps(5)', stagger: 0.05, overwrite: true, clearProps: 'transform,opacity' });
    ScrollTrigger.refresh();
  }));
}

async function showPost(slug, posts) {
  let post = posts.find((p) => p.slug === slug);
  // drafts (_name.md) aren't listed, but can still be opened by name
  if (!post) post = await fetchPost({ name: slug + '.md' }).catch(() => null);
  if (!post) {
    document.title = 'Not found — DOOTLORD';
    view.innerHTML = `
      <section class="sec">
        <div class="panel empty">
          <span class="empty-skull" aria-hidden="true"></span>
          <p>That post has wandered off.</p>
          <a class="btn" href="./" data-index>all posts</a>
        </div>
      </section>`;
    document.body.classList.remove('reading');
    return;
  }

  const i = posts.indexOf(post);
  document.title = `${post.title} — DOOTLORD`;
  view.innerHTML = postHtml(post, i > 0 ? posts[i - 1] : null, i >= 0 ? posts[i + 1] : null);
  renderProse($('#prose'), post.body);
  document.body.classList.add('reading');

  $$('.code-copy', view).forEach((btn) => btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('pre', btn.closest('.code')).textContent);
      btn.textContent = 'copied!';
    } catch { btn.textContent = 'failed'; }
    btn.classList.add('done');
    setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('done'); }, 1400);
  }));

  // reading progress: rainbow bar under the nav, and a spine in the margin
  const spine = $('.spine', readSpine);
  const spineEnd = $('.spine-end', readSpine);
  const setProgress = (p) => {
    gsap.set(progress, { scaleX: p });
    spine.style.setProperty('--p', (p * 100).toFixed(1) + '%');
    spineEnd.classList.toggle('on', p >= 0.995);
  };
  setProgress(0);
  track(ScrollTrigger.create({
    trigger: '#prose',
    start: 'top 70%',
    end: 'bottom 75%',
    onUpdate: (self) => setProgress(self.progress),
    onRefresh: (self) => setProgress(self.progress),
  }));

  if (RM) return;
  gsap.from('.back', { opacity: 0, x: 12, duration: 0.3, ease: 'steps(4)' });
  gsap.from(readSpine, { opacity: 0, y: -20, duration: 0.5, ease: 'back.out(2)', delay: 0.3, clearProps: 'transform,opacity' });
  revealAll([$('.post-head', view), ...$$('#prose > *', view), ...$$('.post-end > *', view)]);
  // images change the page height as they load
  $$('#prose img', view).forEach((img) => img.addEventListener('load', () => ScrollTrigger.refresh(), { once: true }));
}

let navigating = 0;
async function route({ animate = true } = {}) {
  const token = ++navigating;
  const slug = new URLSearchParams(location.search).get('p');
  const out = animate && !RM && view.firstElementChild;
  const [posts] = await Promise.all([
    loadPosts(),
    out ? gsap.to(view, { opacity: 0, y: -18, duration: 0.22, ease: 'steps(5)' }) : null,
  ]);
  if (token !== navigating) return;
  clearMotion();
  gsap.set(progress, { scaleX: 0 });
  window.scrollTo(0, 0);
  gsap.set(view, { clearProps: 'all' });
  if (slug) await showPost(slug, posts);
  else showIndex(posts);
  ScrollTrigger.refresh();
}

// internal navigation without a page reload
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-post], a[data-index]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const url = a.dataset.post ? '?p=' + encodeURIComponent(a.dataset.post) : location.pathname;
  if (url === location.search || (url === location.pathname && !location.search)) return;
  if (!RM) bg.burst(e.clientX, e.clientY, 26, 0.8);
  history.pushState(null, '', url);
  route();
});
window.addEventListener('popstate', () => route());

const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
Promise.race([document.fonts.ready, timeout(1500)]).then(() => route({ animate: false }));
