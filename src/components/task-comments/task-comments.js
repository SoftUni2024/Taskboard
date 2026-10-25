import template from "./task-comments.html?raw";
import "./task-comments.css";
import {
  listComments,
  addComment,
  editComment,
  deleteComment,
} from "../../services/comments.js";
import { notify, notifyError } from "../../services/api.js";
import { supabase } from "../../services/supabase.js";
import { watchProjectTasks } from "../../services/task-sync.js";
export function mountTaskComments(host, project, task) {
  host.innerHTML = template;
  const draft = host.querySelector("[data-comment-draft]"),
    post = host.querySelector("[data-post-comment]"),
    list = host.querySelector("ol"),
    status = host.querySelector("[data-comment-status]"),
    older = host.querySelector("[data-older-comments]");
  let active = true,
    busy = false,
    editing = null,
    editDraft = "",
    limit = 30,
    rows = [],
    version = 0;
  draft.oninput = () => {
    host.querySelector("[data-comment-count]").textContent =
      `${draft.value.length} / 4000`;
  };
  if (!task) {
    draft.disabled = true;
    post.disabled = true;
    host.querySelector("[data-comment-hint]").textContent =
      "Create this task first, then open it to start a discussion.";
    return () => {};
  }
  async function refresh() {
    const v = ++version;
    const result = await listComments(task.id, limit);
    if (!active || v !== version) return;
    rows = result.comments;
    older.hidden = !result.hasMore;
    status.textContent = rows.length
      ? ""
      : "No comments yet. Start the discussion.";
    render();
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    draft.disabled = true;
    post.disabled = true;
    older.disabled = true;
    list
      .querySelectorAll("button")
      .forEach((button) => (button.disabled = true));
    try {
      await action();
    } catch (error) {
      notifyError(error);
    } finally {
      busy = false;
      if (active) {
        draft.disabled = false;
        post.disabled = false;
        older.disabled = false;
        render();
      }
    }
  }
  function render() {
    post.disabled = busy || editing !== null;
    older.disabled = busy || editing !== null;
    const scroll = list.scrollTop;
    list.replaceChildren();
    for (const comment of rows) {
      const item = document.createElement("li");
      item.innerHTML =
        '<div class="comment-meta"><strong data-author></strong><span data-time></span></div><p class="comment-body"></p><div class="comment-actions"></div>';
      item.querySelector("[data-author]").textContent = comment.author_name;
      item.querySelector("[data-time]").textContent =
        new Date(comment.created_at).toLocaleString() +
        (comment.updated_at !== comment.created_at ? " · edited" : "");
      item.querySelector(".comment-body").textContent = comment.body;
      const actions = item.querySelector(".comment-actions");
      if (comment.can_edit) {
        const edit = document.createElement("button"),
          remove = document.createElement("button");
        edit.type = remove.type = "button";
        edit.className = "btn btn-link p-0";
        remove.className = "btn btn-link text-danger p-0";
        edit.textContent = "Edit";
        remove.textContent = "Delete";
        edit.disabled = remove.disabled = busy || editing !== null;
        edit.onclick = () => {
          editing = comment.id;
          editDraft = comment.body;
          render();
        };
        remove.onclick = () => {
          remove.hidden = true;
          edit.hidden = true;
          const text = document.createElement("span"),
            yes = document.createElement("button"),
            no = document.createElement("button");
          text.textContent = "Delete this comment?";
          yes.type = no.type = "button";
          yes.className = "btn btn-danger btn-sm";
          no.className = "btn btn-link btn-sm";
          yes.textContent = "Delete comment";
          no.textContent = "Cancel";
          yes.onclick = () =>
            run(async () => {
              await deleteComment(comment.id);
              notify("Comment deleted");
              await refresh();
            });
          no.onclick = render;
          actions.append(text, yes, no);
        };
        actions.append(edit, remove);
        if (editing === comment.id) {
          const area = document.createElement("textarea");
          area.className = "form-control";
          area.rows = 3;
          area.maxLength = 4000;
          area.setAttribute("aria-label", "Edit comment");
          area.value = editDraft;
          area.oninput = () => {
            editDraft = area.value;
          };
          item.querySelector(".comment-body").replaceWith(area);
          actions.replaceChildren();
          const save = document.createElement("button"),
            cancel = document.createElement("button");
          save.type = cancel.type = "button";
          save.className = "btn btn-primary btn-sm";
          cancel.className = "btn btn-link btn-sm";
          save.textContent = "Save comment";
          cancel.textContent = "Cancel edit";
          save.onclick = () =>
            run(async () => {
              await editComment(comment.id, editDraft);
              editing = null;
              notify("Comment updated");
              await refresh();
            });
          cancel.onclick = () => {
            editing = null;
            render();
          };
          actions.append(save, cancel);
        }
      }
      list.append(item);
    }
    list.scrollTop = scroll;
  }
  post.onclick = () =>
    run(async () => {
      await addComment(task.id, draft.value);
      draft.value = "";
      draft.oninput();
      notify("Comment posted");
      await refresh();
    });
  older.onclick = () => {
    if (busy || editing) return;
    limit += 30;
    run(refresh);
  };
  status.textContent = "Loading discussion…";
  refresh().catch((error) => {
    if (active) {
      status.textContent = "Could not load comments. Reopen the task to retry.";
      notifyError(error);
    }
  });
  const stopSync = watchProjectTasks(supabase, project, {
    refresh,
    canRefresh: () => active && !busy && !editing,
    onError: (error) => {
      if (active) notifyError(error);
    },
  });
  return () => {
    active = false;
    version++;
    stopSync();
    draft.oninput = null;
    post.onclick = null;
  };
}
