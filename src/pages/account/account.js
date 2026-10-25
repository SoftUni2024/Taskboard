import { logoutFromApp } from "../../services/auth-navigation.js";
import template from "./account.html?raw";
import "./account.css";
import { requireUser, api, notify, showError } from "../../services/api.js";
import { refreshHeader } from "../../components/header/header.js";
export { template };
export const title = "Account";
export async function mount(root) {
  const data = await requireUser();
  if (!data) return;
  root.querySelector("[name=name]").value = data.user.name;
  root.querySelector("#profile-email").value = data.user.email;
  root.querySelector("[data-logout]").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await logoutFromApp();
    } catch (error) {
      showError(root, error);
      button.disabled = false;
    }
  };
  root.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const button = root.querySelector("button");
    button.disabled = true;
    try {
      await api("profile", { name: new FormData(e.currentTarget).get("name") });
      notify("Profile updated");
      refreshHeader();
    } catch (error) {
      showError(root, error);
    } finally {
      button.disabled = false;
    }
  };
}
