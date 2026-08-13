/* ==========================================================
   INFINITE GRID GALLERY
   - loads items from archive.json
   - tiles repeat infinitely in every direction (2D wrap)
   - drag-to-scroll with inertia on both axes
   - click a card: scales + centers it, siblings stay put
   - click empty space, close button, or Escape: closes it back
========================================================== */
import gsap from "../core/gsap.js";

// tracks the current instance so we can tear it down before building
// a new one — needed now that init runs on every astro:page-load
// (client-side nav to /archive/ swaps in a fresh .grid-container each
// time, but this instance's window/document-level listeners and its
// body-appended backdrop/close button wouldn't otherwise go away)
let currentGrid = null;

function init() {
  const container = document.querySelector(".grid-container");
  const wrap = document.querySelector(".grid-wrap");

  if (!container || !wrap) return;

  if (currentGrid) {
    currentGrid.destroy();
    currentGrid = null;
  }

  loadAndBuild(container, wrap);
}

async function loadAndBuild(container, wrap) {
  try {
    const res = await fetch("/data/archives.json");
    const items = await res.json();
    currentGrid = new InfiniteGrid(container, wrap, items);
  } catch (err) {
    console.error("Failed to load archive:", err);
  }
}

// astro:page-load fires on the initial hard load AND after every
// client-side transition — DOMContentLoaded only fires once, so it
// never ran again when navigating here from another page
if (typeof document !== "undefined") {
  document.addEventListener("astro:page-load", init);
}

class InfiniteGrid {
  constructor(container, wrap, items) {
    this.container = container;
    this.wrap = wrap;
    this.items = items;

    // ---- grid geometry (tune these) ----
    this.itemCols = 3;
    const { maxCardWidth, maxCardHeight, gap } = this.getCardDimensions();
    this.maxCardWidth = maxCardWidth; // bounding box each card's aspect-fit size sits within
    this.maxCardHeight = maxCardHeight;
    this.gap = gap;
    this.cellW = this.maxCardWidth + this.gap; // grid cell stays uniform for the infinite wrap
    this.cellH = this.maxCardHeight + this.gap;

    // shuffle once, up front — also sets this.itemRows to the
    // enlarged tile size (see createShuffledIndices)
    this.shuffledIndices = this.createShuffledIndices();

    // ---- drag / inertia state ----
    this.offsetX = 0;
    this.offsetY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.isDragging = false;
    this.hasDragged = false;
    this.pointerId = null;
    this.pressedTile = null;
    this.startX = 0;
    this.startY = 0;
    this.startOffsetX = 0;
    this.startOffsetY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.lastTime = 0;

    this.FRICTION = 0.94;
    this.VELOCITY_SMOOTHING = 0.9;
    this.MOVING_THRESHOLD = 0.6;
    this.SCALE_DOWN = 0.70;
    this.SCALE_EASE = 0.15;
    this.cardScale = 1;
    this.WHEEL_SENSITIVITY = 0.6;
    this.MAX_WHEEL_VELOCITY = 45;

    // ---- active (expanded) card state ----
    this.activeTile = null;
    this.activeRect = null;

    this.tiles = [];
    this.isDestroyed = false;

    this.createChrome();
    this.buildPool();
    this.bindEvents();

    this.rafId = requestAnimationFrame(() => this.tick());

    this.resizeTimer = null;
    this.onResize = () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        const { maxCardWidth, maxCardHeight, gap } = this.getCardDimensions();
        this.maxCardWidth = maxCardWidth;
        this.maxCardHeight = maxCardHeight;
        this.gap = gap;
        this.cellW = this.maxCardWidth + this.gap;
        this.cellH = this.maxCardHeight + this.gap;
        this.rebuild();
      }, 200);
    };
    window.addEventListener("resize", this.onResize);
  }

  /* ---------------- responsive card sizing ---------------- */

  getCardDimensions() {
    const width = window.innerWidth;

    if (width <= 480) {
      // small phones — aim for ~2.5 cards visible per row
      return { maxCardWidth: 200, maxCardHeight: 220, gap: 24 };
    }

    if (width <= 900) {
      // tablets / large phones
      return { maxCardWidth: 200, maxCardHeight: 220, gap: 24 };
    }

    // desktop — unchanged from before
    return { maxCardWidth: 380, maxCardHeight: 420, gap: 50 };
  }

  /* ---------------- shuffle mapping ---------------- */

  createShuffledIndices() {
    // Enlarge the tile beyond the raw item count — shuffling a tile
    // that's only as big as the items themselves means the exact
    // same arrangement gets stamped out every itemRows/itemCols
    // cells when it tiles, which reads as a repeating pattern
    // rather than randomness. Repeating items a few times first
    // gives the shuffle room to spread duplicates apart.
    const repeatFactor = 3;
    this.itemRows = Math.ceil((this.items.length * repeatFactor) / this.itemCols);

    const cols = this.itemCols;
    const rows = this.itemRows;
    const total = rows * cols;

    const pool = Array.from({ length: total }, (_, i) => i % this.items.length);

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // resolve same-item collisions with immediate left/up neighbors,
    // wrapping at the tile edges — since this tile repeats
    // seamlessly in every direction, the wrap seam is exactly where
    // an unshuffled edge would show two matching items side by side
    const at = (r, c) => pool[this.mod(r, rows) * cols + this.mod(c, cols)];
    const set = (r, c, v) => (pool[this.mod(r, rows) * cols + this.mod(c, cols)] = v);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const current = at(r, c);
        const left = at(r, c - 1);
        const up = at(r - 1, c);

        if (current === left || current === up) {
          for (let k = r * cols + c + 1; k < total; k++) {
            const kr = Math.floor(k / cols);
            const kc = k % cols;
            const candidate = pool[k];

            if (candidate === left || candidate === up) continue;

            const kLeft = at(kr, kc - 1);
            const kUp = at(kr - 1, kc);
            if (current === kLeft || current === kUp) continue;

            set(r, c, candidate);
            pool[k] = current;
            break;
          }
        }
      }
    }

    return pool;
  }

  /* ---------------- lightbox chrome (backdrop + close button + Escape) ---------------- */

  createChrome() {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "grid-backdrop";
    document.body.appendChild(this.backdrop);

    this.closeBtn = document.createElement("div");
    this.closeBtn.className = "grid-close";
    this.closeBtn.textContent = "[CLOSE]";
    document.body.appendChild(this.closeBtn);

    // backdrop is appended to <body>, outside .grid-container, so it
    // needs its own click handler — clicks on it never reach the
    // container's pointerdown/pointerup pair
    this.onBackdropClick = () => {
      if (this.activeTile) this.closeCard();
    };
    this.backdrop.addEventListener("click", this.onBackdropClick);

    this.onCloseBtnClick = () => {
      if (this.activeTile) this.closeCard();
    };
    this.closeBtn.addEventListener("click", this.onCloseBtnClick);

    this.onKeydown = (e) => {
      if (e.key === "Escape" && this.activeTile) {
        this.closeCard();
      }
    };
    document.addEventListener("keydown", this.onKeydown);
  }

  /* ---------------- pool building ---------------- */

  buildPool() {
    this.wrap.innerHTML = "";
    this.tiles = [];

    if (this.videoObserver) this.videoObserver.disconnect();

    const viewportCols = Math.ceil(this.container.offsetWidth / this.cellW) + 2;
    const viewportRows = Math.ceil(this.container.offsetHeight / this.cellH) + 2;

    this.poolCols = Math.ceil(viewportCols / this.itemCols) * this.itemCols;
    this.poolRows = Math.ceil(viewportRows / this.itemRows) * this.itemRows;

    this.poolWidth = this.poolCols * this.cellW;
    this.poolHeight = this.poolRows * this.cellH;

    for (let row = 0; row < this.poolRows; row++) {
      for (let col = 0; col < this.poolCols; col++) {
        // base cell within one itemRows x itemCols tile, looked up
        // through the shuffle instead of straight from JSON order
        const baseIndex =
          (row % this.itemRows) * this.itemCols + (col % this.itemCols);
        const itemIndex = this.shuffledIndices[baseIndex];

        const item = this.items[itemIndex];
        const tile = this.createTile(item);
        tile.classList.add("is-intro-hidden");
        this.wrap.appendChild(tile);

        // each card keeps its own image's aspect ratio, so it's centered
        // within the uniform cell rather than pinned to a corner
        const w = parseFloat(tile.dataset.restWidth);
        const h = parseFloat(tile.dataset.restHeight);
        const offsetX = (this.maxCardWidth - w) / 2;
        const offsetY = (this.maxCardHeight - h) / 2;

        this.tiles.push({
          el: tile,
          baseX: col * this.cellW + offsetX,
          baseY: row * this.cellH + offsetY,
        });
      }
    }

    this.animateIntro();

    this.videoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { root: this.container, rootMargin: "200px" }
    );

    this.wrap.querySelectorAll("video").forEach((video) => {
      this.videoObserver.observe(video);
    });

    this.updatePositions();
  }

  rebuild() {
    if (this.activeTile || this.isDestroyed) return;
    this.buildPool();
  }

  animateIntro() {
    const introCards = this.tiles.map(({ el }) => el.querySelector(".grid-card-inner"));

    if (!introCards.length) return;

    gsap.set(introCards, {
      opacity: 0,
      scale: 0.78,
      transformOrigin: "center center",
    });

    gsap.to(introCards, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: "back.out(2)",
      stagger: 0.05,
      onComplete: () => {
        this.tiles.forEach(({ el }) => el.classList.remove("is-intro-hidden"));
      },
    });
  }

  createTile(item) {
    const tile = document.createElement("div");
    tile.className = "grid-card";

    // fit the card within the max bounding box, preserving the image's
    // real aspect ratio — landscape images end up wide+short, portraits
    // end up narrow+tall, giving the mixed masonry-like look
    const aspect = item.width && item.height ? item.width / item.height : 0.75;
    let w = this.maxCardWidth;
    let h = w / aspect;
    if (h > this.maxCardHeight) {
      h = this.maxCardHeight;
      w = h * aspect;
    }

    tile.style.width = `${w}px`;
    tile.style.height = `${h}px`;
    tile.dataset.restWidth = w;
    tile.dataset.restHeight = h;

    const isVideo = item.type === "video";
    const media = isVideo
      ? `<video src="${item.image}" muted loop playsinline preload="metadata"></video>`
      : `<img src="${item.image}" alt="${item.title}" draggable="false">`;

    tile.innerHTML = `
      <div class="grid-card-inner">
        ${media}
        <div class="grid-card-details">
          <span class="grid-card-year">${item.year}</span>
          <h3 class="grid-card-title">${item.title}</h3>
          <p class="grid-card-desc">${item.description}</p>
        </div>
      </div>
    `;

    return tile;
  }

  /* ---------------- position updates ---------------- */

  mod(value, size) {
    return ((value % size) + size) % size;
  }

  updatePositions() {
    for (const tile of this.tiles) {
      if (tile.el === this.activeTile) continue;

      const x =
        this.mod(tile.baseX + this.offsetX + this.cellW, this.poolWidth) - this.cellW;
      const y =
        this.mod(tile.baseY + this.offsetY + this.cellH, this.poolHeight) - this.cellH;

      tile.el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${this.cardScale})`;
    }
  }

  /* ---------------- drag + inertia ---------------- */

  bindEvents() {
    this.onPointerDownBound = (e) => this.onPointerDown(e);
    this.onPointerMoveBound = (e) => this.onPointerMove(e);
    this.onPointerUpBound = (e) => this.onPointerUp(e);
    this.onWheelBound = (e) => this.onWheel(e);

    this.container.addEventListener("pointerdown", this.onPointerDownBound);
    this.container.addEventListener("pointermove", this.onPointerMoveBound);
    this.container.addEventListener("pointerup", this.onPointerUpBound);
    this.container.addEventListener("pointercancel", this.onPointerUpBound);
    this.container.addEventListener("wheel", this.onWheelBound, { passive: false });
  }

  onPointerDown(e) {
    this.pressedTile = e.target.closest(".grid-card");

    if (this.activeTile) return;

    this.isDragging = true;
    this.hasDragged = false;
    this.pointerId = e.pointerId;

    this.container.setPointerCapture(this.pointerId);
    this.container.classList.add("is-dragging");

    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startOffsetX = this.offsetX;
    this.startOffsetY = this.offsetY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastTime = performance.now();
    this.velocityX = 0;
    this.velocityY = 0;
  }

  onPointerMove(e) {
    if (!this.isDragging) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasDragged = true;

    this.offsetX = this.startOffsetX + dx;
    this.offsetY = this.startOffsetY + dy;

    const now = performance.now();
    const dt = now - this.lastTime || 16;

    const instVX = ((e.clientX - this.lastX) / dt) * 16;
    const instVY = ((e.clientY - this.lastY) / dt) * 16;

    this.velocityX =
      this.velocityX * (1 - this.VELOCITY_SMOOTHING) + instVX * this.VELOCITY_SMOOTHING;
    this.velocityY =
      this.velocityY * (1 - this.VELOCITY_SMOOTHING) + instVY * this.VELOCITY_SMOOTHING;

    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastTime = now;

    this.updatePositions();
  }

  normalizeWheelDelta(raw, e) {
    if (e.deltaMode === 1) return raw * 16;
    if (e.deltaMode === 2) return raw * window.innerHeight;
    return raw;
  }

  onWheel(e) {
    if (this.activeTile) return;

    e.preventDefault();

    const dx = this.normalizeWheelDelta(e.deltaX, e);
    const dy = this.normalizeWheelDelta(e.deltaY, e);

    this.velocityX -= dx * this.WHEEL_SENSITIVITY;
    this.velocityY -= dy * this.WHEEL_SENSITIVITY;

    this.velocityX = Math.max(
      -this.MAX_WHEEL_VELOCITY,
      Math.min(this.MAX_WHEEL_VELOCITY, this.velocityX)
    );
    this.velocityY = Math.max(
      -this.MAX_WHEEL_VELOCITY,
      Math.min(this.MAX_WHEEL_VELOCITY, this.velocityY)
    );
  }

  onPointerUp() {
    if (this.activeTile) {
      if (this.pressedTile !== this.activeTile) {
        this.closeCard();
      }
      this.pressedTile = null;
      return;
    }

    if (!this.isDragging) return;
    this.isDragging = false;
    this.container.classList.remove("is-dragging");
    if (this.pointerId !== null) {
      this.container.releasePointerCapture(this.pointerId);
      this.pointerId = null;
    }

    if (!this.hasDragged && this.pressedTile) {
      this.openCard(this.pressedTile);
    }
    this.pressedTile = null;
    this.hasDragged = false;
  }

  tick() {
    if (this.isDestroyed) return;

    const moving =
      this.hasDragged ||
      Math.abs(this.velocityX) > this.MOVING_THRESHOLD ||
      Math.abs(this.velocityY) > this.MOVING_THRESHOLD;
    const targetScale = moving && !this.activeTile ? this.SCALE_DOWN : 1;
    this.cardScale += (targetScale - this.cardScale) * this.SCALE_EASE;

    if (!this.isDragging && !this.activeTile) {
      if (Math.abs(this.velocityX) > 0.05 || Math.abs(this.velocityY) > 0.05) {
        this.offsetX += this.velocityX;
        this.offsetY += this.velocityY;
        this.velocityX *= this.FRICTION;
        this.velocityY *= this.FRICTION;
      } else {
        this.velocityX = 0;
        this.velocityY = 0;
      }
    }

    if (!this.activeTile) {
      this.updatePositions();
    }

    this.rafId = requestAnimationFrame(() => this.tick());
  }

  /* ---------------- open / close card ---------------- */

  openCard(tileEl) {
    const rect = tileEl.getBoundingClientRect();
    this.activeTile = tileEl;
    this.activeRect = rect;

    this.velocityX = 0;
    this.velocityY = 0;

    // siblings just get their pointer events blocked below — no
    // opacity, no fade. The active card sits on top purely through
    // z-index + position: fixed, so it "lifts" rather than the rest
    // of the grid "dissolving" around it.
    this.wrap.classList.add("has-active");
    tileEl.classList.add("is-active");

    const details = tileEl.querySelector(".grid-card-details");
    if (details) {
      gsap.set(details, { opacity: 0, y: 12 });
      gsap.to(details, {
        opacity: 1,
        y: 0,
        duration: 0.38,
        ease: "power2.out",
        delay: 0.08,
      });
    }

    // lock the page and bring in the lightbox chrome
    document.body.style.overflow = "hidden";
    this.backdrop.classList.add("is-visible");
    this.closeBtn.classList.add("is-visible");

    tileEl.style.position = "fixed";
    tileEl.style.top = "0px";
    tileEl.style.left = "0px";
    tileEl.style.width = `${rect.width}px`;
    tileEl.style.height = `${rect.height}px`;
    gsap.set(tileEl, { x: rect.left, y: rect.top });

    // the tile is about to move outside the observer's root bounds —
    // take it off autopilot and make sure it's actually playing
    const openingVideo = tileEl.querySelector("video");
    if (openingVideo) {
      if (this.videoObserver) this.videoObserver.unobserve(openingVideo);
      openingVideo.play().catch(() => {});
    }

    const aspect = rect.height / rect.width;

    // on small screens, open the card much closer to full-width —
    // the old 0.6 * innerWidth / 640px cap left mobile cards tiny
    // inside the lightbox even though there's plenty of room
    const isMobile = window.innerWidth <= 900;
    let targetWidth = isMobile
      ? window.innerWidth * 0.9
      : Math.min(window.innerWidth * 0.6, 640);
    let targetHeight = targetWidth * aspect;

    const maxHeight = window.innerHeight * 0.85;
    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = targetHeight / aspect;
    }

    const targetX = (window.innerWidth - targetWidth) / 2;
    const targetY = (window.innerHeight - targetHeight) / 2;

    gsap.to(tileEl, {
      x: targetX,
      y: targetY,
      width: targetWidth,
      height: targetHeight,
      duration: 0.9,
      ease: "power4.out",
    });
  }

  closeCard() {
    const tileEl = this.activeTile;
    const rect = this.activeRect;
    if (!tileEl) return;

    this.backdrop.classList.remove("is-visible");
    this.closeBtn.classList.remove("is-visible");

    const details = tileEl.querySelector(".grid-card-details");
    if (details) {
      gsap.to(details, {
        opacity: 0,
        y: 12,
        duration: 0.22,
        ease: "power2.inOut",
      });
    }

    // animate straight back to its exact rest position/size — no
    // opacity involved, so there's nothing to pop or overlap
    gsap.to(tileEl, {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      duration: 0.8,
      ease: "power4.inOut",
      onComplete: () => {
        tileEl.classList.remove("is-active");
        this.wrap.classList.remove("has-active");

        tileEl.style.position = "";
        tileEl.style.top = "";
        tileEl.style.left = "";
        tileEl.style.width = `${tileEl.dataset.restWidth}px`;
        tileEl.style.height = `${tileEl.dataset.restHeight}px`;
        gsap.set(tileEl, { clearProps: "transform" });

        const closingVideo = tileEl.querySelector("video");
        if (closingVideo && this.videoObserver) {
          this.videoObserver.observe(closingVideo);
        }

        document.body.style.overflow = "";
        this.activeTile = null;
        this.activeRect = null;
        this.updatePositions();
      },
    });
  }

  /* ---------------- teardown ---------------- */

  destroy() {
    this.isDestroyed = true;

    cancelAnimationFrame(this.rafId);
    clearTimeout(this.resizeTimer);
    window.removeEventListener("resize", this.onResize);

    if (this.videoObserver) this.videoObserver.disconnect();

    document.removeEventListener("keydown", this.onKeydown);
    this.backdrop.removeEventListener("click", this.onBackdropClick);
    this.closeBtn.removeEventListener("click", this.onCloseBtnClick);
    this.backdrop.remove();
    this.closeBtn.remove();

    // container's own listeners (pointerdown etc.) go away on their own
    // once the swapped-out DOM node is discarded, no need to remove them
  }
}