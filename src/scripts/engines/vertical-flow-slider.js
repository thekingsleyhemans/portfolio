import { navigate } from "astro:transitions/client";
import { setNextPageName } from "../core/transitions.js";
import gsap from "gsap";

function measureSetHeight(wrap, originalCount) {
  const first = wrap.children[0];
  const firstClone = wrap.children[originalCount];

  if (!first || !firstClone) {
    return wrap.scrollHeight;
  }

  return firstClone.offsetTop - first.offsetTop;
}

export function initVerticalFlowSlider(container, wrap, originalCount, options = {}) {
  const {
    snapDuration = 0.6,
    snapEase = "power3.out",
  } = options;

  let setHeight = measureSetHeight(wrap, originalCount);
  let cardStep = setHeight / originalCount; // distance between card centers — used to find the nearest snap point

  let y = 0;
  let velocity = 0;

  let isDragging = false;
  let hasDragged = false;

  let pointerId = null;
  let pressedCard = null;

  let startY = 0;
  let startOffset = 0;
  let lastY = 0;
  let lastTime = 0;

  const FRICTION = 0.9;
  const VELOCITY_SMOOTHING = 0.8;
  const WHEEL_SENSITIVITY = 0.6;
  const MAX_WHEEL_VELOCITY = 45;
  const MOVING_THRESHOLD = 0.6;

  let isMoving = false;
  let isSnapping = false;
  let animationFrame = null;
  let snapTween = null;

  // This carousel owns the vertical gesture on mobile — block the browser's
  // native vertical pan so a drag doesn't fight page scroll. Swap to "none"
  // if you also want to block horizontal gestures (e.g. edge-swipe-back).
  container.style.cursor = "grab";
  container.style.touchAction = "pan-x";

  function setTransform() {
    wrap.style.transform = `translate3d(0,${y}px,0)`;
  }

  function wrapY() {
    while (y <= -setHeight) y += setHeight;
    while (y > 0) y -= setHeight;
  }

  function nearestSnapY() {
    return Math.round(y / cardStep) * cardStep;
  }

  function settleToSnap() {
    if (isDragging) return;

    isSnapping = true;
    const target = nearestSnapY();
    const proxy = { v: y };

    snapTween?.kill();
    snapTween = gsap.to(proxy, {
      v: target,
      duration: snapDuration,
      ease: snapEase,
      onUpdate: () => {
        y = proxy.v;
        wrapY();
        setTransform();
      },
      onComplete: () => {
        isSnapping = false;
        y = target;
        wrapY();
        setTransform();
      },
    });
  }

  function onPointerDown(e) {
    snapTween?.kill();
    isSnapping = false;

    isDragging = true;
    hasDragged = false;

    pointerId = e.pointerId;
    pressedCard = e.target.closest(".project__card");

    container.setPointerCapture(pointerId);
    container.style.cursor = "grabbing";

    startY = e.clientY;
    startOffset = y;

    lastY = e.clientY;
    lastTime = performance.now();

    velocity = 0;
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const dy = e.clientY - startY;

    if (Math.abs(dy) > 3) {
      hasDragged = true;
    }

    y = startOffset + dy;

    const now = performance.now();
    const dt = now - lastTime || 16;

    const instantVelocity = ((e.clientY - lastY) / dt) * 16;

    velocity =
      velocity * (1 - VELOCITY_SMOOTHING) +
      instantVelocity * VELOCITY_SMOOTHING;

    lastY = e.clientY;
    lastTime = now;

    wrapY();
    setTransform();
  }

  function onPointerUp() {
    if (!isDragging) return;

    isDragging = false;
    container.style.cursor = "grab";

    if (pointerId !== null) {
      container.releasePointerCapture(pointerId);
      pointerId = null;
    }

    // Same reasoning as the horizontal version: setPointerCapture retargets
    // the click event to `container`, so Astro's router can't find the
    // anchor — call navigate() directly on a genuine (non-drag) tap.
    if (!hasDragged && pressedCard) {
      const title = pressedCard.querySelector("h3")?.textContent;
      if (title) setNextPageName(title);

      navigate(pressedCard.href);
    } else if (!hasDragged) {
      // Tapped but didn't drag and it wasn't a card link — still settle.
      settleToSnap();
    }

    pressedCard = null;
    hasDragged = false;
  }

  function normalizeWheelDelta(e) {
    const raw = e.deltaY;

    if (e.deltaMode === 1) return raw * 16;
    if (e.deltaMode === 2) return raw * window.innerHeight;

    return raw;
  }

  function onWheel(e) {
    e.preventDefault();

    snapTween?.kill();
    isSnapping = false;

    const delta = normalizeWheelDelta(e);

    velocity -= delta * WHEEL_SENSITIVITY;

    velocity = Math.max(
      -MAX_WHEEL_VELOCITY,
      Math.min(MAX_WHEEL_VELOCITY, velocity)
    );
  }

  function updateMotionState() {
    const moving =
      hasDragged ||
      Math.abs(velocity) > MOVING_THRESHOLD ||
      isSnapping;

    if (moving !== isMoving) {
      isMoving = moving;
      container.classList.toggle("is-scrolling", moving);
    }
  }

  function tick() {
    if (!isDragging && !isSnapping) {
      if (Math.abs(velocity) > 0.05) {
        y += velocity;
        velocity *= FRICTION;

        wrapY();
        setTransform();
      } else if (velocity !== 0) {
        // Momentum has died out — hand off to the snap tween instead of
        // just stopping wherever we happen to be. This is the one real
        // behavioral difference from the horizontal slider.
        velocity = 0;
        settleToSnap();
      }
    }

    updateMotionState();

    animationFrame = requestAnimationFrame(tick);
  }

  const scrollTarget = document.body || document.documentElement;

  scrollTarget.addEventListener("wheel", onWheel, { passive: false });

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerUp);

  container.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  animationFrame = requestAnimationFrame(tick);

  let resizeTimer;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
      setHeight = measureSetHeight(wrap, originalCount);
      cardStep = setHeight / originalCount;
      wrapY();
      setTransform();
    }, 150);
  });

  return () => {
    cancelAnimationFrame(animationFrame);
    snapTween?.kill();

    scrollTarget.removeEventListener("wheel", onWheel);
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", onPointerUp);
    container.removeEventListener("pointercancel", onPointerUp);
  };
}