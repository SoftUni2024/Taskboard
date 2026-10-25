import template from "./login.html?raw";
import "./login.css";
import { navigate } from "../../router.js";
import { auth } from "../../services/auth.js";
import { showError } from "../../services/api.js";
export { template };
export const title = "Log in / Register";
export async function mount(root) {
  let active = true,
    busy = false,
    mode = "login";
  const form = root.querySelector("form");
  const buttons = [...root.querySelectorAll("[data-mode]")];
  function setMode(next) {
    if (busy) return;
    mode = next;
    const register = mode === "register";
    root.querySelector("#auth-title").textContent = register
      ? "A fresh beginning."
      : "Welcome back.";
    root.querySelector("[data-intro]").textContent = register
      ? "Create your account and make room for your next idea."
      : "Log in to pick up where you left off.";
    root.querySelector("[data-submit]").textContent = register
      ? "Create account →"
      : "Log in →";
    root.querySelector("[data-note]").textContent = register
      ? "Start organizing your projects right after registration."
      : "Your projects. Your progress. Right where you left them.";
    for (const field of ["name", "confirm"]) {
      root
        .querySelector(`[data-${field}-field]`)
        .classList.toggle("d-none", !register);
      form.elements[field].disabled = !register;
      form.elements[field].required = register;
    }
    form.elements.password.autocomplete = register
      ? "new-password"
      : "current-password";
    form.elements.password.value = "";
    form.elements.confirm.value = "";
    buttons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode)),
    );
    root.querySelector("[data-error]").classList.add("d-none");
  }
  buttons.forEach(
    (button) => (button.onclick = () => setMode(button.dataset.mode)),
  );
  setMode(
    new URLSearchParams(location.search).get("mode") === "register"
      ? "register"
      : "login",
  );
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    root.querySelector("[data-error]").classList.add("d-none");
    const values = new FormData(form);
    if (
      mode === "register" &&
      values.get("password") !== values.get("confirm")
    ) {
      showError(root, new Error("Passwords do not match."));
      return;
    }
    busy = true;
    const submit = root.querySelector("[data-submit]");
    submit.textContent =
      mode === "register" ? "Creating account…" : "Logging in…";
    submit.disabled = true;
    buttons.forEach((button) => (button.disabled = true));
    try {
      if (mode === "register")
        await auth.register(
          values.get("name"),
          values.get("email"),
          values.get("password"),
        );
      else await auth.login(values.get("email"), values.get("password"));
      form.reset();
      if (active) await navigate("/dashboard", { replace: true });
    } catch (error) {
      if (active) showError(root, error);
    } finally {
      busy = false;
      submit.disabled = false;
      submit.textContent =
        mode === "register" ? "Create account →" : "Log in →";
      buttons.forEach((button) => (button.disabled = false));
    }
  };
  const user = await auth.currentUser();
  if (user && active) await navigate("/dashboard", { replace: true });
  return () => {
    active = false;
  };
}
