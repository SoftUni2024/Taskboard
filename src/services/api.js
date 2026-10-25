import { auth } from "./auth.js";
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
export {
  notify,
  notifyError,
} from "../components/notifications/notifications.js";
import { notifyError } from "../components/notifications/notifications.js";
export function showError(_root, error) {
  notifyError(error);
}
export async function requireUser(loadProjects = true) {
  const data = loadProjects
    ? await getBoard()
    : { user: await auth.currentUser() };
  if (!data.user) {
    await navigate(
      "/login?return_to=" + encodeURIComponent(location.pathname),
      { replace: true },
    );
    return null;
  }
  return data;
}
