import template from "./header.html?raw";
import "./header.css";
import { getBoard, escapeHtml } from "../../services/api.js";
let element,
  revision = 0;
export function mountHeader(root) {
  element = root;
  root.innerHTML = template;
  refreshHeader();
}
export async function refreshHeader() {
  const version = ++revision;
  try {
    const { user } = await getBoard();
    if (version !== revision || !element) return;
    element.querySelector("[data-account-nav]").innerHTML = user
      ? `<a class="nav-link account-link" data-link href="/account"><span class="user-avatar">${escapeHtml(user.name.slice(0, 1).toUpperCase())}</span><span class="d-none d-md-inline">Account</span></a>`
      : '<a class="btn btn-primary btn-sm" data-link href="/login">Sign in</a>';
    element.querySelectorAll("a[data-link]").forEach((link) => {
      const active = new URL(link.href).pathname === location.pathname;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  } catch {
    element.querySelector("[data-account-nav]").innerHTML =
      '<a href="/login" data-link class="nav-link">Sign in</a>';
  }
}
