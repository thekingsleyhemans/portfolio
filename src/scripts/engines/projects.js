import { initFlowSlider } from "./flow-slider.js";
import { initVerticalFlowSlider } from "./vertical-flow-slider.js";
import { introReady, tryRevealLanding } from "../core/intro.js";

// Must match the breakpoint gating .is-vertical in styles.css.
const MOBILE_BREAKPOINT = "(max-width: 900px)";

export async function loadProjects() {
  try {
    const response = await fetch("/data/projects.json");

    if (!response.ok) {
      throw new Error(
        `Failed to load projects.json (${response.status})`
      );
    }

    const projects = await response.json();

    const container = document.querySelector(".projects-container");
    const wrap = document.querySelector(".projects-wrap");

    if (!container || !wrap) return;

    initProjectsSlider(container, wrap, projects);

    requestAnimationFrame(() => {

      introReady.projects = true;

      tryRevealLanding();

    });


  } catch(error) {

    console.error(
      "Failed to load projects:",
      error
    );

  }
}

// Owns which orientation is active and rebuilds the track whenever the
// breakpoint is crossed. A full rebuild (not just re-cloning) is
// required because buildTrack's clone count depends on the container's
// scroll dimension in the *current* layout — reusing a horizontal
// clone count for a freshly-toggled vertical layout (or vice versa)
// can leave the infinite-wrap math without enough track to loop
// through.
function initProjectsSlider(container, wrap, projects) {
  const mql = window.matchMedia(MOBILE_BREAKPOINT);

  let cleanup = null;
  let currentMode = null; // "vertical" | "horizontal"

  function setMode(isVertical) {
    const mode = isVertical ? "vertical" : "horizontal";
    if (mode === currentMode) return;

    cleanup?.();

    // Class must flip before buildTrack measures anything below — CSS
    // decides which dimension (width vs height) the cards actually lay
    // out along, and buildTrack has to agree with that before cloning.
    container.classList.toggle("is-vertical", isVertical);
    wrap.classList.toggle("is-vertical", isVertical);

    const originalCount = buildTrack(container, wrap, projects, isVertical);

    cleanup = isVertical
      ? initVerticalFlowSlider(container, wrap, originalCount)
      : initFlowSlider(container, wrap, originalCount);

    currentMode = mode;
  }

  setMode(mql.matches);

  // matchMedia's "change" fires only on an actual breakpoint crossing
  // (rotate, dev-tools resize past 900px) — not on every resize pixel —
  // so no extra debounce is needed at this level.
  function handleChange(e) {
    setMode(e.matches);
  }
  mql.addEventListener("change", handleChange);

  return () => {
    cleanup?.();
    mql.removeEventListener("change", handleChange);
  };
}


function createCard(project){

  const projectLink =
    document.createElement("a");


  projectLink.href =
    `/project/${project.slug}`;


  projectLink.className =
    "project__card is-intro-hidden";


  projectLink.draggable=false;


  projectLink.innerHTML=`

    <img 
      src="${project.heroImage}"
      alt="${project.title}"
      draggable="false"
    >

    <div class="project_deets">

      <div class="title-mask">

        <h3>${project.title}</h3>

      </div>

    </div>

  `;


  return projectLink;

}



function buildTrack(
  container,
  wrap,
  projects,
  isVertical
){

  wrap.innerHTML="";


  const originalCards =
    projects.map(createCard);



  originalCards.forEach(card=>{
    wrap.appendChild(card);
  });



  const originalCount =
    originalCards.length;


  // Which axis we're filling depends on layout direction — vertical
  // mode stacks cards top-to-bottom (scrollHeight grows, scrollWidth
  // doesn't), so measuring the wrong one here under-clones the track.
  const targetSize = isVertical
    ? container.offsetHeight * 3
    : container.offsetWidth * 3;

  function currentSize() {
    return isVertical ? wrap.scrollHeight : wrap.scrollWidth;
  }


  while(
    currentSize() < targetSize
  ){

    originalCards.forEach(card=>{

      wrap.appendChild(
        card.cloneNode(true)
      );

    });

  }


  return originalCount;

}