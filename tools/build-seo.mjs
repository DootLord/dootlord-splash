// Generates the crawlable (SEO) side of the site. Run after adding or editing
// posts or content.js:
//
//   node tools/build-seo.mjs
//
// It writes, without touching how the site looks or behaves in a browser:
//   - head metadata + readable fallback content into index.html and blog/index.html
//     (between the <!-- seo:head --> and <!-- seo:body --> markers)
//   - one static page per post at blog/<slug>/index.html
//   - posts/index.json, sitemap.xml, and feed.xml
// The scripts still take over in the browser and render the themed version.

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://dootlord.meme';
const SITE_NAME = 'DOOTLORD';
const IMAGE = `${SITE}/assets/img/dootlord.png`;
const SOCIAL_IMAGE = `${SITE}/assets/img/social-preview.png`;
const { marked } = createRequire(import.meta.url)(join(ROOT, 'assets/vendor/marked.min.js'));
const { CONTENT } = await import(pathToFileURL(join(ROOT, 'assets/js/content.js')).href);

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const write = (p, s) => { mkdirSync(dirname(join(ROOT, p)), { recursive: true }); writeFileSync(join(ROOT, p), s); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

function fill(html, name, content) {
  const re = new RegExp(`(<!-- seo:${name} -->)[\\s\\S]*?(<!-- /seo:${name} -->)`);
  if (!re.test(html)) throw new Error(`missing seo:${name} markers`);
  return html.replace(re, () => `<!-- seo:${name} -->\n${content}\n<!-- /seo:${name} -->`);
}

/* ---------- posts (same rules as assets/js/blog.js) ---------- */

const plain = (md) => md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim();

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
  const slug = file.replace(/\.md$/i, '');
  const dated = slug.match(/^(\d{4}-\d{2}-\d{2})-?(.*)$/);
  const h1 = body.match(/^\s*#\s+(.+?)\s*(?:\r?\n|$)/);
  if (h1) body = body.slice(h1[0].length);
  const title = meta.title || (h1 && h1[1]) || ((dated && dated[2]) || slug).replace(/[-_]+/g, ' ').trim();
  const date = meta.date || (dated && dated[1]) || '';
  const tags = (meta.tags || '').replace(/^\[|\]$/g, '').split(',').map((t) => t.trim()).filter(Boolean);
  let summary = meta.summary || '';
  if (!summary) {
    const para = body.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).find((b) => b && !/^(#|>|```|~~~|!\[|\||[-*+] |\d+\. |---|<)/.test(b));
    summary = para ? plain(para) : '';
  }
  const mins = Math.max(1, Math.round(body.split(/\s+/).length / 220));
  return { slug, title, date, tags, summary, mins, body };
}

const posts = readdirSync(join(ROOT, 'posts'))
  .filter((f) => /\.md$/i.test(f) && !/^[._]/.test(f))
  .map((f) => parsePost(read(`posts/${f}`), f))
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

const postUrl = (p) => `${SITE}/blog/${encodeURIComponent(p.slug)}/`;
const fmtDate = (d) => { const t = Date.parse(d); return Number.isNaN(t) ? d : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); };

// resolve links and images in rendered post HTML to root-absolute paths
function postBodyHtml(md) {
  return marked.parse(md, { gfm: true })
    .replace(/<h1(\s|>)/gi, '<h2$1')
    .replace(/<\/h1>/gi, '</h2>')
    .replace(/<img ([^>]*?)src="([^"]*)"/g, (m, pre, src) => `<img loading="lazy" decoding="async" ${pre}src="${/^([a-z][a-z0-9+.-]*:|\/)/i.test(src) ? src : '/posts/' + src}"`)
    .replace(/<a href="([^"]*)"/g, (m, href) => {
      if (/\.md$/i.test(href) && !/^[a-z][a-z0-9+.-]*:/i.test(href)) return `<a href="/blog/${encodeURIComponent(href.split('/').pop().replace(/\.md$/i, ''))}/"`;
      if (/^https?:/i.test(href)) return `<a href="${href}" rel="noopener"`;
      return m;
    });
}

/* ---------- head builders ---------- */

function head({ title, description, url, image = SOCIAL_IMAGE, type = 'website', extra = '', blog = false }) {
  const d = clip(description, 160);
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(d)}">`,
    `<link rel="canonical" href="${url}">`,
    '<meta name="robots" content="index, follow, max-image-preview:large">',
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(d)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(d)}">`,
    `<meta name="twitter:image" content="${image}">`,
    `<link rel="alternate" type="application/atom+xml" title="${SITE_NAME} blog" href="${SITE}/feed.xml">`,
    // the blog is filled in by script; hide the plain fallback so it never flashes
    ...(blog ? ['<script>document.documentElement.classList.add(\'js\')</script>', '<style>.js #view[data-prerendered]{visibility:hidden}</style>'] : []),
    extra,
  ].filter(Boolean).map((l) => '  ' + l).join('\n');
}

/* ---------- homepage ---------- */

const { about, skills, experience, projects, personal, contact } = CONTENT;
const homeTitle = 'DootLord — Full-Stack Software Engineer | dootlord.meme';
const homeDesc = `${about.name} is a ${about.role.toLowerCase()} with 8+ years of experience in TypeScript, Node.js, React and AWS. CV, projects and a blog about code and games.`;

const homeHead = head({
  title: homeTitle,
  description: homeDesc,
  url: `${SITE}/`,
  extra: '  ' + jsonld({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: SITE_NAME, description: homeDesc },
      {
        '@type': 'Person', '@id': `${SITE}/#person`, name: about.name, jobTitle: about.role, url: `${SITE}/`, image: IMAGE,
        sameAs: contact.links.filter((l) => /^https?:/.test(l.href)).map((l) => l.href),
        knowsAbout: skills.flatMap((s) => s.items),
      },
    ],
  }),
});

const homeBody = `
<section id="about"><h2>About ${esc(about.name)}</h2>
${about.bio.map((p) => `<p>${esc(p)}</p>`).join('\n')}
</section>
<section id="skills"><h2>Skills</h2>
${skills.map((g) => `<h3>${esc(g.group)}</h3><ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('\n')}
</section>
<section id="career"><h2>Career</h2>
${experience.map((e) => `<h3>${esc(e.role)}, ${esc(e.company)} (${esc(e.period)})</h3><p>${esc(e.summary)}</p>${e.points.length ? `<ul>${e.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}`).join('\n')}
</section>
<section id="projects"><h2>Projects</h2>
${projects.map((p) => `<h3>${esc(p.name)}</h3><p>${esc(p.blurb)}</p>`).join('\n')}
</section>
<section id="personal"><h2>Beyond the day job</h2>
${personal.map((p) => `<h3>${esc(p.title)}</h3><p>${esc(p.text)}</p>`).join('\n')}
</section>
<section id="contact"><h2>Contact</h2><p>${esc(contact.blurb)}</p>
<p>${contact.links.map((l) => `<a href="${esc(l.href)}" rel="me">${esc(l.label)}</a>`).join(' · ')}</p>
<p><a href="/blog/">Read the blog</a></p></section>`;

let home = read('index.html');
home = fill(home, 'head', homeHead);
home = fill(home, 'body', homeBody);
write('index.html', home);

/* ---------- blog index + post pages ---------- */

const blogTemplate = read('blog/index.html');
// pages in blog/<slug>/ need root-absolute asset and link paths
const absolutise = (html) => html.replace(/(href|src)="\.\.\//g, '$1="/').replace(/href="\.\/"/g, 'href="/blog/"');
const noNoscript = (html) => html.replace(/\s*<noscript>[\s\S]*?<\/noscript>/, '');
const markView = (html) => html.replace('id="view" aria-live="polite">', 'id="view" aria-live="polite" data-prerendered>');

const blogTitle = 'Blog — DOOTLORD';
const blogDesc = 'Posts from dootlord.meme: software engineering, games and whatever else the skeleton is thinking about.';
const listBody = `
<section class="sec blog-index"><h1>Blog</h1>
${posts.length ? posts.map((p) => `<article><h2><a href="/blog/${encodeURIComponent(p.slug)}/">${esc(p.title)}</a></h2><p>${esc(fmtDate(p.date))} · ${p.mins} min read</p>${p.summary ? `<p>${esc(p.summary)}</p>` : ''}</article>`).join('\n') : '<p>Nothing here yet.</p>'}
</section>`;

let blogIndex = fill(blogTemplate, 'head', head({
  title: blogTitle, description: blogDesc, url: `${SITE}/blog/`, blog: true,
  extra: '  ' + jsonld({ '@context': 'https://schema.org', '@type': 'Blog', name: blogTitle, url: `${SITE}/blog/`, description: blogDesc, blogPost: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: postUrl(p), datePublished: p.date })) }),
}));
blogIndex = markView(fill(blogIndex, 'body', listBody));
write('blog/index.html', noNoscript(blogIndex));
write('posts/index.json', JSON.stringify(posts.map((p) => `${p.slug}.md`), null, 2) + '\n');

// Remove only generated pages for posts that no longer exist.
const blogDir = join(ROOT, 'blog');
for (const d of readdirSync(blogDir, { withFileTypes: true })) {
  const page = join(blogDir, d.name, 'index.html');
  if (d.isDirectory() && !posts.some((p) => p.slug === d.name) && existsSync(page)
      && readFileSync(page, 'utf8').includes('<!-- generated:blog-post -->')) {
    unlinkSync(page);
    if (!readdirSync(join(blogDir, d.name)).length) rmdirSync(join(blogDir, d.name));
  }
}

for (const p of posts) {
  const bodyHtml = postBodyHtml(p.body);
  const firstImg = (bodyHtml.match(/<img [^>]*src="([^"]+)"/) || [])[1];
  const image = firstImg ? (firstImg.startsWith('http') ? firstImg : SITE + firstImg) : SOCIAL_IMAGE;
  const url = postUrl(p);
  const desc = p.summary || `${p.title} — a post on dootlord.meme.`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: desc, image: [image], url, mainEntityOfPage: url,
    ...(p.date ? { datePublished: p.date, dateModified: p.date } : {}),
    ...(p.tags.length ? { keywords: p.tags.join(', ') } : {}),
    author: { '@type': 'Person', name: about.name, url: `${SITE}/` },
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: IMAGE } },
  };
  const article = `
<article class="post"><header class="post-head"><p class="post-meta">${p.date ? `<time datetime="${esc(p.date)}">${esc(fmtDate(p.date))}</time> · ` : ''}${p.mins} min read</p><h1 class="post-title">${esc(p.title)}</h1></header>
<div class="prose">${bodyHtml}</div>
<p><a href="/blog/">All posts</a></p></article>`;
  let html = fill(absolutise(blogTemplate), 'head', head({ title: `${p.title} — ${SITE_NAME}`, description: desc, url, image, type: 'article', blog: true, extra: '  ' + jsonld(ld) }));
  html = html.replace('<!doctype html>', '<!doctype html>\n<!-- generated:blog-post -->');
  html = markView(fill(html, 'body', article));
  write(`blog/${p.slug}/index.html`, noNoscript(html));
}

/* ---------- sitemap + feed ---------- */

const urls = [
  { loc: `${SITE}/`, lastmod: posts[0]?.date },
  { loc: `${SITE}/blog/`, lastmod: posts[0]?.date },
  ...posts.map((p) => ({ loc: postUrl(p), lastmod: p.date })),
];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);

const updated = posts[0]?.date ? `${posts[0].date}T00:00:00Z` : new Date().toISOString();
write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${SITE_NAME} blog</title>
  <subtitle>${esc(blogDesc)}</subtitle>
  <link href="${SITE}/feed.xml" rel="self"/>
  <link href="${SITE}/blog/"/>
  <id>${SITE}/blog/</id>
  <updated>${updated}</updated>
  <author><name>${esc(about.name)}</name></author>
${posts.map((p) => `  <entry>
    <title>${esc(p.title)}</title>
    <link href="${postUrl(p)}"/>
    <id>${postUrl(p)}</id>
    <updated>${p.date ? p.date + 'T00:00:00Z' : updated}</updated>
    <summary>${esc(p.summary)}</summary>
  </entry>`).join('\n')}
</feed>
`);

console.log(`SEO build done: ${posts.length} post page(s), sitemap.xml, feed.xml`);
