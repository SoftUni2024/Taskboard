import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/global.css";
import { mountHeader } from "./components/header/header.js";
import { mountFooter } from "./components/footer/footer.js";
import { startRouter } from "./router.js";

const app = document.querySelector("#app");
app.innerHTML =
  '<div id="header"></div><main id="page-content" tabindex="-1" class="container-xl py-4 py-md-5"></main><div id="footer"></div><div id="notifications" aria-live="polite"></div>';
mountHeader(document.querySelector("#header"));
mountFooter(document.querySelector("#footer"));
startRouter(document.querySelector("#page-content"));
