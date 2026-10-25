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
      root.querySelector("[data-delete]")?.addEventListener("click", () => {
        dialog.hide();
        confirmDelete(
          "Delete project?",
          `Permanently delete “${project.title}” and all its stages and tasks? This cannot be undone.`,
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
