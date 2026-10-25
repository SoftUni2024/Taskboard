import { refreshHeader } from "./components/header/header.js";
import { matchRoute } from "./routes.js";
export { safeReturn } from "./routes.js";
let renderRoute = () => {},
  dispose = () => {},
  generation = 0;
export function navigate(path, { replace = false } = {}) {
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin) return;
  history[replace ? "replaceState" : "pushState"]({}, "", url);
  return renderRoute();
}
export function startRouter(outlet) {
  renderRoute = async () => {
    const version = ++generation;
    dispose();
    dispose = () => {};
    const route = matchRoute(location.pathname);
    outlet.innerHTML =
      '<div class="page-loading" role="status"><span class="spinner-border spinner-border-sm me-2"></span>Getting your workspace ready…</div>';
    try {
      const page = route
        ? await route.load()
        : await import("./pages/not-found/not-found.js");
      if (version !== generation) return;
      document.title = page.title + " · Task Board";
      outlet.innerHTML = page.template;
      const cleanup = await page.mount(outlet, route?.params || {});
      if (version !== generation) {
        cleanup?.();
        return;
      }
      dispose = cleanup || (() => {});
      refreshHeader();
      outlet.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } catch (error) {
      if (version === generation) {
        outlet.replaceChildren();
        const message = document.createElement("div");
        message.className = "alert alert-danger";
        message.textContent = error.message;
        outlet.append(message);
        const retry = document.createElement("button");
        retry.className = "btn btn-outline-primary";
        retry.textContent = "Try again";
        retry.onclick = renderRoute;
        outlet.append(retry);
      }
    }
  };
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[data-link]");
    if (
      !anchor ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      anchor.target ||
      anchor.hasAttribute("download")
    )
      return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });
  window.addEventListener("popstate", renderRoute);
  renderRoute();
}
