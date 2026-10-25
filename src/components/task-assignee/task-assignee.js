import template from "./task-assignee.html?raw";
import "./task-assignee.css";
import { taskAssignees } from "../../services/task-assignees.js";
import { notifyError } from "../../services/api.js";
export function mountTaskAssignee(host, project, task) {
  host.innerHTML = template;
  const select = host.querySelector("select");
  let loaded = false, active = true;
  taskAssignees(project).then(people => {
    if (!active) return;
    const options = [{ id: "", name: "Unassigned" }, ...people];
    select.replaceChildren(...options.map(person => {
      const option = document.createElement("option");
      option.value = person.id;
      option.textContent = person.name;
      return option;
    }));
    select.value = people.some(person => person.id === task?.assignee_id) ? task.assignee_id : "";
    select.disabled = false;
    loaded = true;
  }).catch(error => {
    if (!active) return;
    select.options[0].textContent = "Could not load project people";
    notifyError(error);
  });
  return {
    value() {
      if (!loaded) throw new Error("Project people are not loaded yet. Reopen the task if loading failed.");
      return select.value || null;
    },
    stop() { active = false; }
  };
}
