import template from "./project-edit.html?raw";
import "./project-edit.css";
import { requireUser, getBoard } from "../../services/api.js";
import { mountProjectForm } from "../../components/project-form/project-form.js";
export { template };
export const title = "Edit project";
export async function mount(root, { id }) {
  const data = await requireUser();
  if (!data) return;
  const { project } = await getBoard(id);
  root.querySelector("[data-project-heading]").textContent = project.title;
  root.querySelector("[data-view-tasks]").href = `/project/${id}/tasks`;
  return mountProjectForm(root.querySelector("[data-project-form]"), project);
}
