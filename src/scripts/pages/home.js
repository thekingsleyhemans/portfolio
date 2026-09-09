console.log("HOME LOADED");

import { initLoader } from "../engines/loader.js";
import { initOverlay } from "../engines/overlay.js";
import { loadProjects } from "../engines/projects.js";
import { initMobileProjects } from "../engines/mobile-projects.js";

import { isFirstLoad } from "../core/transitions.js";
import { introReady } from "../core/intro.js";

// --------------------------------------------------
// PRELOADER
// --------------------------------------------------

function skipPreloader() {
  const preloader = document.querySelector(".preloader");

  if (preloader) {
    preloader.style.display = "none";
  }

  introReady.preloader = true;
}

// --------------------------------------------------
// RESPONSIVE PROJECT INITIALIZATION
// --------------------------------------------------

function initProjectsForViewport() {
  const isDesktop = window.matchMedia("(min-width: 1025px)").matches;

  if (isDesktop) {
    loadProjects();
  } else {
    initMobileProjects();
  }
}

// --------------------------------------------------
// HOME INITIALIZATION
// --------------------------------------------------

function initHome() {
  // The full preloader intro should only ever play once,
  // on the actual first hard load.
  if (isFirstLoad()) {
    initLoader();
  } else {
    skipPreloader();
  }

  // Shared overlay system
  initOverlay();

  // Load the appropriate project experience
  initProjectsForViewport();
}

// --------------------------------------------------
// ASTRO PAGE LOAD
// --------------------------------------------------

if (typeof document !== "undefined") {
  document.addEventListener("astro:page-load", initHome);
}