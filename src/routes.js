const routes = [
  { pattern: /^\/$/, load: () => import("./pages/home/home.js") },
  { pattern: /^\/login$/, load: () => import("./pages/login/login.js") },
  {
    pattern: /^\/dashboard$/,
    load: () => import("./pages/dashboard/dashboard.js"),
    protected: true,
  },
  {
    pattern: /^\/projects$/,
    load: () => import("./pages/projects/projects.js"),
    protected: true,
  },
  {
    pattern: /^\/projects\/([^/]+)\/tasks$/,
    load: () => import("./pages/tasks/tasks.js"),
    protected: true,
  },
  {
    pattern: /^\/account$/,
    load: () => import("./pages/account/account.js"),
    protected: true,
  },
];
export function matchRoute(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  for (const route of routes) {
    const match = path.match(route.pattern);
    if (match) {
      try {
        return {
          ...route,
          params: { id: match[1] ? decodeURIComponent(match[1]) : undefined },
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}
export function safeReturn(value, origin = location.origin) {
  try {
    const url = new URL(value || "/dashboard", origin);
    return url.origin === origin &&
      matchRoute(url.pathname) &&
      url.pathname !== "/login"
      ? url.pathname + url.search
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
