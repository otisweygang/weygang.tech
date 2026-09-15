(function () {
  const content = window.siteContent;
  const config = content.gallery;

  const galleryEl = document.getElementById("gallery");
  const bodyEl = document.getElementById("gallery-body");

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function projectsByCategory() {
    const order = content.categoryOrder || [];
    const names = order.slice();
    for (const project of content.projects) {
      if (project.category && !names.includes(project.category)) {
        names.push(project.category);
      }
    }
    return names
      .map((name) => ({
        name,
        label: (content.categories && content.categories[name]) || name,
        projects: content.projects.filter((project) => project.category === name),
      }))
      .filter((section) => section.projects.length > 0);
  }

  function renderCard(project, order) {
    const stack = project.stack
      ? `<span class="gallery-card-stack">${project.stack.map((tag) => `<span class="gallery-tag ${window.stackTagClass(tag)}">${escapeHtml(tag)}</span>`).join("")}</span>`
      : "";
    const indexText = String(order + 1).padStart(2, "0");
    return (
      `<button class="gallery-card" data-open="${escapeHtml(project.name)}" data-index="${indexText}" style="--card-order: ${order}">` +
      `<span class="gallery-card-name">${escapeHtml(project.name)}</span>` +
      `<span class="gallery-card-desc">${escapeHtml(project.description || "")}</span>` +
      stack +
      `<span class="gallery-card-open">${escapeHtml(config.openLabel)}<span class="gallery-card-open-arrow">&rarr;</span></span>` +
      `</button>`
    );
  }

  function render() {
    const sections = projectsByCategory();
    let order = 0;
    bodyEl.innerHTML = sections
      .map(
        (section) =>
          `<section class="gallery-section">` +
          `<h2 class="gallery-section-title">${escapeHtml(section.label)}</h2>` +
          `<div class="gallery-grid">${section.projects.map((project) => renderCard(project, order++)).join("")}</div>` +
          `</section>`,
      )
      .join("");
  }

  bodyEl.addEventListener("click", (event) => {
    const card = event.target.closest("[data-open]");
    if (!card) {
      return;
    }
    const project = content.projects.find((entry) => entry.name === card.dataset.open);
    if (project) {
      window.openProjectPreview(project);
    }
  });

  window.gallery = { render };
})();
