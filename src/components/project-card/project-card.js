import template from "./project-card.html?raw";
import "./project-card.css";
export function projectCard(project, user) {
  const wrapper = document.createElement("div");
  wrapper.className = "col-sm-6 col-lg-4";
  wrapper.innerHTML = template;
  const card = wrapper.firstElementChild;
  card.href = "/projects/" + project.id + "/tasks";
  card.querySelector(".project-icon").style.background = project.color;
  card.querySelector("[data-role]").textContent =
    project.owner === user.id ? "YOUR PROJECT" : "SHARED WITH YOU";
  card.querySelector("h3").textContent = project.title;
  card.querySelector("p").textContent =
    project.description || "A space for ideas, plans, and meaningful progress.";
  card.querySelector("[data-count]").textContent =
    project.total + " " + (project.total === 1 ? "task" : "tasks");
  const percent = project.total
    ? Math.round((project.done / project.total) * 100)
    : 0;
  card.querySelector("[data-percent]").textContent = percent + "%";
  const bar = card.querySelector(".project-progress span");
  bar.style.width = percent + "%";
  bar.style.background = project.color;
  card.querySelector("[data-done]").textContent = project.done + " completed";
  return wrapper;
}
