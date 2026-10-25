import template from "./task-attachments.html?raw";
import "./task-attachments.css";
import {
  listAttachments,
  uploadAttachment,
  downloadAttachment,
  removeAttachment,
} from "../../services/attachments.js";
import { FILE_TYPES, validateFile } from "../../services/attachment-rules.js";
import { notify, notifyError } from "../../services/api.js";
export function mountTaskAttachments(host, project, task) {
  host.innerHTML = template;
  const input = host.querySelector("[data-files]"),
    status = host.querySelector("[data-attachment-status]"),
    list = host.querySelector("ul");
  let active = true,
    busy = false;
  input.accept = Object.keys(FILE_TYPES)
    .map((ext) => "." + ext)
    .join(",");
  if (!task) {
    input.disabled = true;
    host.querySelector("[data-attachment-hint]").textContent =
      "Create this task first, then open it to attach screenshots and documents.";
    return () => {};
  }
  const dialog = host.closest(".modal");
  async function run(action) {
    if (busy) return;
    busy = true;
    input.disabled = true;
    const buttons = [...dialog.querySelectorAll("button")];
    const states = buttons.map((b) => b.disabled);
    buttons.forEach((b) => (b.disabled = true));
    try {
      await action();
    } catch (error) {
      notifyError(error);
    } finally {
      busy = false;
      if (active) {
        input.disabled = false;
        buttons.forEach((b, i) => (b.disabled = states[i]));
        status.textContent = "";
      }
    }
  }
  async function refresh() {
    const files = await listAttachments(project, task.id);
    if (!active) return;
    list.replaceChildren();
    status.textContent = files.length ? "" : "No attachments yet.";
    files.forEach((file) => {
      const item = document.createElement("li");
      item.innerHTML =
        '<span class="attachment-filename"></span><span class="attachment-meta"></span><div class="attachment-actions"><button type="button" class="btn btn-outline-primary btn-sm" data-download>Download</button><button type="button" class="btn btn-link text-danger btn-sm" data-remove>Remove</button><span data-confirm hidden><button type="button" class="btn btn-danger btn-sm" data-confirm-remove>Remove permanently</button> <button type="button" class="btn btn-link btn-sm" data-cancel>Cancel</button></span></div>';
      item.querySelector(".attachment-filename").textContent = file.filename;
      item.querySelector(".attachment-meta").textContent =
        `${Math.max(1, Math.round(Number(file.metadata?.size || 0) / 1024))} KB`;
      item.querySelector("[data-download]").onclick = () =>
        run(async () => {
          status.textContent = "Downloading…";
          const blob = await downloadAttachment(file);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.filename;
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        });
      const confirm = item.querySelector("[data-confirm]"),
        remove = item.querySelector("[data-remove]");
      remove.onclick = () => {
        confirm.hidden = false;
        remove.hidden = true;
      };
      item.querySelector("[data-cancel]").onclick = () => {
        confirm.hidden = true;
        remove.hidden = false;
      };
      item.querySelector("[data-confirm-remove]").onclick = () =>
        run(async () => {
          await removeAttachment(file);
          notify("Attachment removed");
          await refresh();
        });
      list.append(item);
    });
  }
  input.onchange = () =>
    run(async () => {
      const files = [...input.files];
      input.value = "";
      if (!files.length) return;
      files.forEach(validateFile);
      let uploaded = 0;
      try {
        for (const file of files) {
          status.textContent = `Uploading ${++uploaded} of ${files.length}…`;
          await uploadAttachment(project, task.id, file);
          notify(`Attached ${file.name}`);
        }
      } finally {
        input.value = "";
        await refresh();
      }
    });
  status.textContent = "Loading attachments…";
  refresh().catch((error) => {
    if (active) {
      status.textContent =
        "Could not load attachments. Reopen the task to retry.";
      notifyError(error);
    }
  });
  return () => {
    active = false;
    input.onchange = null;
  };
}
