import gsap from "./gsap.js";
import { initApp } from "../app.js";

let hasNavigated = false;

// exposed so other page scripts (e.g. home.js) can tell a first
// hard load apart from a client-side navigation
export function isFirstLoad() {
  return !hasNavigated;
}

// lets a caller (e.g. a card click handler that already knows the
// destination's display name) supply the transition title up front,
// instead of waiting for the incoming page to finish fetching before
// reading it off that document's <meta name="page-name">. Cleared
// after each navigation so it never leaks into an unrelated one.
let pendingPageName = null;

export function setNextPageName(name) {
  pendingPageName = name;
}

// everything below only makes sense in the browser — if this module
// is ever evaluated during SSR, skip straight past it instead of
// throwing on `document`
if (typeof document !== "undefined") {
  const overlay = () => document.querySelector(".page-transition");
  const titleEl = () => document.getElementById("pt-title");

  const wipeIn = () =>
    new Promise((resolve) => {
      gsap.to(overlay(), {
        clipPath: "inset(0% 0 0% 0)",
        duration: 0.8,
        ease: "power4.inOut",
        onComplete: resolve,
      });
    });

  const wipeOut = () =>
    new Promise((resolve) => {
      gsap.to(overlay(), {
        clipPath: "inset(0% 0 100% 0)",
        duration: 0.8,
        ease: "power4.inOut",
        onComplete: resolve,
      });
    });

  const staggerTitle = (text) =>
    new Promise((resolve) => {
      const el = titleEl();
      el.textContent = text;
      gsap.set(el, { y: 40, opacity: 0 }); // reset — previous nav left this at y:-40/opacity:0

      const tl = gsap.timeline({ onComplete: resolve });
      tl.to(el, { y: 0, opacity: 1, duration: 0.6, ease: "power4.out" });
      tl.to({}, { duration: 0.4 }); // hold
      tl.to(el, { y: -40, opacity: 0, duration: 0.5, ease: "power4.inOut" });
    });

  // reads the short display name for the incoming page — prefers an
  // explicit setNextPageName() override (known instantly at click
  // time), then the fetched document's own <meta name="page-name">,
  // then falls back to <title> if a page hasn't set a pageName prop
  // on Layout yet
  const getPageName = (doc) =>
    pendingPageName ||
    doc?.querySelector('meta[name="page-name"]')?.content ||
    doc?.title ||
    document.title;

  document.addEventListener("astro:before-preparation", (event) => {
    hasNavigated = true;
    const originalLoader = event.loader;

    event.loader = async function () {
      // wipe-in and the page fetch happen at the same time —
      // originalLoader() assigns event.newDocument as a side effect
      // once it resolves, which we read right after
      await Promise.all([wipeIn(), originalLoader()]);

      const newPageName = getPageName(event.newDocument);
      pendingPageName = null; // consumed — don't let it leak into the next nav

      await staggerTitle(newPageName); // stagger up, hold, stagger down — while fully covered
    };
  });

  document.addEventListener("astro:page-load", async () => {
    const engine = initApp();
    await engine.ready;

    if (isFirstLoad()) {
      // pages with their own preloader (currently just the home page)
      // handle their initial reveal themselves via intro.js — but pages
      // without one (e.g. project template) have nothing else to reveal
      // their split text, so we do it directly instead of leaving it
      // permanently hidden
      if (!document.querySelector(".preloader")) {
        engine.playGroup("body");
      }
      return;
    }

    await wipeOut();          // reveal new content
    engine.playGroup("body"); // stagger everything in, same mechanism as your landing reveal

    hasNavigated = false;
  });
}