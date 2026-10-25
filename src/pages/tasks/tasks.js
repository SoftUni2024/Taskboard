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
import {
  loadPagedBoard,
  nextUnloadedTask,
  TASK_BATCH_SIZE,
} from "../../services/paged-data.js";
export { template };
export const title = "Project tasks";
export async function mount(root, { id }) {
  root.querySelector("[data-labels-page]").href = "/project/" + id + "/labels";
  const userData = await requireUser(false);
  if (!userData) return;
  let limits = {},
    loadingMore = false,
    observers = [],
    searchTimer;
  let data = await loadPagedBoard(id, userData.user, limits),
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
        const next = await loadPagedBoard(
          id,
          userData.user,
          limits,
          search.value,
        );
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
      if (!before && !search.value) {
        const loaded = data.tasks.filter((t) => t.stage === stage).length;
        if (loaded < data.counts[stage]) {
          before = await nextUnloadedTask(id, data.stages[stage].id, loaded);
          if (data.tasks.find((t) => t.id === task)?.stage !== stage)
            limits[data.stages[stage].id] =
              (limits[data.stages[stage].id] || TASK_BATCH_SIZE) +
              TASK_BATCH_SIZE;
        }
      }
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
    root.querySelector("[data-count]").textContent = data.total;
    const columns = root.querySelector("[data-columns]");
    const scroll = { top: columns.scrollTop, left: columns.scrollLeft };
    const focused = columns.contains(document.activeElement)
      ? document.activeElement.closest(".task-card")?.dataset.taskId
      : null;
    const columnScroll = Object.fromEntries(
      [...columns.children].map((column) => [
        column.dataset.stage,
        column.querySelector(".column-cards")?.scrollTop || 0,
      ]),
    );
    observers.forEach((observer) => observer.disconnect());
    observers = [];
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
      column.querySelector("h2 small").textContent = data.counts[index];
      column
        .querySelectorAll("button")
        .forEach((b) => (b.onclick = () => openTask(null, index)));
      const cards = column.querySelector(".column-cards");
      cards.tabIndex = 0;
      cards.setAttribute("role", "region");
      cards.setAttribute("aria-label", stage + " tasks");
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
        if (search.value)
          card
            .querySelectorAll("button")
            .forEach((button) => (button.disabled = true));
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
      if (list.length < data.counts[index]) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "btn btn-outline-primary btn-sm task-load-more";
        more.textContent = `Load more tasks (${list.length} of ${data.counts[index]})`;
        more.setAttribute("aria-label", `Load more ${stage} tasks`);
        more.onclick = () => loadMore(stageRecord.id);
        cards.append(more);
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting))
              loadMore(stageRecord.id);
          },
          { root: cards, rootMargin: "120px" },
        );
        observer.observe(more);
        observers.push(observer);
      }
      column.dataset.stage = index;
      columns.append(column);
      cards.scrollTop = columnScroll[index] || 0;
    });
    columns.scrollTop = scroll.top;
    columns.scrollLeft = scroll.left;
    if (focused)
      [...columns.querySelectorAll(".task-card")]
        .find((card) => card.dataset.taskId === focused)
        ?.focus({ preventScroll: true });
  }
  async function loadMore(stage) {
    if (loadingMore || busy || root.querySelector(".dragging")) return;
    loadingMore = true;
    const previous = limits[stage] || TASK_BATCH_SIZE;
    limits[stage] = previous + TASK_BATCH_SIZE;
    try {
      await refresh();
    } catch (error) {
      limits[stage] = previous;
      showError(root, error);
    } finally {
      loadingMore = false;
    }
  }
  search.oninput = () => {
    clearTimeout(searchTimer);
    limits = {};
    searchTimer = setTimeout(
      () => refresh().catch((error) => showError(root, error)),
      250,
    );
  };
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
    canRefresh: () =>
      active && !busy && !loadingMore && !root.querySelector(".dragging"),
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
    clearTimeout(searchTimer);
    observers.forEach((observer) => observer.disconnect());
    stopSync();
    stopDrag();
    active = false;
    closeDialogs();
  };
}
