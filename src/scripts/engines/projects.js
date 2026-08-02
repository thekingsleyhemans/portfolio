import { initFlowSlider } from "./flow-slider.js";
import { introReady, tryRevealLanding } from "../core/intro.js";

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


    const originalCount = buildTrack(
      container,
      wrap,
      projects
    );


    initFlowSlider(
      container,
      wrap,
      originalCount
    );


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
  projects
){

  wrap.innerHTML="";


  const originalCards =
    projects.map(createCard);



  originalCards.forEach(card=>{
    wrap.appendChild(card);
  });



  const originalCount =
    originalCards.length;



  const targetWidth =
    container.offsetWidth * 3;



  while(
    wrap.scrollWidth < targetWidth
  ){

    originalCards.forEach(card=>{

      wrap.appendChild(
        card.cloneNode(true)
      );

    });

  }


  return originalCount;

}