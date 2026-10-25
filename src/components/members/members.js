import template from "./members.html?raw";
import "./members.css";
import { openDialog } from "../dialog/dialog.js";
import { api, escapeHtml, notify, showError } from "../../services/api.js";
export function membersDialog(data, onSaved) {
  const isOwner = data.project.owner === data.user.id;
  let current = data;
  function render(root) {
    root.querySelector("[data-member-list]").innerHTML = [
      { ...current.owner, owner: true },
      ...current.members,
    ]
      .map(
        (m) =>
          `<div class="member-row"><span class="user-avatar">${escapeHtml((m.name || m.email).slice(0, 1).toUpperCase())}</span><div><strong>${escapeHtml(m.name || "New member")}</strong><small>${escapeHtml(m.email)}</small></div>${m.owner ? '<span class="badge-owner">Owner</span>' : isOwner ? `<button type="button" class="btn btn-sm text-danger" data-remove="${escapeHtml(m.email)}" aria-label="Remove ${escapeHtml(m.email)}">×</button>` : ""}</div>`,
      )
      .join("");
    root.querySelectorAll("[data-remove]").forEach(
      (button) =>
        (button.onclick = async () => {
          button.disabled = true;
          try {
            await api("removeMember", {
              project: data.project.id,
              email: button.dataset.remove,
            });
            current = await onSaved();
            render(root);
            notify("Member removed");
          } catch (error) {
            showError(root, error);
            button.disabled = false;
          }
        }),
    );
  }
  return openDialog({
    title: "Project members",
    body: template,
    submitLabel: "Add member",
    onMount(root) {
      root.querySelector("[data-member-help]").textContent = isOwner
        ? "Add people by their ChatGPT account email. They also need site-sharing access. Share this board link with them separately."
        : "The people bringing this project to life.";
      if (!isOwner) root.querySelector("[data-member-input]").remove();
      render(root);
    },
    onSubmit: isOwner
      ? async (form, root) => {
          await api("addMember", {
            project: data.project.id,
            email: form.get("email"),
          });
          current = await onSaved();
          render(root);
          root.querySelector("[name=email]").value = "";
          notify("Member added");
          return false;
        }
      : undefined,
  });
}
