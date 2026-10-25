import {supabase} from "./supabase.js";
import {localDay} from "./deadline-rules.js";
export async function result(query) {
  const {data,error}=await query;
  if(error)throw new Error(error.message);
  return data;
}
export const checklist = task => result(supabase.from("task_checklist").select("*").eq("task_id",task).order("position").order("id"));
export async function changeChecklist(task,action,values={}) {
  if(Object.hasOwn(values,"title")) {
    values.title=String(values.title).trim();
    if(!values.title || values.title.length>200)throw new Error("Enter a checklist item of 1–200 characters.");
  }
  return result(supabase.rpc("checklist_change",{p_task:task,p_action:action,p_item:values.id||null,p_title:values.title??null,p_done:values.done??null,p_direction:values.direction??null}));
}
export async function deadlineTasks(project,filter,page=1) {
  let query=supabase.from("tasks").select("*,project_stages(name)",{count:"exact"}).eq("project_id",project);
  const today=localDay();
  if(filter==="none")query=query.is("due_on",null);
  else {
    query=query.not("due_on","is",null);
    if(filter==="done")query=query.eq("done",true);
    else if(filter!=="all")query=query.eq("done",false);
    if(filter==="overdue")query=query.lt("due_on",today);
    if(filter==="today")query=query.eq("due_on",today);
    if(filter==="upcoming")query=query.gt("due_on",today);
  }
  const {data,error,count}=await query.order("due_on",{ascending:true,nullsFirst:false}).order("title").order("id").range((page-1)*20,page*20-1);
  if(error?.code==="PGRST103")return {tasks:[],count:0};
  if(error)throw new Error(error.message);
  return {tasks:data,count:count||0};
}
export async function taskActivity(project,page=1,task=null) {
  let query=supabase.from("task_activity").select("*",{count:"exact"}).eq("project_id",project);
  if(task)query=query.eq("task_id",task);
  const {data,error,count}=await query.order("id",{ascending:false}).range((page-1)*30,page*30-1);
  if(error?.code==="PGRST103")return {events:[],count:0};
  if(error)throw new Error(error.message);
  return {events:data,count:count||0};
}
