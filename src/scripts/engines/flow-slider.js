import { navigate } from "astro:transitions/client";
import { setNextPageName } from "../core/transitions.js";

function measureSetWidth(wrap, originalCount) {
  const first = wrap.children[0];
  const firstClone = wrap.children[originalCount];

  if (!first || !firstClone) {
    return wrap.scrollWidth;
  }

  return firstClone.offsetLeft - first.offsetLeft;
}

export function initFlowSlider(container, wrap, originalCount) {
  let setWidth = measureSetWidth(wrap, originalCount);

  let x = 0;
  let velocity = 0;

  let isDragging = false;
  let hasDragged = false;

  let pointerId = null;
  let pressedCard = null;

  let startX = 0;
  let startOffset = 0;
  let lastX = 0;
  let lastTime = 0;

  const FRICTION = 0.9;
  const VELOCITY_SMOOTHING = 0.8;
  const WHEEL_SENSITIVITY = 0.6;
  const MAX_WHEEL_VELOCITY = 45;
  const MOVING_THRESHOLD = 0.6;

  let isMoving = false;
  let animationFrame = null;

  container.style.cursor = "grab";
  container.style.touchAction = "pan-y";

  function setTransform() {
    wrap.style.transform = `translate3d(${x}px,0,0)`;
  }

  function wrapX() {
    while (x <= -setWidth) x += setWidth;
    while (x > 0) x -= setWidth;
  }

  function onPointerDown(e) {
    isDragging = true;
    hasDragged = false;

    pointerId = e.pointerId;
    pressedCard = e.target.closest(".project__card");

    container.setPointerCapture(pointerId);
    container.style.cursor = "grabbing";

    startX = e.clientX;
    startOffset = x;

    lastX = e.clientX;
    lastTime = performance.now();

    velocity = 0;
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - startX;

    if (Math.abs(dx) > 3) {
      hasDragged = true;
    }

    x = startOffset + dx;

    const now = performance.now();
    const dt = now - lastTime || 16;

    const instantVelocity = ((e.clientX - lastX) / dt) * 16;

    velocity =
      velocity * (1 - VELOCITY_SMOOTHING) +
      instantVelocity * VELOCITY_SMOOTHING;

    lastX = e.clientX;
    lastTime = now;

    wrapX();
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

    // setPointerCapture retargets the click event's `target` to
    // `container` itself in most browsers, so Astro's router (which
    // does the equivalent of event.target.closest("a") on document
    // clicks) can never find the anchor to navigate — call navigate()
    // directly instead, which runs the exact same transition Astro's
    // router would have
    if (!hasDragged && pressedCard) {
      const title = pressedCard.querySelector("h3")?.textContent;
      if (title) setNextPageName(title);

      navigate(pressedCard.href);
    }

    pressedCard = null;
    hasDragged = false;
  }

  function normalizeWheelDelta(e) {
    const raw =
      Math.abs(e.deltaX) > Math.abs(e.deltaY)
        ? e.deltaX
        : e.deltaY;

    if (e.deltaMode === 1) return raw * 16;
    if (e.deltaMode === 2) return raw * window.innerHeight;

    return raw;
  }

  function onWheel(e) {
    e.preventDefault();

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
      Math.abs(velocity) > MOVING_THRESHOLD;

    if (moving !== isMoving) {
      isMoving = moving;
      container.classList.toggle("is-scrolling", moving);
    }
  }

  function tick() {
    if (!isDragging) {
      if (Math.abs(velocity) > 0.05) {
        x += velocity;
        velocity *= FRICTION;

        wrapX();
        setTransform();
      } else {
        velocity = 0;
      }
    }

    updateMotionState();

    animationFrame = requestAnimationFrame(tick);
  }

  container.addEventListener("wheel", onWheel, { passive: false });

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerUp);

  container.addEventListener(
    "click",
    (e) => {
      // navigation for a genuine click is handled explicitly via
      // navigate() in onPointerUp — always swallow the native click
      // here so it can never also trigger a second, unrouted
      // navigation on top of that
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
      setWidth = measureSetWidth(wrap, originalCount);
      wrapX();
      setTransform();
    }, 150);
  });

  // Return a cleanup function for Astro page transitions
  return () => {
    cancelAnimationFrame(animationFrame);

    container.removeEventListener("wheel", onWheel);
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", onPointerUp);
    container.removeEventListener("pointercancel", onPointerUp);
  };
}