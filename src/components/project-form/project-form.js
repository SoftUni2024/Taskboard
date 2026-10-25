import template from "./project-form.html?raw";
import "./project-form.css";
import { api, notify, showError } from "../../services/api.js";
import { navigate } from "../../router.js";
export function mountProjectForm(root, project = null) {
  root.innerHTML = template;
  const form = root.querySelector("form");
  const fieldset = root.querySelector("fieldset");
  const save = root.querySelector("[data-save]");
  let active = true,
    busy = false;
  form.elements.title.value = project?.title || "";
  form.elements.description.value = project?.description || "";
  save.textContent = project ? "Save changes →" : "Create project →";
  function count() {
    root.querySelector("[data-description-count]").textContent =
      `${form.elements.description.value.length} / 2000`;
  }
  form.elements.description.oninput = count;
  count();
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(form));
    values.title = values.title.trim();
    if (!values.title) {
      showError(root, new Error("Enter a project title."));
      form.elements.title.focus();
      return;
    }
    busy = true;
    fieldset.disabled = true;
    save.textContent = project ? "Saving…" : "Creating…";
    try {
      await api(project ? "editProject" : "createProject", {
        ...values,
        project: project?.id,
      });
      notify(project ? "Project updated" : "Project created");
      if (active) await navigate("/projects");
    } catch (error) {
      if (active) showError(root, error);
    } finally {
      busy = false;
      if (active) {
        fieldset.disabled = false;
        save.textContent = project ? "Save changes →" : "Create project →";
      }
    }
  };
  return () => {
    active = false;
    form.onsubmit = null;
  };
}
