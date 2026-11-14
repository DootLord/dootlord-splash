// The 404 page: the blog's background and sprites, nothing else. The page
// reads fine without this; it only adds the canvas and the skull.

import { createBackground } from './bg.js';
import { installSprites } from './cv.js';

const { gsap } = window;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

installSprites();

const bg = createBackground(document.getElementById('bg'));
if (RM || !gsap) {
  Object.assign(bg.state, { rainbow: 1, sparks: 1 });
  bg.renderStatic();
} else {
  bg.start();
  gsap.to(bg.state, { rainbow: 1, duration: 1.4, ease: 'power2.inOut' });
  gsap.to(bg.state, { sparks: 1, duration: 1.5, ease: 'none', delay: 0.2 });
  if (matchMedia('(pointer: fine)').matches) {
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
