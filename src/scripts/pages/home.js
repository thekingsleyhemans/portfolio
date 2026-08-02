console.log("HOME LOADED");

import { initLoader } from "../engines/loader.js";
import { initOverlay } from "../engines/overlay.js";
import { loadProjects } from "../engines/projects.js";
import { isFirstLoad } from "../core/transitions.js";
import { introReady } from "../core/intro.js";

// on a client-side nav back to "/", Astro swaps in a fresh, un-animated
// .preloader element every time (it only exists on index.astro) — since
// we deliberately skip initLoader() on those visits, nothing else would
// ever hide it, so it sits there fully visible on top of the page once
// the transition overlay wipes out. Just hide it instantly instead.
function skipPreloader() {
  const preloader = document.querySelector(".preloader");
  if (preloader) {
    preloader.style.display = "none";
  }
  introReady.preloader = true;
}

function initHome() {
  // the full preloader intro should only ever play once, on the
  // actual first hard load — not every time the router brings you
  // back to "/" client-side
  if (isFirstLoad()) {
    initLoader();
  } else {
    skipPreloader();
  }

  initOverlay();
  loadProjects();
}

// guarded so this module can never throw if it's ever evaluated
// outside the browser (SSR, Astro's dev-server script processing, etc.)
if (typeof document !== "undefined") {
  document.addEventListener("astro:page-load", initHome);
}