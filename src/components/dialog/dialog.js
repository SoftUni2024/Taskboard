import { Modal } from "bootstrap";
import template from "./dialog.html?raw";
import "./dialog.css";
const openDialogs = new Set();
export function openDialog({
  title,
  body,
  submitLabel = "Save changes",
  onSubmit,
  onMount,
  extra = "",
}) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = template;
  const root = wrapper.firstElementChild;
  document.body.append(root);
  root.querySelector(".modal-title").textContent = title;
  root.querySelector("[data-body]").innerHTML = body;
  root.querySelector("[data-extra]").innerHTML = extra;
  const submit = root.querySelector("[data-submit]");
  submit.textContent = submitLabel;
  if (!onSubmit) submit.remove();
  const modal = new Modal(root, { backdrop: "static", keyboard: false });
  openDialogs.add(modal);
  root.addEventListener(
    "hidden.bs.modal",
    () => {
      openDialogs.delete(modal);
      modal.dispose();
      root.remove();
    },
    { once: true },
  );
  root.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = root.querySelector("[data-error]");
    error.classList.add("d-none");
    const buttons = [...root.querySelectorAll("button")];
    buttons.forEach((b) => (b.disabled = true));
    if (submit) submit.textContent = "Saving…";
    try {
      const result = await onSubmit(new FormData(event.currentTarget), root);
      if (result !== false) modal.hide();
    } catch (e) {
      error.textContent = e.message;
      error.classList.remove("d-none");
    } finally {
      buttons.forEach((b) => (b.disabled = false));
      if (submit) submit.textContent = submitLabel;
    }
  });
  onMount?.(root, modal);
  root.addEventListener(
    "shown.bs.modal",
    () => root.querySelector("input,[contenteditable],button")?.focus(),
    { once: true },
  );
  modal.show();
  return { root, hide: () => modal.hide() };
}
export function closeDialogs() {
  for (const modal of openDialogs) modal.hide();
}
export function confirmDelete(title, message, onConfirm) {
  return openDialog({
    title,
    body: `<p data-confirm-message></p>`,
    submitLabel: "Delete permanently",
    onMount(root) {
      root.querySelector("[data-confirm-message]").textContent = message;
      root.querySelector("[data-submit]").className = "btn btn-danger";
    },
    onSubmit: onConfirm,
  });
}
