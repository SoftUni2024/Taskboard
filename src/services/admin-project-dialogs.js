import { openDialog, confirmDelete } from "../components/dialog/dialog.js";
import { api, notify } from "./api.js";
export function editAdminProject(project, onSaved) {
  return openDialog({
    title: "Edit project",
    body: '<label class="form-label" for="admin-project-title">Title</label><input id="admin-project-title" name="title" class="form-control mb-3" required maxlength="120"><label class="form-label" for="admin-project-description">Description</label><textarea id="admin-project-description" name="description" class="form-control" rows="5" maxlength="2000"></textarea>',
    onMount(root) {
      root.querySelector("[name=title]").value = project.title;
      root.querySelector("textarea").value = project.description;
    },
    async onSubmit(form) {
      const title = String(form.get("title")).trim();
      if (!title) throw new Error("Enter a project title.");
      await api("editProject", {
        project: project.id,
        title,
        description: form.get("description"),
      });
      notify("Project updated");
      await onSaved();
    },
  });
}
export function deleteAdminProject(project, onSaved) {
  return confirmDelete(
    "Delete project?",
    `Permanently delete “${project.title}”, its stages, tasks, memberships, and files?`,
    async () => {
      await api("deleteProject", { project: project.id });
      notify("Project deleted");
      await onSaved();
    },
  );
}
