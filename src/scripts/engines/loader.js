console.log("LOADER LOADED");

import gsap from "../core/gsap.js";
import { introReady, tryRevealLanding } from "../core/intro.js";

export function initLoader() {

  console.log("Loader init fired");

  const preloader = document.querySelector(".preloader");
  const imgWrap = document.querySelector(".l-img-wrap");
  const images = document.querySelectorAll(".l-img-wrap img");
  const topHeading = document.querySelector(".loader-content h1:first-child");
  const bottomHeading = document.querySelector(".loader-content h1:last-child");

  console.log({
    preloader,
    imgWrap,
    images: images.length,
    topHeading,
    bottomHeading
  });

  if (
    !preloader ||
    !imgWrap ||
    !images.length ||
    !topHeading ||
    !bottomHeading
  ) {
    console.warn("Loader missing elements");
    return;
  }

  runPreloader(
    preloader,
    imgWrap,
    images,
    topHeading,
    bottomHeading
  );
}

function runPreloader(preloader, imgWrap, images, topHeading, bottomHeading) {
  const tl = gsap.timeline();

  const FRAME_DURATION = 0.35;
  const FRAME_HOLD = 0.12;
  const GAP = 0.5;

  let z = 1;

  function resetFrame(img) {
    gsap.set(img, {
      zIndex: z++,
      clipPath: "inset(0% 0 100% 0)",
    });
  }

  function wipeIn(img) {
    return gsap.to(img, {
      clipPath: "inset(0% 0 0% 0)",
      duration: FRAME_DURATION,
      ease: "power2.inOut",
    });
  }

  tl.to(topHeading, {
    y: 0,
    opacity: 1,
    duration: 0.8,
    ease: "power4.out",
  });

  tl.to(
    bottomHeading,
    {
      y: 0,
      opacity: 1,
      duration: 0.8,
      ease: "power4.out",
    },
    "<0.12",
  );

  tl.to(
    imgWrap,
    {
      height: 400,
      duration: 0.9,
      ease: "power4.out",
    },
    `+=${GAP}`,
  );

  images.forEach((img) => {
    tl.call(() => resetFrame(img));
    tl.add(wipeIn(img));
    tl.to({}, { duration: FRAME_HOLD });
  });

  for (let i = images.length - 2; i >= 0; i--) {
    const img = images[i];

    tl.call(() => resetFrame(img));
    tl.add(wipeIn(img));
    tl.to({}, { duration: FRAME_HOLD });
  }

  tl.to(imgWrap, {
    height: 0,
    duration: 0.7,
    ease: "power4.inOut",
  });

  tl.to(
    bottomHeading,
    {
      y: 40,
      opacity: 0,
      duration: 0.6,
      ease: "power4.inOut",
    },
    `+=${GAP}`,
  );

  tl.to(
    topHeading,
    {
      y: -40,
      opacity: 0,
      duration: 0.6,
      ease: "power4.inOut",
    },
    "<0.12",
  );

  tl.to(
    preloader,
    {
      clipPath: "inset(0% 0 100% 0)",
      duration: 1,
      ease: "power4.inOut",
    },
    "+=0.1",
  );

  tl.set(preloader, {
    display: "none",
  });

  tl.call(() => {
    console.log("PRELOADER FINISHED");

    introReady.preloader = true;
    tryRevealLanding();
  });

  return tl;
}
