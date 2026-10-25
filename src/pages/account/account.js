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
