import template from "./dashboard.html?raw";
import "./dashboard.css";
import { requireUser } from "../../services/api.js";
import { navigate } from "../../router.js";
import { projectCard } from "../../components/project-card/project-card.js";
import { closeDialogs } from "../../components/dialog/dialog.js";
export { template };
export const title = "Dashboard";
export async function mount(root) {
  const data = await requireUser();
  if (!data) return;
  const projects = data.projects;
  const totalTasks = projects.reduce(
    (total, project) => total + project.total,
    0,
  );
  const doneTasks = projects.reduce(
    (total, project) => total + project.done,
    0,
  );
  root.querySelector("[data-greeting]").textContent =
    `Welcome back, ${data.user.name.split(/[\s@]/)[0]}. Here’s where things stand.`;
  root.querySelector("[data-total]").textContent = projects.length;
  root.querySelector("[data-task-total]").textContent = totalTasks;
  root.querySelector("[data-pending]").textContent = totalTasks - doneTasks;
  root.querySelector("[data-completed]").textContent = doneTasks;
  root
    .querySelector("[data-projects]")
    .replaceChildren(
      ...projects.slice(0, 3).map((project) => projectCard(project, data.user)),
    );
  root.querySelector("[data-empty]").textContent = !projects.length
    ? "Your workspace is ready. Create your first project to get started."
    : "";
  root.querySelector("[data-new]").onclick = () => navigate("/project/add");
  root.querySelector("[data-start]").onclick = () => navigate("/project/add");
  return closeDialogs;
}
