import template from "./task-card.html?raw";
import "./task-card.css";
import { textFromHtml } from "../../services/api.js";
export function taskCard(task, { onOpen, onMove, index, list }) {
  const holder = document.createElement("div");
  holder.innerHTML = template;
  const card = holder.firstElementChild;
  card.dataset.taskId = task.id;
  card.setAttribute("aria-label", "Open task: " + task.title);
  card.querySelector("h3").textContent = task.title;
  const tag = card.querySelector(".task-tag");
  tag.textContent = task.done
    ? "Completed"
    : task.stage_name === "In Progress"
      ? "In motion"
      : task.stage_name && task.stage_name !== "Not Started"
        ? task.stage_name
        : "To do";
  tag.classList.add(
    "tag-" + (task.done ? 2 : task.stage_name === "In Progress" ? 1 : 0),
  );
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
  return card;
}
