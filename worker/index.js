import { GET, POST } from "../server/board.js";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/board") {
      if (request.method === "GET") return GET(request, env);
      if (request.method === "POST") return POST(request, env);
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "GET, POST" } },
      );
    }
    if (url.pathname.startsWith("/api/"))
      return Response.json({ error: "Endpoint not found" }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
