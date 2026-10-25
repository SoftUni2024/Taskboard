import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST")
    return response({ error: "Method not allowed" }, 405);
  try {
    const token = req.headers.get("Authorization");
    if (!token?.startsWith("Bearer "))
      return response({ error: "Sign in required." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: token } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await caller.auth.getUser();
    if (authError || !user) return response({ error: "Invalid session." }, 401);
    const { data: isAdmin, error: roleError } = await caller.rpc("is_admin");
    if (roleError || !isAdmin)
      return response({ error: "Administrator access required." }, 403);
    const body = await req.json();
    if (!/^[0-9a-f-]{36}$/i.test(body.id || ""))
      return response({ error: "Invalid user ID." }, 400);
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    if (body.action === "update") {
      const name = String(body.name || "").trim(),
        email = String(body.email || "").trim();
      if (
        !name ||
        name.length > 80 ||
        !email.includes("@") ||
        email.length > 320
      )
        return response(
          { error: "Enter a name (1–80 characters) and a valid email." },
          400,
        );
      if (body.password && String(body.password).length < 12)
        return response(
          { error: "New passwords need at least 12 characters." },
          400,
        );
      const { data: existing, error: lookup } =
        await admin.auth.admin.getUserById(body.id);
      if (lookup) throw lookup;
      // Never modify authorization through user-editable metadata.
      const { data: directory, error: directoryError } = await caller.rpc(
        "admin_list_users",
        { p_search: existing.user.email || "" },
      );
      if (directoryError) throw directoryError;
      const old = directory.find((row: any) => row.id === body.id);
      if (!old) return response({ error: "User not found." }, 404);
      if (body.id === user.id && Boolean(body.is_admin) !== old.is_admin)
        return response(
          { error: "You cannot change your own admin role." },
          400,
        );
      const { error } = await admin.auth.admin.updateUserById(body.id, {
        email,
        email_confirm: true,
        user_metadata: { ...existing.user.user_metadata, display_name: name },
        ...(body.password ? { password: String(body.password) } : {}),
      });
      if (error) throw error;
      if (Boolean(body.is_admin) !== old.is_admin) {
        const { error } = await caller.rpc("admin_set_role", {
          p_user: body.id,
          p_admin: Boolean(body.is_admin),
        });
        if (error) throw error;
      }
      return response({ ok: true });
    }
    if (body.action === "delete") {
      // This checked RPC also refuses self-deletion and deletion of an administrator.
      for (;;) {
        const { data: files, error } = await caller.rpc("admin_user_files", {
          p_user: body.id,
        });
        if (error) throw error;
        if (!files.length) break;
        const { error: removeError } = await admin.storage
          .from("task-attachments")
          .remove(files.map((f: any) => f.path));
        if (removeError) throw removeError;
      }
      const { error } = await admin.auth.admin.deleteUser(body.id);
      if (error) throw error;
      return response({ ok: true });
    }
    return response({ error: "Unsupported action." }, 400);
  } catch (error) {
    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : String((error as any)?.message || "Request failed."),
      },
      400,
    );
  }
});
