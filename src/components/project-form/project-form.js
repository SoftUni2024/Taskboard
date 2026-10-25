import template from "./project-form.html?raw";
import "./project-form.css";
import { openDialog, confirmDelete } from "../dialog/dialog.js";
import { api, notify } from "../../services/api.js";
import { navigate } from "../../router.js";
export function projectForm(project, onSaved) {
  const dialog = openDialog({
    title: project ? "Project settings" : "A new beginning",
    body: template,
    submitLabel: project ? "Save project" : "Create project",
    extra: project
      ? '<button type="button" class="danger-link" data-delete>Delete project</button>'
      : "",
    onMount(root) {
      root.querySelector("[name=title]").value = project?.title || "";
      root.querySelector("[name=description]").value =
        project?.description || "";
      const color = root.querySelector("[name=color]");
      color.value = project?.color || "#8b9b73";
      for (const c of ["#8b9b73", "#8d86bb", "#d49a71", "#7ca5af", "#c78091"]) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "color-choice";
        b.style.background = c;
        b.setAttribute("aria-label", "Choose " + c);
        b.setAttribute("aria-pressed", String(color.value === c));
        b.onclick = () => {
          color.value = c;
          root
            .querySelectorAll(".color-choice")
            .forEach((el) => el.setAttribute("aria-pressed", String(el === b)));
        };
        root.querySelector("[data-colors]").append(b);
      }
      root.querySelector("[data-delete]")?.addEventListener("click", () => {
        dialog.hide();
        confirmDelete(
          "Delete project?",
          `Permanently delete “${project.title}” and all its tasks and memberships? This cannot be undone.`,
          async () => {
            await api("deleteProject", { project: project.id });
            notify("Project deleted");
            navigate("/dashboard");
          },
        );
      });
    },
    async onSubmit(form) {
      const result = await api(project ? "editProject" : "createProject", {
        ...Object.fromEntries(form),
        project: project?.id,
      });
      notify(project ? "Project updated" : "Project created");
      if (result.id) navigate("/projects/" + result.id + "/tasks");
      else await onSaved?.();
    },
  });
  return dialog;
}
