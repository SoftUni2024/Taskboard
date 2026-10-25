import template from "./project-add.html?raw";
import "./project-add.css";
import { requireUser } from "../../services/api.js";
import { mountProjectForm } from "../../components/project-form/project-form.js";
export { template };
export const title = "Create project";
export async function mount(root) {
  const data = await requireUser();
  if (!data) return;
  return mountProjectForm(root.querySelector("[data-project-form]"));
}
