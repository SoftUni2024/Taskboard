import template from "./admin-users.html?raw";
import "./admin-users.css";
import {
  requireAdmin,
  listAdminUsers,
  updateAdminUser,
  deleteAdminUser,
} from "../../services/admin.js";
import { adminNav } from "../../components/admin-nav/admin-nav.js";
import {
  openDialog,
  confirmDelete,
  closeDialogs,
} from "../../components/dialog/dialog.js";
import { notify, notifyError } from "../../services/api.js";
export { template };
export const title = "Admin · Users";
export async function mount(root) {
  const current = await requireAdmin();
  if (!current) return;
  adminNav(root.querySelector("[data-admin-nav]"));
  let offset = 0,
    active = true,
    version = 0,
    timer;
  const search = root.querySelector("input");
  async function load() {
    const v = ++version,
      users = await listAdminUsers(search.value.trim(), offset);
    if (!active || v !== version) return;
    const body = root.querySelector("tbody");
    body.replaceChildren();
    for (const user of users) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td></td><td></td><td></td><td class="admin-actions"><button type="button" class="btn btn-link" data-view>View</button><button type="button" class="btn btn-link" data-edit>Edit</button><button type="button" class="btn btn-link text-danger" data-delete>Delete</button></td>';
      tr.children[0].textContent = user.name;
      tr.children[1].textContent = user.email;
      tr.children[2].textContent = user.is_admin ? "Admin" : "User";
      tr.querySelector("[data-view]").onclick = () =>
        openDialog({
          title: "User details",
          body: '<dl class="admin-user-details"><dt>Name</dt><dd data-name></dd><dt>Email</dt><dd data-email></dd><dt>ID</dt><dd class="admin-id" data-id></dd><dt>Role</dt><dd data-role></dd><dt>Registered</dt><dd data-created></dd></dl>',
          onMount(dialog) {
            for (const [key, value] of Object.entries({
              name: user.name,
              email: user.email,
              id: user.id,
              role: user.is_admin ? "Admin" : "User",
              created: new Date(user.created_at).toLocaleString(),
            }))
              dialog.querySelector("[data-" + key + "]").textContent = value;
          },
        });
      tr.querySelector("[data-edit]").onclick = () =>
        openDialog({
          title: "Edit user",
          body: '<label class="form-label" for="admin-user-name">Display name</label><input id="admin-user-name" name="name" class="form-control mb-3" maxlength="80" required><label class="form-label" for="admin-user-email">Email</label><input id="admin-user-email" name="email" type="email" class="form-control mb-3" required><label class="form-label" for="admin-user-password">New password (optional)</label><input id="admin-user-password" name="password" type="password" class="form-control mb-3" minlength="12" autocomplete="new-password"><label class="form-label" for="admin-user-role">Role</label><select id="admin-user-role" name="role" class="form-select"><option value="user">User</option><option value="admin">Admin</option></select>',
          onMount(dialog) {
            dialog.querySelector("[name=name]").value = user.name;
            dialog.querySelector("[name=email]").value = user.email;
            dialog.querySelector("select").value = user.is_admin
              ? "admin"
              : "user";
            dialog.querySelector("select").disabled = user.id === current.id;
          },
          async onSubmit(form) {
            await updateAdminUser({
              id: user.id,
              name: form.get("name"),
              email: form.get("email"),
              password: form.get("password"),
              is_admin:
                user.id === current.id
                  ? user.is_admin
                  : form.get("role") === "admin",
            });
            notify("User updated");
            await load();
          },
        });
      const remove = tr.querySelector("[data-delete]");
      remove.disabled = user.id === current.id || user.is_admin;
      remove.onclick = () =>
        confirmDelete(
          "Delete user?",
          `Permanently delete ${user.email}? Their owned projects, stages, tasks, memberships, and uploaded files will be deleted.`,
          async () => {
            await deleteAdminUser(user.id);
            notify("User deleted");
            await load();
          },
        );
      body.append(tr);
    }
    if (!users.length)
      body.innerHTML = '<tr><td colspan="4">No users found.</td></tr>';
    root.querySelector("[data-prev]").disabled = offset === 0;
    root.querySelector("[data-next]").disabled = users.length < 50;
    root.querySelector("[data-page]").textContent = `Page ${offset / 50 + 1}`;
  }
  const reload = () => load().catch(notifyError);
  search.oninput = () => {
    clearTimeout(timer);
    offset = 0;
    timer = setTimeout(reload, 200);
  };
  root.querySelector("[data-prev]").onclick = () => {
    offset = Math.max(0, offset - 50);
    reload();
  };
  root.querySelector("[data-next]").onclick = () => {
    offset += 50;
    reload();
  };
  await load();
  return () => {
    active = false;
    clearTimeout(timer);
    closeDialogs();
  };
}
