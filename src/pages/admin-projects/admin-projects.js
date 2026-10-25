import template from "./admin-projects.html?raw";
import "./admin-projects.css";
import { requireAdmin, result } from "../../services/admin.js";
import { supabase } from "../../services/supabase.js";
import { adminNav } from "../../components/admin-nav/admin-nav.js";
import {
  editAdminProject,
  deleteAdminProject,
} from "../../services/admin-project-dialogs.js";
import { closeDialogs } from "../../components/dialog/dialog.js";
import { notifyError } from "../../services/api.js";
export { template };
export const title = "Admin · Projects";
export async function mount(root) {
  if (!(await requireAdmin())) return;
  adminNav(root.querySelector("[data-admin-nav]"));
  let offset = 0,
    active = true,
    version = 0,
    timer;
  const search = root.querySelector("input");
  async function load() {
    const v = ++version;
    let query = supabase
      .from("projects")
      .select("*,tasks(count),project_stages(count)")
      .order("title")
      .order("id")
      .range(offset, offset + 49);
    if (search.value.trim())
      query = query.ilike("title", "%" + search.value.trim() + "%");
    const rows = await result(query);
    if (!active || v !== version) return;
    const body = root.querySelector("tbody");
    body.replaceChildren();
    for (const project of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td><a data-view data-link></a></td><td class="admin-id"></td><td></td><td></td><td class="admin-actions"><button type="button" class="btn btn-link" data-edit>Edit</button><button type="button" class="btn btn-link text-danger" data-delete>Delete</button></td>';
      tr.querySelector("a").textContent = project.title;
      tr.querySelector("a").href = `/admin/projects/${project.id}`;
      tr.children[1].textContent = project.owner_id;
      tr.children[2].textContent = project.project_stages[0].count;
      tr.children[3].textContent = project.tasks[0].count;
      tr.querySelector("[data-edit]").onclick = () =>
        editAdminProject(project, load);
      tr.querySelector("[data-delete]").onclick = () =>
        deleteAdminProject(project, load);
      body.append(tr);
    }
    if (!rows.length) {
      const tr = document.createElement("tr"),
        td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "No projects found.";
      tr.append(td);
      body.append(tr);
    }
    root.querySelector("[data-prev]").disabled = offset === 0;
    root.querySelector("[data-next]").disabled = rows.length < 50;
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
