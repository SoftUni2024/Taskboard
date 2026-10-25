import template from "./task-form.html?raw";
import "./task-form.css";
import { openDialog, confirmDelete } from "../dialog/dialog.js";
import { api, notify } from "../../services/api.js";
export function taskForm(project, task, stage, onSaved, stages) {
  const dialog = openDialog({
    title: task ? "Task details" : "Add a task",
    body: template,
    submitLabel: task ? "Save changes" : "Create task",
    extra: task
      ? '<button type="button" class="danger-link" data-delete>Delete task</button>'
      : "",
    onMount(root) {
      root.querySelector("[name=title]").value = task?.title || "";
      if (stages) {
        const select = root.querySelector("[name=stage]");
        select.replaceChildren(
          ...stages.map((s, i) => {
            const option = document.createElement("option");
            option.value = i;
            option.textContent = s.name;
            return option;
          }),
        );
      }
      root.querySelector("[name=stage]").value = task?.stage ?? stage;
      const editor = root.querySelector(".task-editor");
      editor.innerHTML = task?.description || "";
      root.querySelectorAll("[data-command]").forEach((button) => {
        button.onmousedown = (e) => e.preventDefault();
        button.onclick = () => {
          editor.focus();
          document.execCommand(button.dataset.command);
        };
      });
      editor.onpaste = (e) => {
        e.preventDefault();
        document.execCommand(
          "insertText",
          false,
          e.clipboardData.getData("text/plain"),
        );
      };
      root.querySelector("[data-delete]")?.addEventListener("click", () => {
        dialog.hide();
        confirmDelete(
          "Delete task?",
          `Permanently delete “${task.title}”? This cannot be undone.`,
          async () => {
            await api("deleteTask", { project, id: task.id });
            notify("Task deleted");
            await onSaved();
          },
        );
      });
    },
    async onSubmit(form, root) {
      await api(task ? "editTask" : "createTask", {
        ...Object.fromEntries(form),
        stage: Number(form.get("stage")),
        description: root.querySelector(".task-editor").innerHTML,
        project,
        id: task?.id,
      });
      notify(task ? "Task updated" : "Task created");
      await onSaved();
    },
  });
  return dialog;
}
