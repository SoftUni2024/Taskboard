import template from "./admin-tasks.html?raw";
import "./admin-tasks.css";
import { openDialog, confirmDelete } from "../dialog/dialog.js";
import { taskForm } from "../task-form/task-form.js";
import { api, notify, textFromHtml } from "../../services/api.js";
export function adminTasks(root, data, onSaved) {
  root.innerHTML = template;
  const body = root.querySelector("tbody");
  for (const task of data.tasks) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td></td><td></td><td></td><td></td><td class="admin-actions"><button type="button" class="btn btn-link" data-view>View</button><button type="button" class="btn btn-link" data-edit>Edit</button><button type="button" class="btn btn-link text-danger" data-delete>Delete</button></td>';
    tr.children[0].textContent = task.title;
    tr.children[1].textContent = data.stages[task.stage]?.name || "Unknown";
    tr.children[2].textContent = task.position;
    tr.children[3].textContent = task.done ? "Yes" : "No";
    tr.querySelector("[data-view]").onclick = () =>
      openDialog({
        title: "Task details",
        body: '<h3 class="h5" data-title></h3><p class="admin-id" data-id></p><div class="admin-tasks-view" data-description></div>',
        onMount(dialog) {
          dialog.querySelector("[data-title]").textContent = task.title;
          dialog.querySelector("[data-id]").textContent = task.id;
          dialog.querySelector("[data-description]").textContent =
            textFromHtml(task.description) || "No description";
        },
      });
    tr.querySelector("[data-edit]").onclick = () =>
      taskForm(data.project.id, task, task.stage, onSaved, data.stages);
    tr.querySelector("[data-delete]").onclick = () =>
      confirmDelete(
        "Delete task?",
        `Permanently delete “${task.title}” and its attached files?`,
        async () => {
          await api("deleteTask", { project: data.project.id, id: task.id });
          notify("Task deleted");
          await onSaved();
        },
      );
    body.append(tr);
  }
  if (!data.tasks.length)
    body.innerHTML = '<tr><td colspan="5">No tasks in this project.</td></tr>';
}
