# dootlord-splash

Splash page for dootlord.meme. Static files, no build step — serve the repo root.

```
python -m http.server 8000
```

Open it over http rather than `file://`; the scripts are ES modules.

- `index.html` — markup
- `assets/css/style.css` — layout and pixel styling
- `assets/js/main.js` — GSAP intro, idle and click animation. Edit `LINKS` and `TAGLINES` at the top.
- `assets/js/bg.js` — low-resolution canvas background (rings, rainbows, sparkles)
- `assets/vendor/` — GSAP 3.13 and ScrambleTextPlugin, served locally
