import template from "./footer.html?raw";
import "./footer.css";
export function mountFooter(root) {
  root.innerHTML = template;
}
