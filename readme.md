# dootlord-splash

Splash page, CV and blog for dootlord.meme. Static files, no build step — serve the repo root.

```
python -m http.server 8000
```

Open it over http rather than `file://`; the scripts are ES modules.

## Editing the CV

All text, links and sounds live in `assets/js/content.js`. Lists can be any length, and a section with an empty list is left off the page and out of the nav.

## Blog

The blog at `/blog/` lists the Markdown files in `posts/` and renders them in the browser. Posts are not in git (`posts/` is ignored, apart from the demo), so publishing is just putting a file in that folder on the server:

```
scp my-post.md server:/path/to/site/posts/2026-11-10-my-post.md
```

- **Naming:** `YYYY-MM-DD-some-title.md`. The date and title come from the file name unless the front matter overrides them.
- **Drafts:** a name starting with `_` is left out of the list but still opens at `/blog/?p=_name`.
- **Front matter (optional):**

  ```
  ---
  title: My post
  date: 2026-11-10
  tags: dev, doot
  summary: One line for the list page.
  ---
  ```

- **Formatting:** `posts/_demo.md` shows every block type (callouts, code, images, tables, dividers). View it at `/blog/?p=_demo`.
- **Images:** put them in `posts/` (or a subfolder) and reference them relative to the post.
- **Obsidian embeds:** `![[shot.png]]` works too. The file is loaded from `posts/img/` by name. Add `|Caption` for a caption and `|400` for a max width in px, e.g. `![[shot.png|Caption|400]]`.

The page needs to be able to list the folder. Any of these works:

- Nginx: `location /posts/ { autoindex on; autoindex_format json; }` (the plain HTML listing works too)
- Any other server with directory listings switched on for `/posts/`
- No listings: keep a `posts/index.json` containing an array of file names

If your deploy replaces the site folder, point `/posts/` at a directory outside it so posts survive.

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
- `audio/` — doot sounds, listed in `content.js`
