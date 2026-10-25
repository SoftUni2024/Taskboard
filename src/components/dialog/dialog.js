import { Modal } from "bootstrap";
import template from "./dialog.html?raw";
import "./dialog.css";
import { notifyError } from "../notifications/notifications.js";
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
  let submitting = false;
  root.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting || !onSubmit) return;
    submitting = true;
    const buttons = [...root.querySelectorAll("button")];
    buttons.forEach((b) => (b.disabled = true));
    if (submit) submit.textContent = "Saving…";
    try {
      const result = await onSubmit(new FormData(event.currentTarget), root);
      if (result !== false) modal.hide();
    } catch (e) {
      notifyError(e);
    } finally {
      submitting = false;
      buttons.forEach((b) => (b.disabled = false));
      if (submit) submit.textContent = submitLabel;
    }
  });
  let shown = false;
  onMount?.(root, modal);
  root.addEventListener(
    "shown.bs.modal",
    () => {
      shown = true;
      (root.querySelector("input,[contenteditable]") || root.querySelector("button"))?.focus();
    },
    { once: true },
  );
  modal.show();
  return { root, hide: () => {
    if (shown) modal.hide();
    else root.addEventListener('shown.bs.modal', () => modal.hide(), {once:true});
  } };
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
