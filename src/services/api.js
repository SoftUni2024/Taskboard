import { navigate } from "../router.js";
export async function api(action, values = {}) {
  const response = await fetch("/api/board", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...values }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not save changes.");
  return result;
}
export async function getBoard(project, signal) {
  const response = await fetch(
    "/api/board" + (project ? "?project=" + encodeURIComponent(project) : ""),
    { signal },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not load workspace.");
  return result;
}
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
export function textFromHtml(html) {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent || "";
}
export function notify(message) {
  const el = document.createElement("div");
  el.className = "app-toast shadow-sm";
  el.textContent = "✓ " + message;
  document.querySelector("#notifications").append(el);
  setTimeout(() => el.remove(), 3500);
}
export function showError(root, error) {
  const el = root.querySelector("[data-error]");
  if (el) {
    el.classList.remove("d-none");
    el.textContent = error.message;
  }
}
export async function requireUser() {
  const data = await getBoard();
  if (!data.user) {
    await navigate(
      "/login?return_to=" + encodeURIComponent(location.pathname),
      { replace: true },
    );
    return null;
  }
  return data;
}
