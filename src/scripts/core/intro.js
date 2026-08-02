import gsap from "../core/gsap.js";
import { TextEngine } from "../engines/split-engine.js";

export const introReady = {
  preloader: false,
  projects: false,
};

export function tryRevealLanding() {
  if (!introReady.preloader || !introReady.projects) return;

  TextEngine.playGroup("header");
  TextEngine.playGroup(".landing-page");
  TextEngine.playGroup("footer");

  animateProjectCardsIn();
}

function animateProjectCardsIn() {
  const container = document.querySelector(".projects-container");
  const cards = document.querySelectorAll(".project__card");

  if (!cards.length) return;

  cards.forEach((card) => {
    card.style.transition = "none";
  });

  if (container) {
    container.style.overflow = "visible";
  }

  gsap.to(cards, {
    y: 0,
    opacity: 1,
    duration: 0.9,
    ease: "power4.out",
    stagger: 0.08,

    onComplete: () => {
      cards.forEach((card) => {
        card.style.transition = "";
        card.classList.remove("is-intro-hidden");
      });

      gsap.set(cards, {
        clearProps: "transform",
      });

      if (container) {
        container.style.overflow = "";
      }
    },
  });
}