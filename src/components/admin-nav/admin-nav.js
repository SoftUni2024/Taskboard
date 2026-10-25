import template from "./admin-nav.html?raw";
import "./admin-nav.css";
export function adminNav(root) {
  root.innerHTML = template;
  root.querySelectorAll("a").forEach((a) => {
    if (location.pathname.startsWith(new URL(a.href).pathname))
      a.setAttribute("aria-current", "page");
  });
}
