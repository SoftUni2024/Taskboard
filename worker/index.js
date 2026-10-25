export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/board") {
      return Response.json(
        { error: "This app now uses Supabase Auth and its RLS-protected database." },
        { status: 410 },
      );
    }
    if (url.pathname.startsWith("/api/"))
      return Response.json({ error: "Endpoint not found" }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
