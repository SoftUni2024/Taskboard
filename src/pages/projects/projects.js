import template from "./projects.html?raw";
import "./projects.css";
import { requireUser, api, notify } from "../../services/api.js";
import { closeDialogs, confirmDelete } from "../../components/dialog/dialog.js";
export { template };
export const title = "Projects";
export async function mount(root) {
  const data = await requireUser();
  if (!data) return;
  let active = true;
  const search = root.querySelector("[type=search]");
  function remove(project) {
    confirmDelete(
      "Delete project?",
      `Delete “${project.title}”? Its ${project.stage_count} stages and ${project.total} tasks will also be permanently removed. This cannot be undone.`,
      async () => {
        await api("deleteProject", { project: project.id });
        data.projects = data.projects.filter((row) => row.id !== project.id);
        if (active) render();
        notify("Project deleted");
      },
    );
  }
  function render() {
    const visible = data.projects.filter((project) =>
      `${project.title} ${project.description}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
    );
    root.querySelector("[data-count]").textContent = search.value
      ? `${visible.length} of ${data.projects.length} projects`
      : `${data.projects.length} ${data.projects.length === 1 ? "project" : "projects"}`;
    const body = root.querySelector("[data-projects]");
    body.replaceChildren();
    for (const project of visible) {
      const row = document.createElement("tr");
      row.innerHTML =
        '<td><a class="project-title-link" data-link></a></td><td><span class="project-description"></span></td><td class="text-center"><span class="project-number" data-stages></span></td><td class="text-center"><span class="project-number open-number" data-open></span></td><td class="text-center"><span class="project-number done-number" data-done></span></td><td><div class="project-row-actions"><a class="view-tasks-link" data-link>View Tasks →</a><a data-edit data-link>Edit</a><button type="button" class="delete-project">Delete</button></div></td>';
      const tasksUrl = `/projects/${project.id}/tasks`;
      row.querySelector(".project-title-link").textContent = project.title;
      row.querySelector(".project-title-link").href = tasksUrl;
      row.querySelector(".project-description").textContent =
        project.description || "No description";
      row.querySelector(".project-description").title =
        project.description || "No description";
      row.querySelector("[data-stages]").textContent = project.stage_count;
      row.querySelector("[data-open]").textContent =
        project.total - project.done;
      row.querySelector("[data-done]").textContent = project.done;
      row.querySelector(".view-tasks-link").href = tasksUrl;
      row
        .querySelector(".view-tasks-link")
        .setAttribute("aria-label", `View Tasks for ${project.title}`);
      row.querySelector("[data-edit]").href = `/project/${project.id}/edit`;
      row
        .querySelector("[data-edit]")
        .setAttribute("aria-label", `Edit ${project.title}`);
      row
        .querySelector("button")
        .setAttribute("aria-label", `Delete ${project.title}`);
      row.querySelector("button").onclick = () => remove(project);
      body.append(row);
    }
    if (!visible.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.className = "projects-empty";
      cell.textContent = !data.projects.length
        ? "No projects yet. Create your first project to get started."
        : "No projects match your search.";
      row.append(cell);
      body.append(row);
    }
  }
  search.oninput = render;
  render();
  return () => {
    active = false;
    closeDialogs();
  };
}
