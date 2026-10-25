export function localDay(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
}
export function deadlineValue(value) {
  if(!value) return null;
  const day=String(value);
  const date=new Date(day+"T12:00:00Z");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number(day.slice(0,4)) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==day)
    throw new Error("Choose a valid deadline date.");
  return day;
}
export function deadlineText(task, today=localDay()) {
  if(!task.due_on) return "";
  return (task.done ? "Completed · due " : task.due_on<today ? "Overdue · " : task.due_on===today ? "Due today · " : "Due ") + task.due_on;
}
