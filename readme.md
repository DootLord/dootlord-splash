# dootlord-splash

Splash page, CV and blog for dootlord.meme. Serve the repo root as static files.

```
python -m http.server 8000
```

Open it over http rather than `file://`; the scripts are ES modules.

## Publishing and SEO pages

After changing `assets/js/content.js` or adding/editing a post, run:

```
node tools/build-seo.mjs
```

This generates crawlable HTML for the CV and each public post, page metadata and
structured data, the post manifest, `sitemap.xml`, and the Atom `feed.xml`. The site still hydrates
into the existing animated design in browsers; the generated HTML is its
no-JavaScript and search-engine content. Commit the generated files along with
the source changes. The clean post URLs are `/blog/<post-filename>/`.

The canonical host in the generated metadata is `https://dootlord.meme`.

### Coolify and Nginx

`nginx.conf` is a server configuration based on the existing Nginx setup. It
serves `404.html` with a 404 response and uses relative directory redirects,
so `/blog` redirects to `/blog/` without leaking the container's HTTP scheme.
It preserves the existing JSON directory listing at `/posts/`.

Copy its contents into the Nginx configuration used by the Coolify application
(typically `/etc/nginx/conf.d/default.conf` in an Nginx image), replacing the
existing server block. If the config is managed by Coolify rather than stored
in the image, update it there; adding this file to the site root does not make
Nginx load it. Reload or redeploy the application after updating the config.
Keep `/usr/share/nginx/html` as the site root, or adjust `root` to match the
actual deployment.

In Coolify's proxy/domain settings (or your CDN, if it terminates HTTPS),
configure `https://dootlord.meme` as the canonical public domain, redirect HTTP
to HTTPS, and redirect any configured alternate hostname to
`https://dootlord.meme`, preserving the path and query string. Do this at the
edge, not by checking Nginx's `$scheme` behind the proxy. The exact settings
depend on the configured proxy and CDN. Ensure alternate hostnames have DNS and
TLS configured before redirecting them.

Deploy the generated post directories, `posts/index.json`, Markdown files and
images together. If `/posts/` is mounted as persistent storage, the mounted
directory must also contain the matching manifest and Markdown files; otherwise
the mount can hide the files from the deployment. Re-run the SEO build and
redeploy after publishing changes. Then submit
`https://dootlord.meme/sitemap.xml` to Google Search Console and Bing Webmaster
Tools.

After deployment, check the domain redirects, the 404 response for a nonexistent
path, and a clean post URL and its metadata. Also confirm that `/robots.txt`,
`/sitemap.xml`, `/feed.xml`, and `/posts/index.json` are reachable.

## Editing the CV

All text, links and sounds live in `assets/js/content.js`. Lists can be any length, and a section with an empty list is left off the page and out of the nav.

## Blog

The blog at `/blog/` lists the Markdown files in `posts/` and renders them in the browser. Re-run the SEO build and deploy the resulting post page, `posts/index.json`, and Markdown source together so clean post URLs and client-side navigation stay in sync.

- **Naming:** `YYYY-MM-DD-some-title.md`. The date and title come from the file name unless the front matter overrides them.
- **Drafts:** a name starting with `_` is left out of the public list and search index.
- **Front matter (optional):**

  ```
  ---
  title: My post
  date: 2026-11-10
  tags: dev, doot
  summary: One line for the list page.
  ---
  ```

- **Formatting:** `posts/_demo.md` shows every block type (callouts, code, images, tables, dividers). Drafts are excluded from the generated pages.
- **Images:** put them in `posts/` (or a subfolder) and reference them relative to the post. An image on its own line (blank lines around it) gets the framed treatment, and its alt text becomes the caption: `![Caption here](img/my-post/shot.jpg)`.

### Writing posts in Obsidian

`tools/sync-vault.ps1` publishes posts from an Obsidian vault folder into `posts/`.

1. Put the full path of the vault folder you write posts in into `tools/vault-posts-path.txt` (git-ignored, one line).
2. Open the repo in VS Code. The task **Blog: sync from Obsidian (watch)** starts by itself (allow automatic tasks when asked) and keeps `posts/` up to date while you write. Without VS Code: `powershell -ExecutionPolicy Bypass -File tools/sync-vault.ps1 -Watch`, or leave off `-Watch` to sync once.
3. In the vault, name a note `YYYY-MM-DD-title.md` to publish it. Other notes are drafts and stay in the vault.
4. Paste screenshots as usual. They're saved to `posts/img/<post-name>/`, PNGs as JPGs, and the links are rewritten to normal Markdown. `![[shot.png|Caption]]` adds a caption, `![[shot.png|400]]` a max width in px.
5. Run `node tools/build-seo.mjs`, check it with the task **Blog: preview site** (`http://localhost:8000/blog/`), then commit and push.

The vault is the source of truth for dated posts: edits made to them in `posts/` get overwritten, and a post deleted or renamed in the vault is removed from `posts/`. Files starting with `_` (like `_demo.md`) are never touched.

`posts/index.json` is generated by the SEO build, so directory listings do not need to be enabled on the server.

Posts should be published through the build and deployment workflow above so the
static pages, manifest and Markdown stay in sync.

## Files

- `index.html` — markup for the splash, sticky bar and footer
- `blog/index.html` — the blog page
- `assets/js/content.js` — everything the CV says
- `assets/js/main.js` — splash: GSAP intro, idle and click animation
- `assets/js/cv.js` — renders the CV sections and their scroll-driven motion
- `assets/js/blog.js` — loads posts, turns Markdown into themed blocks, animates them
- `assets/js/bg.js` — low-resolution canvas background (rings, rainbows, sparkles, bones)
- `assets/css/style.css` — shared layout and pixel styling, including a plain print stylesheet
- `assets/css/blog.css` — blog list and post styling
- `assets/vendor/` — GSAP 3.13 (ScrambleText, ScrollTrigger, ScrollTo), marked and highlight.js, served locally
- `assets/img/social-preview.png` — default social sharing image; `tools/social-preview.html` is its source
- `audio/` — doot sounds, listed in `content.js`
