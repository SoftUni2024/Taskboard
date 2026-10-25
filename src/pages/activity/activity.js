import template from "./activity.html?raw";
import "./activity.css";
import {requireUser,notifyError} from "../../services/api.js";
import {supabase} from "../../services/supabase.js";
import {taskActivity,result} from "../../services/task-details.js";
import {taskAssignees} from "../../services/task-assignees.js";
import {watchProjectTasks} from "../../services/task-sync.js";
export {template};
export const title="Task activity";
const actions={insert:"created",update:"updated",delete:"deleted"};
export async function mount(root,{id}){
  if(!(await requireUser(false)))return;
  root.querySelector("[data-board]").href="/project/"+id+"/tasks";
  root.querySelector("[data-all]").href="/project/"+id+"/activity";
  const task=new URLSearchParams(location.search).get("task");
  if(task&&!/^[0-9a-f-]{36}$/i.test(task))throw new Error("Invalid task history link.");
  root.querySelector("[data-all]").hidden=!task;
  const project=await result(supabase.from("projects").select("title").eq("id",id).single());
  root.querySelector("[data-title]").textContent=project.title+(task?" · Selected task":"");
  let active=true,version=0,page=1,count=0;
  async function refresh(){
    const v=++version;
    const [data,people,stages]=await Promise.all([taskActivity(id,page,task),taskAssignees(id),result(supabase.from("project_stages").select("id,name").eq("project_id",id))]);
    if(!active||v!==version)return;count=data.count;
    if(page>1&&(page-1)*30>=count){page=1;return refresh();}
    root.querySelector("[data-status]").textContent=count?count+" recorded changes.":"No activity recorded yet.";
    const list=root.querySelector("ol"),expanded=new Set([...list.querySelectorAll("li")].filter(item=>item.querySelector("details")?.open).map(item=>item.dataset.eventId));list.replaceChildren();
    function value(key,val){
      if(val===null||val===undefined)return "None";
      if(key==="stage_id")return stages.find(s=>s.id===val)?.name||val;
      if(key==="assignee_id")return people.find(p=>p.id===val)?.name||val;
      if(typeof val==="object")return JSON.stringify(val,null,2);
      return String(val);
    }
    for(const event of data.events){
      const item=document.createElement("li"),title=document.createElement("strong"),meta=document.createElement("div"),details=document.createElement("details"),summary=document.createElement("summary"),pre=document.createElement("pre");
      item.dataset.eventId=String(event.id);details.open=expanded.has(String(event.id));
      title.textContent=event.task_title;
      meta.className="activity-meta";
      meta.textContent=event.action.replace(/(insert|update|delete)$/,op=>actions[op])+" · "+event.actor_name+" · "+new Date(event.created_at).toLocaleString();
      summary.textContent="View change details";
      const before=event.before_data||{},after=event.after_data||{};
      const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>!["id","task_id","project_id","updated_at","created_at"].includes(key)&&JSON.stringify(before[key])!==JSON.stringify(after[key]));
      pre.textContent=keys.map(key=>key.replaceAll("_"," ")+":\n  Before: "+value(key,before[key])+"\n  After: "+value(key,after[key])).join("\n\n")||event.action;
      details.append(summary,pre);item.append(title,meta,details);list.append(item);
    }
    root.querySelector("[data-prev]").disabled=page===1;root.querySelector("[data-next]").disabled=page*30>=count;
    root.querySelector("[data-page]").textContent="Page "+page+" of "+Math.max(1,Math.ceil(count/30));
  }
  root.querySelector("[data-prev]").onclick=()=>{if(page>1){page--;refresh().catch(notifyError);}};
  root.querySelector("[data-next]").onclick=()=>{if(page*30<count){page++;refresh().catch(notifyError);}};
  await refresh();
  const stop=watchProjectTasks(supabase,id,{refresh,canRefresh:()=>active,onError:notifyError});
  return ()=>{active=false;version++;stop();};
}
