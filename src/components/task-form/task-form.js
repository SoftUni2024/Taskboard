import template from "./task-form.html?raw";
import "./task-form.css";
import { openDialog, confirmDelete } from "../dialog/dialog.js";
import { api, notify, notifyError } from "../../services/api.js";
import { mountTaskAttachments } from "../task-attachments/task-attachments.js";
import { mountTaskComments } from "../task-comments/task-comments.js";
import { mountTaskAssignee } from "../task-assignee/task-assignee.js";
import { mountTaskLabels } from "../task-labels/task-labels.js";
export function taskForm(project, task, stage, onSaved, stages) {
  let assignee;
  const dialog = openDialog({
    title: task ? "Edit task" : "Add New Task",
    body: template,
    submitLabel: task ? "Save changes" : "Create task",
    extra: task
      ? '<button type="button" class="danger-link" data-delete>Delete task</button>'
      : "",
    onMount(root) {
      const stopLabels = mountTaskLabels(root.querySelector("[data-task-labels]"),project,task,onSaved);
      root.addEventListener("hidden.bs.modal",stopLabels,{once:true});
      assignee = mountTaskAssignee(root.querySelector("[data-task-assignee]"), project, task);
      root.addEventListener("hidden.bs.modal", () => assignee.stop(), { once: true });
      const stopComments = mountTaskComments(
        root.querySelector("[data-task-comments]"),
        project,
        task,
      );
      root.addEventListener("hidden.bs.modal", stopComments, { once: true });
      const stopAttachments = mountTaskAttachments(
        root.querySelector("[data-task-attachments]"),
        project,
        task,
      );
      root.addEventListener("hidden.bs.modal", stopAttachments, { once: true });
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
        root.addEventListener(
          "hidden.bs.modal",
          () =>
            confirmDelete(
              "Delete task?",
              `Permanently delete “${task.title}”? This cannot be undone.`,
              async () => {
                await api("deleteTask", { project, id: task.id });
                notify("Task deleted");
                await onSaved().catch(notifyError);
              },
            ),
          { once: true },
        );
        dialog.hide();
      });
    },
    async onSubmit(form, root) {
      const title = String(form.get("title") || "").trim();
      if (!title) {
        root.querySelector("[name=title]").focus();
        throw new Error("Enter a task title.");
      }
      await api(task ? "editTask" : "createTask", {
        ...Object.fromEntries(form),
        title,
        assignee_id: assignee.value(),
        stage: Number(form.get("stage")),
        description: root.querySelector(".task-editor").innerHTML,
        project,
        id: task?.id,
      });
      notify(task ? "Task updated" : "Task created");
      await onSaved().catch(notifyError);
    },
  });
  return dialog;
}
