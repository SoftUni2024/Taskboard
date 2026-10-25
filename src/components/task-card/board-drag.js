export function beforeTask(cards, pointerY) {
  return (
    cards.find((card) => pointerY < card.top + card.height / 2)?.id ?? null
  );
}
export function mountBoardDrag(board, { canDrag, onMove }) {
  let dragged = null,
    target = null,
    point = null,
    frame = null;
  const marker = document.createElement("div");
  marker.className = "task-drop-placeholder";
  marker.setAttribute("aria-hidden", "true");
  function clear() {
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    point = null;
    target = null;
    dragged = null;
    marker.remove();
    board
      .querySelectorAll(".dragging,.drop-active")
      .forEach((el) => el.classList.remove("dragging", "drop-active"));
  }
  function preview(x, y) {
    const column = document.elementFromPoint(x, y)?.closest(".board-column");
    board
      .querySelectorAll(".drop-active")
      .forEach((el) => el.classList.remove("drop-active"));
    if (!column || !board.contains(column)) {
      target = null;
      marker.remove();
      return;
    }
    marker.remove();
    const cards = [...column.querySelectorAll(".task-card")].filter(
      (el) => el.dataset.taskId !== dragged,
    );
    const before = beforeTask(
      cards.map((el) => ({
        id: el.dataset.taskId,
        top: el.getBoundingClientRect().top,
        height: el.getBoundingClientRect().height,
      })),
      y,
    );
    target = { stage: Number(column.dataset.stage), before };
    const next = cards.find((el) => el.dataset.taskId === before) || null;
    const list = column.querySelector(".column-cards");
    if (marker.parentElement !== list || marker.nextElementSibling !== next)
      list.insertBefore(marker, next);
    column.classList.add("drop-active");
  }
  function tick() {
    if (!dragged || !point) {
      frame = null;
      return;
    }
    const rect = board.getBoundingClientRect();
    const speed = (p, min, max) => (p < min + 55 ? -12 : p > max - 55 ? 12 : 0);
    board.scrollBy(
      speed(point.x, rect.left, rect.right),
      speed(point.y, rect.top, rect.bottom),
    );
    preview(point.x, point.y);
    frame = requestAnimationFrame(tick);
  }
  function start(event) {
    const card = event.target.closest(".task-card");
    if (!card || !canDrag() || event.target.closest("button")) {
      event.preventDefault();
      return;
    }
    dragged = card.dataset.taskId;
    event.dataTransfer.setData("text/plain", dragged);
    event.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  }
  function over(event) {
    if (!dragged || !canDrag()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    point = { x: event.clientX, y: event.clientY };
    preview(point.x, point.y);
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function drop(event) {
    if (!dragged) return;
    event.preventDefault();
    const task = dragged,
      destination = target;
    clear();
    if (destination) onMove(task, destination.stage, destination.before);
  }
  function leave(event) {
    if (!board.contains(event.relatedTarget)) {
      target = null;
      point = null;
      marker.remove();
      board
        .querySelectorAll(".drop-active")
        .forEach((el) => el.classList.remove("drop-active"));
    }
  }
  board.addEventListener("dragstart", start);
  board.addEventListener("dragover", over);
  board.addEventListener("drop", drop);
  board.addEventListener("dragleave", leave);
  document.addEventListener("dragend", clear);
  return () => {
    clear();
    board.removeEventListener("dragstart", start);
    board.removeEventListener("dragover", over);
    board.removeEventListener("drop", drop);
    board.removeEventListener("dragleave", leave);
    document.removeEventListener("dragend", clear);
  };
}
