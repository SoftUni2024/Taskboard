import template from "./dashboard.html?raw";
import "./dashboard.css";
import { requireUser, getBoard } from "../../services/api.js";
import { projectForm } from "../../components/project-form/project-form.js";
import { projectCard } from "../../components/project-card/project-card.js";
import { closeDialogs } from "../../components/dialog/dialog.js";
export { template };
export const title = "Dashboard";
export async function mount(root) {
  let data = await requireUser();
  if (!data) return;
  const search = root.querySelector("[type=search]");
  function render() {
    const projects = data.projects,
      visible = projects.filter((p) =>
        (p.title + " " + p.description)
          .toLowerCase()
          .includes(search.value.toLowerCase()),
      );
    root.querySelector("[data-greeting]").textContent =
      `Welcome back, ${data.user.name.split(/[\s@]/)[0]}. Here’s where things stand.`;
    root.querySelector("[data-total]").textContent = String(
      projects.length,
    ).padStart(2, "0");
    root.querySelector("[data-pending]").textContent = String(
      projects.reduce((n, p) => n + p.total - p.done, 0),
    ).padStart(2, "0");
    root.querySelector("[data-completed]").textContent = String(
      projects.reduce((n, p) => n + p.done, 0),
    ).padStart(2, "0");
    root.querySelector("[data-project-count]").textContent = projects.length;
    const grid = root.querySelector("[data-projects]");
    grid.replaceChildren(...visible.map((p) => projectCard(p, data.user)));
    const wrapper = document.createElement("div");
    wrapper.className = "col-sm-6 col-lg-4";
    wrapper.innerHTML =
      '<button class="new-project-card"><span>＋</span><strong>Create a new project</strong><small>Make space for your next idea</small></button>';
    wrapper.querySelector("button").onclick = create;
    grid.append(wrapper);
    root.querySelector("[data-empty]").textContent = !projects.length
      ? "Your workspace is ready. Create your first project to get started."
      : !visible.length
        ? "No projects match your search."
        : "";
  }
  function create() {
    projectForm(null, async () => {
      data = await getBoard();
      render();
    });
  }
  search.oninput = render;
  root.querySelector("[data-new]").onclick = create;
  root.querySelector("[data-start]").onclick = create;
  render();
  return closeDialogs;
}
