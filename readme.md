# dootlord-splash

Splash page and CV for dootlord.meme. Static files, no build step — serve the repo root.

```
python -m http.server 8000
```

Open it over http rather than `file://`; the scripts are ES modules.

## Editing the content

All text, links and sounds live in `assets/js/content.js`. Anything in `[square brackets]` is a placeholder. Lists can be any length, and a section with an empty list is left off the page and out of the nav.

## Files

- `index.html` — markup for the splash, sticky bar and footer
- `assets/js/content.js` — everything the site says
- `assets/js/main.js` — splash: GSAP intro, idle and click animation
- `assets/js/cv.js` — renders the CV sections and their scroll-driven motion
- `assets/js/bg.js` — low-resolution canvas background (rings, rainbows, sparkles, bones)
- `assets/css/style.css` — layout and pixel styling, including a plain print stylesheet
- `assets/vendor/` — GSAP 3.13 with ScrambleText, ScrollTrigger and ScrollTo, served locally
- `audio/` — doot sounds, listed in `content.js`
