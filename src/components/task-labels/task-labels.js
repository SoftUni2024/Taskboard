import template from "./task-labels.html?raw";
import "./task-labels.css";
import {projectLabels,taskLabelIds,setTaskLabel,labelChip} from "../../services/labels.js";
import {notify,notifyError} from "../../services/api.js";
import {watchProjectTasks} from "../../services/task-sync.js";
import {supabase} from "../../services/supabase.js";
export function mountTaskLabels(host,project,task,onChange) {
  host.innerHTML=template;
  host.querySelector("[data-manage-labels]").href="/project/"+project+"/labels";
  const options=host.querySelector("[data-label-options]"),status=host.querySelector("[data-label-status]");
  let active=true,busy=false,version=0;
  if(!task) {
    status.textContent="Create this task first, then open it to add labels.";
    return ()=>{active=false;};
  }
  async function refresh() {
    const v=++version;
    const [labels,links]=await Promise.all([projectLabels(project),taskLabelIds(task.id)]);
    if(!active || v!==version)return;
    const selected=new Set(links.map(l=>l.label_id));
    options.replaceChildren();
    status.textContent=labels.length ? "" : "No project labels yet. Use Manage labels to create one.";
    for(const label of labels) {
      const item=document.createElement("label"),check=document.createElement("input");
      check.type="checkbox";check.className="form-check-input mt-0";check.checked=selected.has(label.id);
      check.onchange=async()=>{
        if(busy)return;
        busy=true;
        options.querySelectorAll("input").forEach(input=>input.disabled=true);
        try {
          await setTaskLabel(project,task.id,label.id,check.checked);
          notify(check.checked ? "Label added to task" : "Label removed from task");
          await refresh();
          await onChange();
        } catch(error) {notifyError(error);await refresh().catch(notifyError);}
        finally {busy=false;if(active)options.querySelectorAll("input").forEach(input=>input.disabled=false);}
      };
      item.append(check,labelChip(label));options.append(item);
    }
  }
  refresh().catch(error=>{if(active){status.textContent="Could not load labels. Reopen the task to retry.";notifyError(error);}});
  const stop=watchProjectTasks(supabase,project,{refresh,canRefresh:()=>active&&!busy,onError:notifyError});
  return ()=>{active=false;version++;stop();};
}
