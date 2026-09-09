import { navigate } from "astro:transitions/client";
import { setNextPageName } from "../core/transitions.js";

export async function initMobileProjects() {
  const section = document.querySelector(".mobile-projects");

  if (!section) return;

  if (section.dataset.initialized === "true") return;

  section.dataset.initialized = "true";

  const cardsContainer = section.querySelector(".mobile-project-cards");
  const titleElement = section.querySelector(".mobile-project-title");
  const progressBar = section.querySelector(
    ".mobile-project-progress-bar"
  );

  if (!cardsContainer || !titleElement) {
    console.warn("Mobile project deck elements are missing.");
    return;
  }

  try {
    const response = await fetch("/data/projects.json");

    if (!response.ok) {
      throw new Error(
        `Failed to load projects.json: ${response.status}`
      );
    }

    const projects = await response.json();

    if (!Array.isArray(projects) || projects.length === 0) {
      console.warn("No projects found.");
      return;
    }

    /*
    ------------------------------------------------------------
    CREATE CARDS
    ------------------------------------------------------------
    */

    projects.forEach((project, index) => {
      const card = document.createElement("a");

      card.className = "mobile-project-card";
      card.href = `/project/${project.slug}`;

      card.dataset.index = index;

      const image = document.createElement("img");

      image.src = project.heroImage;
      image.alt = project.title;
      image.draggable = false;

      if (index === 0) {
        image.loading = "eager";
      } else {
        image.loading = "lazy";
      }

      card.appendChild(image);
      cardsContainer.appendChild(card);
    });

    const cards = Array.from(
      cardsContainer.querySelectorAll(".mobile-project-card")
    );

    /*
    ------------------------------------------------------------
    STATE
    ------------------------------------------------------------
    */

    let activeIndex = 0;

    let isDragging = false;
    let hasDragged = false;

    let pointerId = null;

    let startX = 0;
    let currentX = 0;

    let animationFrame = null;
    let isAnimating = false;

    const SWIPE_THRESHOLD = 70;
    const MAX_DRAG = 150;

    /*
    ------------------------------------------------------------
    UPDATE CARD POSITIONS
    ------------------------------------------------------------
    */

    function renderDeck(animate = true) {
      cards.forEach((card, position) => {
        const relativePosition =
          (position - activeIndex + cards.length) %
          cards.length;

        /*
        Front card
        */
        if (relativePosition === 0) {
          card.style.zIndex = cards.length + 10;

          card.style.transform = `
            translate3d(0, 0, 0)
            rotate(0deg)
          `;

          card.style.opacity = "1";
          card.style.pointerEvents = "auto";
        }

        /*
        First card behind
        */
        else if (relativePosition === 1) {
          card.style.zIndex = cards.length + 9;

          card.style.transform = `
            translate3d(-18px, -14px, 0)
            rotate(-5deg)
          `;

          card.style.opacity = "1";
          card.style.pointerEvents = "none";
        }

        /*
        Second card behind
        */
        else if (relativePosition === 2) {
          card.style.zIndex = cards.length + 8;

          card.style.transform = `
            translate3d(18px, -24px, 0)
            rotate(5deg)
          `;

          card.style.opacity = "1";
          card.style.pointerEvents = "none";
        }

        /*
        Remaining cards sit behind the visible stack.
        */
        else {
          card.style.zIndex =
            cards.length - relativePosition;

          card.style.transform = `
            translate3d(0, -8px, 0)
            rotate(0deg)
            scale(0.96)
          `;

          card.style.opacity = "0";
          card.style.pointerEvents = "none";
        }

        card.style.transition = animate
          ? "transform 420ms cubic-bezier(.22,.61,.36,1), opacity 420ms ease"
          : "none";
      });

      updateProjectMeta();
    }

    /*
    ------------------------------------------------------------
    PROJECT META
    ------------------------------------------------------------
    */

    function updateProjectMeta() {
      const project = projects[activeIndex];

      if (!project) return;

      titleElement.textContent = project.title;

      if (progressBar) {
        const progress =
          ((activeIndex + 1) / projects.length) * 100;

        progressBar.style.width = `${progress}%`;
      }
    }

    /*
    ------------------------------------------------------------
    DRAG POSITION
    ------------------------------------------------------------
    */

    function updateDrag() {
      if (!isDragging) return;

      const delta = currentX - startX;

      const clampedDelta = Math.max(
        -MAX_DRAG,
        Math.min(MAX_DRAG, delta)
      );

      const activeCard = cards[activeIndex];

      if (!activeCard) return;

      activeCard.style.transition = "none";

      activeCard.style.transform = `
        translate3d(${clampedDelta}px, ${Math.abs(clampedDelta) * -0.04}px, 0)
        rotate(${clampedDelta * 0.035}deg)
      `;

      animationFrame = requestAnimationFrame(updateDrag);
    }

    /*
    ------------------------------------------------------------
    POINTER DOWN
    ------------------------------------------------------------
    */

    function onPointerDown(event) {
      if (isAnimating) return;

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const activeCard = cards[activeIndex];

      if (!activeCard) return;

      isDragging = true;
      hasDragged = false;

      pointerId = event.pointerId;

      startX = event.clientX;
      currentX = event.clientX;

      cardsContainer.setPointerCapture(pointerId);

      cardsContainer.classList.add("is-dragging");

      activeCard.style.transition = "none";

      animationFrame = requestAnimationFrame(updateDrag);
    }

    /*
    ------------------------------------------------------------
    POINTER MOVE
    ------------------------------------------------------------
    */

    function onPointerMove(event) {
      if (!isDragging) return;

      currentX = event.clientX;

      if (Math.abs(currentX - startX) > 5) {
        hasDragged = true;
      }
    }

    /*
    ------------------------------------------------------------
    COMPLETE SWIPE
    ------------------------------------------------------------
    */

    function completeSwipe(direction) {
      if (isAnimating) return;

      isAnimating = true;

      const activeCard = cards[activeIndex];

      if (!activeCard) {
        isAnimating = false;
        return;
      }

      const exitDistance =
        direction === "next"
          ? window.innerWidth * 1.2
          : -window.innerWidth * 1.2;

      activeCard.style.transition =
        "transform 450ms cubic-bezier(.22,.61,.36,1), opacity 450ms ease";

      activeCard.style.transform = `
        translate3d(${exitDistance}px, -30px, 0)
        rotate(${direction === "next" ? 14 : -14}deg)
      `;

      activeCard.style.opacity = "0";

      setTimeout(() => {
        /*
        Move the active card to the back of the
        array so the deck can continue infinitely.
        */

        if (direction === "next") {
          const firstCard = cards.shift();

          cards.push(firstCard);

          activeIndex = 0;
        } else {
          const lastCard = cards.pop();

          cards.unshift(lastCard);

          activeIndex = 0;
        }

        /*
        Re-append cards in their new order.
        */

        cards.forEach((card) => {
          cardsContainer.appendChild(card);
        });

        /*
        Reset the recycled card before rendering
        the new deck.
        */

        cards.forEach((card) => {
          card.style.transition = "none";
          card.style.opacity = "0";
        });

        renderDeck(false);

        /*
        Force layout so the browser registers
        the reset before animating into position.
        */

        requestAnimationFrame(() => {
          cards.forEach((card) => {
            card.style.transition =
              "transform 420ms cubic-bezier(.22,.61,.36,1), opacity 420ms ease";
          });

          isAnimating = false;
        });
      }, 460);
    }

    /*
    ------------------------------------------------------------
    POINTER UP
    ------------------------------------------------------------
    */

    function onPointerUp() {
      if (!isDragging) return;

      isDragging = false;

      cancelAnimationFrame(animationFrame);

      cardsContainer.classList.remove("is-dragging");

      const activeCard = cards[activeIndex];

      if (!activeCard) return;

      const delta = currentX - startX;

      /*
      Swipe left → next project
      Swipe right → previous project
      */

      if (Math.abs(delta) >= SWIPE_THRESHOLD) {
        completeSwipe(
          delta < 0
            ? "next"
            : "previous"
        );
      } else {
        /*
        Not enough movement — return card
        to its resting position.
        */

        activeCard.style.transition =
          "transform 300ms cubic-bezier(.22,.61,.36,1)";

        activeCard.style.transform = `
          translate3d(0, 0, 0)
          rotate(0deg)
        `;

        /*
        If it was only a tap, open the project.
        */

        if (!hasDragged) {
          const title =
            activeCard.querySelector("img")?.alt;

          if (title) {
            setNextPageName(title);
          }

          navigate(activeCard.href);
        }
      }

      hasDragged = false;

      if (pointerId !== null) {
        try {
          cardsContainer.releasePointerCapture(pointerId);
        } catch {
          // Pointer capture may already have been released.
        }

        pointerId = null;
      }
    }

    /*
    ------------------------------------------------------------
    PREVENT NATIVE IMAGE DRAGGING
    ------------------------------------------------------------
    */

    cardsContainer.addEventListener(
      "dragstart",
      (event) => {
        event.preventDefault();
      }
    );

    /*
    ------------------------------------------------------------
    EVENTS
    ------------------------------------------------------------
    */

    cardsContainer.addEventListener(
      "pointerdown",
      onPointerDown
    );

    cardsContainer.addEventListener(
      "pointermove",
      onPointerMove
    );

    cardsContainer.addEventListener(
      "pointerup",
      onPointerUp
    );

    cardsContainer.addEventListener(
      "pointercancel",
      onPointerUp
    );

    /*
    ------------------------------------------------------------
    INITIAL RENDER
    ------------------------------------------------------------
    */

    renderDeck(false);

    /*
    ------------------------------------------------------------
    CLEANUP
    ------------------------------------------------------------
    */

    section._mobileProjectCleanup = () => {
      cancelAnimationFrame(animationFrame);

      cardsContainer.removeEventListener(
        "pointerdown",
        onPointerDown
      );

      cardsContainer.removeEventListener(
        "pointermove",
        onPointerMove
      );

      cardsContainer.removeEventListener(
        "pointerup",
        onPointerUp
      );

      cardsContainer.removeEventListener(
        "pointercancel",
        onPointerUp
      );
    };
  } catch (error) {
    console.error(
      "Failed to initialize mobile projects:",
      error
    );

    section.dataset.initialized = "false";
  }
}