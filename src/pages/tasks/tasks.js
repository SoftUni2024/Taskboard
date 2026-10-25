import template from "./tasks.html?raw";
import "./tasks.css";
import { requireUser, getBoard, api, showError } from "../../services/api.js";
import { taskCard } from "../../components/task-card/task-card.js";
import { taskForm } from "../../components/task-form/task-form.js";
import { navigate } from "../../router.js";
import { closeDialogs } from "../../components/dialog/dialog.js";
import { mountBoardDrag } from "../../components/task-card/board-drag.js";
import { supabase } from "../../services/supabase.js";
import { watchProjectTasks } from "../../services/task-sync.js";
export { template };
export const title = "Project tasks";
export async function mount(root, { id }) {
  const userData = await requireUser();
  if (!userData) return;
  let data = await getBoard(id),
    busy = false,
    active = true;
  const search = root.querySelector("[type=search]");
  let refreshPromise = null,
    refreshAgain = false;
  async function refresh() {
    if (refreshPromise) {
      refreshAgain = true;
      return refreshPromise;
    }
    refreshPromise = (async () => {
      do {
        refreshAgain = false;
        const next = await getBoard(id);
        if (!active) return;
        data = next;
        render();
      } while (refreshAgain && active);
      return data;
    })();
    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }
  async function move(task, stage, before) {
    if (busy || task === before) return;
    busy = true;
    root
      .querySelectorAll(".task-card")
      .forEach((card) => (card.draggable = false));
    root.querySelector("[data-status]").textContent = "Saving changes…";
    let saved = false;
    try {
      await api("moveTask", { project: id, id: task, stage, before });
      await refresh();
      saved = true;
    } catch (e) {
      showError(root, e);
    } finally {
      busy = false;
      if (active) {
        root
          .querySelectorAll(".task-card")
          .forEach((card) => (card.draggable = !search.value));
        root.querySelector("[data-status]").textContent = saved
          ? "● All changes saved to your workspace"
          : "Changes could not be saved. Please try again.";
      }
    }
  }
  function openTask(task, stage = 0) {
    taskForm(id, task, stage, refresh, data.stages);
  }
  function render() {
    root.querySelector("[data-title]").textContent = data.project.title;
    root.querySelector("[data-description]").textContent =
      data.project.description || "A fresh space for your next big thing.";
    root.querySelector("[data-settings]").hidden =
      data.project.owner !== data.user.id;
    root.querySelector("[data-count]").textContent = data.tasks.length;
    const columns = root.querySelector("[data-columns]");
    const scroll = { top: columns.scrollTop, left: columns.scrollLeft };
    const focused = columns.contains(document.activeElement)
      ? document.activeElement.closest(".task-card")?.dataset.taskId
      : null;
    columns.replaceChildren();
    data.stages.forEach((stageRecord, index) => {
      const stage = stageRecord.name;
      const list = data.tasks.filter((t) => t.stage === index),
        column = document.createElement("section");
      column.className = "board-column stage-" + index;
      column.setAttribute("aria-label", stage);
      column.innerHTML =
        '<div class="column-heading"><h2><span class="stage-dot"></span><span data-stage></span><small></small></h2><button type="button" class="btn btn-sm">＋</button></div><div class="column-cards"></div><button type="button" class="column-add"><span aria-hidden="true">＋</span><span>Add New Task</span></button>';
      column
        .querySelector(".column-heading button")
        .setAttribute("aria-label", `Add task to ${stage}`);
      column.querySelector("[data-stage]").textContent = stage;
      column
        .querySelector(".column-add")
        .setAttribute("aria-label", `Add New Task to ${stage}`);
      column.querySelector("h2 small").textContent = list.length;
      column
        .querySelectorAll("button")
        .forEach((b) => (b.onclick = () => openTask(null, index)));
      const cards = column.querySelector(".column-cards");
      list.forEach((task, i) => {
        if (!task.title.toLowerCase().includes(search.value.toLowerCase()))
          return;
        const card = taskCard(task, {
          onOpen: openTask,
          onMove: move,
          index: i,
          list,
        });
        card.draggable = !search.value && !busy;
        cards.append(card);
      });
      if (!cards.childElementCount) {
        const empty = document.createElement("p");
        empty.className = "column-empty";
        empty.textContent = search.value
          ? "No matching tasks."
          : [
              "Every great project starts here.",
              "Ready when you are.",
              "Good things take a few steps.",
            ][index] || "No tasks in this stage yet.";
        cards.append(empty);
      }
      column.dataset.stage = index;
      columns.append(column);
    });
    columns.scrollTop = scroll.top;
    columns.scrollLeft = scroll.left;
    if (focused)
      [...columns.querySelectorAll(".task-card")]
        .find((card) => card.dataset.taskId === focused)
        ?.focus({ preventScroll: true });
  }
  search.oninput = render;
  root.querySelector("[data-add]").onclick = () => openTask();
  root.querySelector("[data-settings]").onclick = () =>
    navigate(`/project/${id}/edit`);
  root.querySelector("[data-refresh]").onclick = () =>
    refresh().catch((e) => showError(root, e));
  const stopDrag = mountBoardDrag(root.querySelector("[data-columns]"), {
    canDrag: () => active && !busy && !search.value,
    onMove: move,
  });
  render();
  const stopSync = watchProjectTasks(supabase, id, {
    refresh,
    canRefresh: () => active && !busy && !root.querySelector(".dragging"),
    onError: (error) => {
      if (active) showError(root, error);
    },
    onStatus: (status) => {
      if (active)
        root.querySelector("[data-sync]").textContent =
          status === "SUBSCRIBED"
            ? "● Live updates on"
            : "Reconnecting live updates…";
    },
  });
  return () => {
    stopSync();
    stopDrag();
    active = false;
    closeDialogs();
  };
}
