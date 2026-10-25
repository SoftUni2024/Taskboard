import template from "./projects.html?raw";
import "./projects.css";
import { requireUser, api, notify } from "../../services/api.js";
import { closeDialogs, confirmDelete } from "../../components/dialog/dialog.js";
import {
  loadProjectPage,
  PROJECT_PAGE_SIZE,
  normalizePage,
} from "../../services/paged-data.js";
import { notifyError } from "../../services/api.js";
export { template };
export const title = "Projects";
export async function mount(root) {
  const data = await requireUser(false);
  if (!data) return;
  let active = true,
    page = normalizePage(new URLSearchParams(location.search).get("page")),
    total = 0,
    version = 0,
    timer;
  data.projects = [];
  const search = root.querySelector("[type=search]");
  search.value = new URLSearchParams(location.search).get("q") || "";
  function remove(project) {
    confirmDelete(
      "Delete project?",
      `Delete “${project.title}”? Its ${project.stage_count} stages and ${project.total} tasks will also be permanently removed. This cannot be undone.`,
      async () => {
        await api("deleteProject", { project: project.id });
        await load();
        notify("Project deleted");
      },
    );
  }
  function render() {
    const visible = data.projects;
    root.querySelector("[data-count]").textContent = total
      ? `${(page - 1) * PROJECT_PAGE_SIZE + 1}–${Math.min(page * PROJECT_PAGE_SIZE, total)} of ${total} projects`
      : "0 projects";
    root.querySelector("[data-page]").textContent =
      `Page ${page} of ${Math.max(1, Math.ceil(total / PROJECT_PAGE_SIZE))}`;
    root.querySelector("[data-prev]").disabled = page <= 1;
    root.querySelector("[data-next]").disabled =
      page * PROJECT_PAGE_SIZE >= total;
    const body = root.querySelector("[data-projects]");
    body.replaceChildren();
    for (const project of visible) {
      const row = document.createElement("tr");
      row.innerHTML =
        '<td><a class="project-title-link" data-link></a></td><td><span class="project-description"></span></td><td class="text-center"><span class="project-number" data-stages></span></td><td class="text-center"><span class="project-number open-number" data-open></span></td><td class="text-center"><span class="project-number done-number" data-done></span></td><td><div class="project-row-actions"><a class="view-tasks-link" data-link>View Tasks →</a><a data-members data-link>Members</a><a data-edit data-link>Edit</a><button type="button" class="delete-project">Delete</button></div></td>';
      const tasksUrl = `/project/${project.id}/tasks`;
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
      row.querySelector("[data-members]").href =
        "/projects/" + project.id + "/users";
      row
        .querySelector("[data-members]")
        .setAttribute("aria-label", "Members of " + project.title);
      const owner = project.owner === data.user.id;
      row.querySelector("[data-edit]").hidden = !owner;
      row.querySelector("button").hidden = !owner;
      body.append(row);
    }
    if (!visible.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.className = "projects-empty";
      cell.textContent = search.value
        ? "No projects match your search."
        : "No projects yet. Create your first project to get started.";
      row.append(cell);
      body.append(row);
    }
  }
  async function load() {
    const v = ++version;
    const result = await loadProjectPage(page, search.value);
    if (!active || v !== version) return;
    total = result.count;
    if (page > 1 && (page - 1) * PROJECT_PAGE_SIZE >= total) {
      page = Math.max(1, Math.ceil(total / PROJECT_PAGE_SIZE));
      return load();
    }
    const url = new URL(location.href);
    if (page > 1) url.searchParams.set("page", String(page));
    else url.searchParams.delete("page");
    if (search.value) url.searchParams.set("q", search.value);
    else url.searchParams.delete("q");
    history.replaceState({}, "", url);
    data.projects = result.projects;
    render();
  }
  const reload = () => load().catch(notifyError);
  search.oninput = () => {
    clearTimeout(timer);
    page = 1;
    timer = setTimeout(reload, 250);
  };
  root.querySelector("[data-prev]").onclick = () => {
    page--;
    reload();
  };
  root.querySelector("[data-next]").onclick = () => {
    page++;
    reload();
  };
  await load();
  return () => {
    active = false;
    clearTimeout(timer);
    closeDialogs();
  };
}
