import template from "./login.html?raw";
import "./login.css";
import { safeReturn, navigate } from "../../router.js";
import { getBoard } from "../../services/api.js";
export { template };
export const title = "Sign in";
export async function mount(root) {
  const next = safeReturn(
    new URLSearchParams(location.search).get("return_to"),
  );
  root.querySelector("[data-signin]").href =
    "/signin-with-chatgpt?return_to=" + encodeURIComponent(next);
  const { user } = await getBoard();
  if (user) await navigate(next, { replace: true });
}
