import template from "./member-picker.html?raw";
import "./member-picker.css";
import { openDialog } from "../dialog/dialog.js";
import {
  searchProjectUsers,
  addProjectUser,
} from "../../services/project-members.js";
import { notify, notifyError } from "../../services/api.js";
export function memberPicker(project, onChanged) {
  return openDialog({
    title: "Add user to project",
    body: template,
    onMount(root) {
      const search = root.querySelector("input"),
        list = root.querySelector("ul"),
        more = root.querySelector("[data-more]"),
        status = root.querySelector("[data-picker-status]");
      root.querySelector(
        "[data-bs-dismiss].btn-outline-secondary",
      ).textContent = "Close";
      let active = true,
        version = 0,
        offset = 0,
        rows = [],
        timer,
        busy = false;
      root.addEventListener(
        "hidden.bs.modal",
        () => {
          active = false;
          clearTimeout(timer);
          version++;
        },
        { once: true },
      );
      function render() {
        list.replaceChildren();
        rows.forEach((user) => {
          const li = document.createElement("li"),
            details = document.createElement("div"),
            name = document.createElement("strong"),
            email = document.createElement("small"),
            button = document.createElement("button");
          name.textContent = user.name;
          email.textContent = user.email;
          details.append(name, email);
          button.type = "button";
          button.className = "btn btn-outline-primary btn-sm";
          button.textContent = user.is_assigned ? "Assigned" : "Add user";
          button.disabled = user.is_assigned || busy;
          button.setAttribute(
            "aria-label",
            `${user.is_assigned ? "Assigned" : "Add"} ${user.email}`,
          );
          button.onclick = async () => {
            if (busy) return;
            busy = true;
            render();
            try {
              await addProjectUser(project, user.id);
              user.is_assigned = true;
              notify("User assigned to project");
              await onChanged();
            } catch (error) {
              notifyError(error);
            } finally {
              busy = false;
              if (active) render();
            }
          };
          li.append(details, button);
          list.append(li);
        });
      }
      async function load(reset = true) {
        const current = ++version;
        if (reset) {
          offset = 0;
          rows = [];
          render();
        }
        status.textContent = "Loading users…";
        more.disabled = true;
        try {
          const users = await searchProjectUsers(
            project,
            search.value.trim(),
            offset,
          );
          if (!active || current !== version) return;
          rows.push(...users);
          offset += users.length;
          more.hidden = users.length < 50;
          status.textContent = rows.length
            ? `${rows.length} ${rows.length === 1 ? "user" : "users"} shown`
            : "No users match your search.";
          render();
        } catch (error) {
          if (active && current === version) {
            status.textContent = "Could not load users. Search again to retry.";
            notifyError(error);
          }
        } finally {
          if (active && current === version) more.disabled = false;
        }
      }
      search.oninput = () => {
        clearTimeout(timer);
        version++;
        timer = setTimeout(() => load(), 200);
      };
      more.onclick = () => load(false);
      load();
    },
  });
}
