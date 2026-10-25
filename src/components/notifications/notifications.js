import Toast from "bootstrap/js/dist/toast.js";
import template from "./notifications.html?raw";
import "./notifications.css";

const visible = new Map();
let container;
let validationInstalled = false;

export function mountNotifications(root) {
  container = root;
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Notifications");
  root.innerHTML =
    '<div class="notification-region" data-info-region role="status" aria-live="polite" aria-relevant="additions text"></div><div class="notification-region" data-error-region role="alert" aria-live="assertive" aria-relevant="additions text"></div>';
  if (!validationInstalled) {
    validationInstalled = true;
    let firstInvalid;
    document.addEventListener(
      "invalid",
      (event) => {
        if (!(
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement
        ))
          return;
        event.preventDefault();
        event.target.setAttribute("aria-invalid", "true");
        event.target.addEventListener(
          "input",
          () => event.target.removeAttribute("aria-invalid"),
          { once: true },
        );
        if (firstInvalid) return;
        firstInvalid = event.target;
        // Browser validation dispatches several invalid events in one submit.
        // Wait until that batch ends so only the first field produces a toast.
        setTimeout(() => {
          const field = firstInvalid;
          firstInvalid = null;
          const label = field.labels?.[0]?.textContent.trim();
          notifyError(`${label ? label + ": " : ""}${field.validationMessage}`);
          field.focus();
        }, 0);
      },
      true,
    );
  }
}

function show(message, type) {
  const candidate = typeof message === "string" ? message : message?.message;
  const text = typeof candidate === "string" ? candidate.trim() : "";
  const content =
    text ||
    (type === "error"
      ? "Something went wrong. Please try again."
      : "Changes saved.");
  const key = `${type}:${content}`;
  if (visible.has(key)) {
    visible.get(key).toast.show();
    return visible.get(key).element;
  }
  if (!container?.isConnected) {
    const root =
      document.querySelector("#notifications") ||
      document.body.appendChild(
        Object.assign(document.createElement("div"), { id: "notifications" }),
      );
    mountNotifications(root);
  }
  // Keep the stack bounded even during repeated network errors.
  if (visible.size >= 4) {
    const [oldKey, old] = visible.entries().next().value;
    old.toast.dispose();
    old.element.remove();
    visible.delete(oldKey);
  }
  const wrapper = document.createElement("div");
  wrapper.innerHTML = template;
  const element = wrapper.firstElementChild;
  element.classList.add(`app-toast--${type}`);
  element.setAttribute(
    "aria-label",
    type === "error" ? "Error notification" : "Info notification",
  );
  element.querySelector("[data-title]").textContent =
    type === "error" ? "Something went wrong" : "All set";
  element.querySelector("[data-icon]").textContent =
    type === "error" ? "!" : "✓";
  element.querySelector("[data-message]").textContent = content;
  const toast = new Toast(element, { autohide: type !== "error", delay: 5000 });
  visible.set(key, { element, toast });
  element.querySelector("button").onclick = () => toast.hide();
  element.addEventListener(
    "hidden.bs.toast",
    () => {
      toast.dispose();
      element.remove();
      visible.delete(key);
    },
    { once: true },
  );
  container
    .querySelector(
      type === "error" ? "[data-error-region]" : "[data-info-region]",
    )
    .append(element);
  toast.show();
  return element;
}

export function notify(message) {
  return show(message, "info");
}
export function notifyError(error) {
  return show(error, "error");
}
