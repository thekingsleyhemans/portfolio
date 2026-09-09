export async function initMobileProjects() {
  const section = document.querySelector(".mobile-projects");

  // Stop if the mobile component doesn't exist
  if (!section) return;

  // Prevent duplicate initialization
  if (section.dataset.initialized === "true") return;

  section.dataset.initialized = "true";

  const cardsContainer = section.querySelector(
    ".mobile-project-cards"
  );

  const titleElement = section.querySelector(
    ".mobile-project-title"
  );

  const progressBar = section.querySelector(
    ".mobile-project-progress-bar"
  );

  if (!cardsContainer || !titleElement || !progressBar) {
    console.warn("Mobile project deck elements are missing.");
    return;
  }

  try {
    // Load project data from the public directory
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

    // --------------------------------------------
    // RENDER PROJECT CARDS
    // --------------------------------------------

    projects.forEach((project, index) => {
      const card = document.createElement("a");

      card.className = "mobile-project-card";

      card.href = `/project/${project.slug}`;

      card.dataset.index = index;

      const image = document.createElement("img");

      image.src = project.heroImage;
      image.alt = project.title;

      image.loading = index === 0 ? "eager" : "lazy";

      image.draggable = false;

      card.appendChild(image);

      cardsContainer.appendChild(card);
    });

    // --------------------------------------------
    // INITIAL PROJECT STATE
    // --------------------------------------------

    titleElement.textContent = projects[0].title;

    updateProgress(0);

    // --------------------------------------------
    // PROGRESS
    // --------------------------------------------

    function updateProgress(activeIndex) {
      const progress =
        ((activeIndex + 1) / projects.length) * 100;

      progressBar.style.width = `${progress}%`;
    }
  } catch (error) {
    console.error(
      "Failed to initialize mobile projects:",
      error
    );

    section.dataset.initialized = "false";
  }
}