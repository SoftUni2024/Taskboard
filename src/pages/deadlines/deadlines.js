import template from "./deadlines.html?raw";
import "./deadlines.css";
import {requireUser,notifyError} from "../../services/api.js";
import {supabase} from "../../services/supabase.js";
import {deadlineTasks,result} from "../../services/task-details.js";
import {taskAssignees,assigneeName} from "../../services/task-assignees.js";
import {deadlineText,localDay} from "../../services/deadline-rules.js";
import {sanitizeRichText} from "../../services/rich-text.js";
import {taskForm} from "../../components/task-form/task-form.js";
import {closeDialogs} from "../../components/dialog/dialog.js";
import {watchProjectTasks} from "../../services/task-sync.js";
export {template};
export const title="Tasks by deadline";
export async function mount(root,{id}) {
  if(!(await requireUser(false)))return;
  root.querySelector("[data-board]").href="/project/"+id+"/tasks";
  const project=await result(supabase.from("projects").select("title").eq("id",id).single());
  root.querySelector("[data-title]").textContent=project.title;
  const stages=await result(supabase.from("project_stages").select("*").eq("project_id",id).order("position").order("id"));
  let active=true,version=0,page=1,count=0;
  const filter=root.querySelector("select");
  const initial=new URLSearchParams(location.search).get("filter");
  if([...filter.options].some(o=>o.value===initial))filter.value=initial;
  async function refresh(){
    const v=++version;
    const [data,people]=await Promise.all([deadlineTasks(id,filter.value,page),taskAssignees(id)]);
    if(!active||v!==version)return;
    count=data.count;
    if(page>1&&(page-1)*20>=count){page=1;return refresh();}
    history.replaceState({},"","/project/"+id+"/deadlines?filter="+filter.value);
    root.querySelector("[data-status]").textContent=count?count+" matching task"+(count===1?"":"s")+".":"No tasks match this deadline filter.";
    const body=root.querySelector("tbody");body.replaceChildren();
    for(const task of data.tasks){
      const row=document.createElement("tr");
      for(const text of [deadlineText(task)||"No deadline",task.title,task.project_stages?.name||"",assigneeName(task,people)]){
        const td=document.createElement("td");td.textContent=text;row.append(td);
      }
      if(task.due_on&&!task.done&&task.due_on<localDay())row.firstElementChild.className="deadline-overdue";
      const cell=document.createElement("td"),open=document.createElement("button");
      open.className="btn btn-sm btn-outline-primary";open.textContent="View task";
      open.onclick=()=>taskForm(id,{...task,stage:stages.findIndex(s=>s.id===task.stage_id),description:sanitizeRichText(task.description)},0,refresh,stages);
      cell.append(open);row.append(cell);body.append(row);
    }
    root.querySelector("[data-prev]").disabled=page===1;root.querySelector("[data-next]").disabled=page*20>=count;
    root.querySelector("[data-page]").textContent="Page "+page+" of "+Math.max(1,Math.ceil(count/20));
  }
  filter.onchange=()=>{page=1;refresh().catch(notifyError);};
  root.querySelector("[data-prev]").onclick=()=>{if(page>1){page--;refresh().catch(notifyError);}};
  root.querySelector("[data-next]").onclick=()=>{if(page*20<count){page++;refresh().catch(notifyError);}};
  await refresh();
  const stop=watchProjectTasks(supabase,id,{refresh,canRefresh:()=>active,onError:notifyError});
  return ()=>{active=false;version++;stop();closeDialogs();};
}
