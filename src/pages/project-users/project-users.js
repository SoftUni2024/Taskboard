import template from "./project-users.html?raw";
import "./project-users.css";
import { requireUser, notify } from "../../services/api.js";
import {
  getProject,
  projectPeople,
  removeProjectUser,
} from "../../services/project-members.js";
import { memberPicker } from "../../components/member-picker/member-picker.js";
import { openDialog, closeDialogs } from "../../components/dialog/dialog.js";
export { template };
export const title = "Project members";
export async function mount(root, { id }) {
  const data = await requireUser();
  if (!data) return;
  const project = await getProject(id),
    owner = project.owner_id === data.user.id;
  let active = true;
  root.querySelector("[data-project-title]").textContent = project.title;
  root.querySelector("[data-permissions]").textContent = owner
    ? "Assign people to collaborate on tasks. Only you can manage project membership."
    : "You can collaborate on tasks. The project owner manages membership.";
  root.querySelector("[data-add-user]").hidden = !owner;
  root.querySelector("[data-tasks]").href = `/project/${id}/tasks`;
  async function refresh() {
    const people = await projectPeople(id);
    if (!active) return;
    const body = root.querySelector("tbody");
    body.replaceChildren();
    people.forEach((person) => {
      const tr = document.createElement("tr");
      for (const value of [person.name, person.email, person.role]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      const actions = document.createElement("td");
      if (owner && person.role !== "Owner") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-outline-danger btn-sm";
        button.textContent = "Remove user";
        button.setAttribute("aria-label", `Remove ${person.email}`);
        button.onclick = () =>
          openDialog({
            title: "Remove user from project?",
            body: "<p data-remove-message></p>",
            submitLabel: "Remove user",
            onMount(dialog) {
              dialog.querySelector("[data-remove-message]").textContent =
                `Remove ${person.email} from “${project.title}”? They will lose access to this project and its files.`;
              dialog.querySelector("[data-submit]").className =
                "btn btn-danger";
            },
            async onSubmit() {
              await removeProjectUser(id, person.id);
              notify("User removed from project");
              await refresh();
            },
          });
        actions.append(button);
      } else
        actions.textContent = person.role === "Owner" ? "Project owner" : "—";
      tr.append(actions);
      body.append(tr);
    });
  }
  root.querySelector("[data-add-user]").onclick = () =>
    memberPicker(id, refresh);
  await refresh();
  return () => {
    active = false;
    closeDialogs();
  };
}
