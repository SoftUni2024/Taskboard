import template from "./admin-project.html?raw";
import "./admin-project.css";
import { requireAdmin } from "../../services/admin.js";
import { getBoard } from "../../services/api.js";
import { adminNav } from "../../components/admin-nav/admin-nav.js";
import { adminStages } from "../../components/admin-stages/admin-stages.js";
import { adminTasks } from "../../components/admin-tasks/admin-tasks.js";
import {
  editAdminProject,
  deleteAdminProject,
} from "../../services/admin-project-dialogs.js";
import { closeDialogs } from "../../components/dialog/dialog.js";
import { navigate } from "../../router.js";
export { template };
export const title = "Admin · Project";
export async function mount(root, { id }) {
  if (!(await requireAdmin())) return;
  adminNav(root.querySelector("[data-admin-nav]"));
  let active = true;
  async function load() {
    const data = await getBoard(id);
    if (!active) return;
    root.querySelector("[data-title]").textContent = data.project.title;
    root.querySelector("[data-description]").textContent =
      data.project.description || "No description";
    root.querySelector("[data-owner]").textContent =
      "Owner: " + data.project.owner;
    root.querySelector("[data-board]").href = `/project/${id}/tasks`;
    root.querySelector("[data-edit]").onclick = () =>
      editAdminProject(data.project, load);
    root.querySelector("[data-delete]").onclick = () =>
      deleteAdminProject(data.project, () => navigate("/admin/projects"));
    adminStages(root.querySelector("[data-stages]"), data, load);
    adminTasks(root.querySelector("[data-tasks]"), data, load);
  }
  await load();
  return () => {
    active = false;
    closeDialogs();
  };
}
