import template from "./tasks.html?raw";
import "./tasks.css";
import {
  requireUser,
  getBoard,
  api,
  showError,
  notify,
} from "../../services/api.js";
import { taskCard } from "../../components/task-card/task-card.js";
import { taskForm } from "../../components/task-form/task-form.js";
import { projectForm } from "../../components/project-form/project-form.js";
import { closeDialogs } from "../../components/dialog/dialog.js";
export { template };
export const title = "Project tasks";
export async function mount(root, { id }) {
  const userData = await requireUser();
  if (!userData) return;
  let data = await getBoard(id),
    busy = false,
    drag = null,
    active = true;
  const search = root.querySelector("[type=search]");
  async function refresh() {
    data = await getBoard(id);
    if (active) render();
    return data;
  }
  async function move(task, stage, before) {
    if (busy || task === before) return;
    busy = true;
    root.querySelector("[data-status]").textContent = "Saving changes…";
    try {
      await api("moveTask", { project: id, id: task, stage, before });
      await refresh();
      notify("Task moved");
    } catch (e) {
      showError(root, e);
    } finally {
      busy = false;
      root.querySelector("[data-status]").textContent =
        "● All changes saved to your workspace";
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
    columns.replaceChildren();
    data.stages.forEach((stageRecord, index) => {
      const stage = stageRecord.name;
      const list = data.tasks.filter((t) => t.stage === index),
        column = document.createElement("section");
      column.className = "board-column stage-" + index;
      column.setAttribute("aria-label", stage);
      column.innerHTML =
        '<div class="column-heading"><h2><span class="stage-dot"></span><span data-stage></span><small></small></h2><button class="btn btn-sm" aria-label="Add task to ' +
        stage +
        '">＋</button></div><div class="column-cards"></div><button class="column-add">＋ Add task</button>';
      column.querySelector("[data-stage]").textContent = stage;
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
          onDragStart(value) {
            drag = value;
          },
          onDragEnd() {
            drag = null;
            root
              .querySelectorAll(".drop-before")
              .forEach((el) => el.classList.remove("drop-before"));
          },
        });
        card.draggable = !search.value;
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
            ][index];
        cards.append(empty);
      }
      column.ondragover = (e) => {
        if (drag) {
          e.preventDefault();
          column.classList.add("drop-active");
        }
      };
      column.ondragleave = (e) => {
        if (!column.contains(e.relatedTarget))
          column.classList.remove("drop-active");
      };
      column.ondrop = (e) => {
        e.preventDefault();
        column.classList.remove("drop-active");
        const task = e.dataTransfer.getData("text/plain");
        if (task) move(task, index);
      };
      columns.append(column);
    });
  }
  search.oninput = render;
  root.querySelector("[data-add]").onclick = () => openTask();
  root.querySelector("[data-settings]").onclick = () =>
    projectForm(data.project, refresh);
  root.querySelector("[data-refresh]").onclick = () =>
    refresh()
      .then(() => notify("Board refreshed"))
      .catch((e) => showError(root, e));
  render();
  return () => {
    active = false;
    closeDialogs();
  };
}
