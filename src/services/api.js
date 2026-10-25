import { navigate } from "../router.js";
import { loadBoard, mutateBoard } from "./board-store.js";
export const getBoard = loadBoard;
export const api = mutateBoard;
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
