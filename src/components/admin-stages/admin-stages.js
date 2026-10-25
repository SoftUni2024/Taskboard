import template from "./admin-stages.html?raw";
import "./admin-stages.css";
import { openDialog, confirmDelete } from "../dialog/dialog.js";
import { deleteAdminStage, saveAdminStage } from "../../services/admin.js";
import { notify } from "../../services/api.js";
export function adminStages(root, data, onSaved) {
  root.innerHTML = template;
  const body = root.querySelector("tbody");
  for (const stage of data.stages) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td></td><td></td><td></td><td class="admin-actions"><button type="button" class="btn btn-link" data-view>View</button><button type="button" class="btn btn-link" data-edit>Edit</button><button type="button" class="btn btn-link text-danger" data-delete>Delete</button></td>';
    const count = data.tasks.filter(
      (task) => task.stage_id === stage.id,
    ).length;
    tr.children[0].textContent = stage.name;
    tr.children[1].textContent = stage.position;
    tr.children[2].textContent = count;
    tr.querySelector("[data-view]").onclick = () =>
      openDialog({
        title: "Stage details",
        body: '<dl><dt>Name</dt><dd data-name></dd><dt>ID</dt><dd class="admin-id" data-id></dd><dt>Position</dt><dd data-position></dd><dt>Tasks</dt><dd data-count></dd></dl>',
        onMount(dialog) {
          for (const [key, value] of Object.entries({
            name: stage.name,
            id: stage.id,
            position: stage.position,
            count,
          }))
            dialog.querySelector("[data-" + key + "]").textContent = value;
        },
      });
    tr.querySelector("[data-edit]").onclick = () =>
      openDialog({
        title: "Edit stage",
        body: '<label class="form-label" for="stage-name">Name</label><input id="stage-name" name="name" class="form-control mb-3" required maxlength="80"><label class="form-label" for="stage-position">Position</label><input id="stage-position" name="position" type="number" min="0" step="1" required class="form-control">',
        onMount(dialog) {
          dialog.querySelector("[name=name]").value = stage.name;
          dialog.querySelector("[name=position]").value = stage.position;
        },
        async onSubmit(form) {
          const name = String(form.get("name")).trim(),
            position = Number(form.get("position"));
          if (!name || !Number.isSafeInteger(position) || position < 0)
            throw new Error("Enter a stage name and a non-negative position.");
          await saveAdminStage(stage.id, name, position);
          notify("Stage updated");
          await onSaved();
        },
      });
    tr.querySelector("[data-delete]").onclick = () =>
      confirmDelete(
        "Delete stage?",
        `Permanently delete “${stage.name}” and its ${count} tasks and attached files?`,
        async () => {
          await deleteAdminStage(data.project.id, stage.id);
          notify("Stage deleted");
          await onSaved();
        },
      );
    body.append(tr);
  }
  if (!data.stages.length) {
    body.innerHTML = '<tr><td colspan="4">No stages in this project.</td></tr>';
  }
}
