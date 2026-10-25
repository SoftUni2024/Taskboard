import { auth } from "../../services/auth.js";
import { logoutFromApp } from "../../services/auth-navigation.js";
import template from "./header.html?raw";
import "./header.css";
import { escapeHtml, notifyError } from "../../services/api.js";
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
    const user = await auth.currentUser();
    if (version !== revision || !element) return;
    element.querySelector(".navbar-brand").href = user ? "/dashboard" : "/";
    element.querySelector("[data-home]").hidden = Boolean(user);
    element.querySelector("[data-dashboard]").hidden = !user;
    element.querySelector("[data-projects-nav]").hidden = !user;
    element.querySelector("[data-account-nav]").innerHTML = user
      ? `<a class="nav-link account-link" data-link href="/account"><span class="user-avatar">${escapeHtml(user.name.slice(0, 1).toUpperCase())}</span><span class="d-none d-md-inline">Account</span></a><button type="button" class="btn btn-link nav-link" data-logout>Log out</button>`
      : '<a class="btn btn-primary btn-sm" data-link href="/login">Sign in</a>';
    element
      .querySelector("[data-logout]")
      ?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await logoutFromApp();
        } catch (error) {
          button.disabled = false;
          notifyError(error);
        }
      });
    element.querySelectorAll("a[data-link]").forEach((link) => {
      const active = new URL(link.href).pathname === location.pathname;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  } catch (error) {
    if (version !== revision || !element) return;
    notifyError(error);
    element.querySelector("[data-account-nav]").innerHTML =
      '<a href="/login" data-link class="nav-link">Sign in</a>';
  }
}
