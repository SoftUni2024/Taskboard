import template from "./task-card.html?raw";
import "./task-card.css";
import { textFromHtml } from "../../services/api.js";
export function taskCard(
  task,
  { onOpen, onMove, index, list, onDragStart, onDragEnd },
) {
  const holder = document.createElement("div");
  holder.innerHTML = template;
  const card = holder.firstElementChild;
  card.dataset.taskId = task.id;
  card.setAttribute("aria-label", "Open task: " + task.title);
  card.querySelector("h3").textContent = task.title;
  const tag = card.querySelector(".task-tag");
  tag.textContent = ["To do", "In motion", "Completed"][task.stage];
  tag.classList.add("tag-" + task.stage);
  card.querySelector("[data-excerpt]").textContent = textFromHtml(
    task.description,
  );
  card.querySelector("[data-description-icon]").textContent = task.description
    ? "≡"
    : "";
  card.querySelector("[data-task-id]").textContent =
    "#" + task.id.slice(0, 4).toUpperCase();
  card.onclick = (e) => {
    if (!e.target.closest("button")) onOpen(task);
  };
  card.onkeydown = (e) => {
    if (e.target === card && ["Enter", " "].includes(e.key)) {
      e.preventDefault();
      onOpen(task);
    }
  };
  const up = card.querySelector("[data-up]"),
    down = card.querySelector("[data-down]");
  up.disabled = index === 0;
  down.disabled = index === list.length - 1;
  up.onclick = () => onMove(task.id, task.stage, list[index - 1]?.id);
  down.onclick = () => onMove(task.id, task.stage, list[index + 2]?.id);
  card.ondragstart = (e) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
    onDragStart(task.id);
  };
  card.ondragend = () => {
    card.classList.remove("dragging");
    onDragEnd();
  };
  card.ondragover = (e) => {
    e.preventDefault();
    e.stopPropagation();
    card.classList.add("drop-before");
  };
  card.ondragleave = () => card.classList.remove("drop-before");
  card.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    card.classList.remove("drop-before");
    const id = e.dataTransfer.getData("text/plain");
    if (id && id !== task.id) onMove(id, task.stage, task.id);
  };
  return card;
}
