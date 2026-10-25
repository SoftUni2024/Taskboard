import { auth } from "./auth.js";
import { navigate } from "../router.js";
export async function logoutFromApp() {
  await auth.logout();
  await navigate("/", { replace: true });
}
