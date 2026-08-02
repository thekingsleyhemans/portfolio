import gsap from "../core/gsap.js";
import { TextEngine } from "./split-engine.js";

export function initOverlay() {
  const overlayOpener = document.querySelector("#overlay-open");
  const overlayCloser = document.querySelector("#overlay-close");
  const overlayImg = document.querySelector(".info-img img");

  const xPosition = "100%";

  if (!overlayOpener || !overlayCloser || !overlayImg) {
    console.warn("Info overlay: one or more elements not found", {
      overlayOpener,
      overlayCloser,
      overlayImg,
    });
    return;
  }

  function openOverlay() {
    const tl = gsap.timeline();

    tl.to(".info-overlay", {
      x: 0,
      duration: 0.1,
      ease: "power4.out",
    });

    tl.to(
      ".info-overlay-wrap",
      {
        x: 0,
        duration: 0.9,
        ease: "power4.out",
      },
      "-=0.05"
    );

    tl.to(
      overlayImg,
      {
        clipPath: "inset(0% 0 0% 0)",
        scale: 1,
        duration: 1.1,
        ease: "power4.out",
      },
      "-=0.55"
    );

    tl.call(() => {
      TextEngine.playGroup(".info-overlay");
    });

    return tl;
  }

  function closeOverlay() {
    const tl = gsap.timeline();

    tl.call(() => {
      TextEngine.reverseGroup(".info-overlay");
    });

    tl.to(overlayImg, {
      clipPath: "inset(0% 0 100% 0)",
      scale: 0.8,
      duration: 0.8,
      ease: "power4.in",
      delay: 0.35,
    });

    tl.to(
      ".info-overlay-wrap",
      {
        x: xPosition,
        duration: 1.2,
        ease: "power4.out",
      },
      "+=0.09"
    );

    tl.to(
      ".info-overlay",
      {
        x: xPosition,
        duration: 1.2,
        ease: "power4.out",
      },
      "<"
    );

    return tl;
  }

  overlayOpener.addEventListener("click", openOverlay);
  overlayCloser.addEventListener("click", closeOverlay);
}