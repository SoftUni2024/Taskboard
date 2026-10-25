import template from "./projects.html?raw";
import "./projects.css";
import { requireUser } from "../../services/api.js";
import { projectCard } from "../../components/project-card/project-card.js";
import { projectForm } from "../../components/project-form/project-form.js";
import { closeDialogs } from "../../components/dialog/dialog.js";
export { template };
export const title = "Projects";
export async function mount(root) {
  const data = await requireUser();
  if (!data) return;
  const search = root.querySelector("[type=search]");
  function render() {
    const visible = data.projects.filter((project) =>
      `${project.title} ${project.description}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
    );
    root
      .querySelector("[data-projects]")
      .replaceChildren(
        ...visible.map((project) => projectCard(project, data.user)),
      );
    root.querySelector("[data-count]").textContent =
      `${data.projects.length} ${data.projects.length === 1 ? "project" : "projects"}`;
    root.querySelector("[data-empty]").textContent = !data.projects.length
      ? "No projects yet. Create your first project to get started."
      : !visible.length
        ? "No projects match your search."
        : "";
  }
  search.oninput = render;
  root.querySelector("[data-new]").onclick = () => projectForm();
  render();
  return closeDialogs;
}
