import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {supabase as owner,SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "../src/services/supabase.js";
import {mutateBoard} from "../src/services/board-store.js";
import {checklist,changeChecklist,deadlineTasks,taskActivity} from "../src/services/task-details.js";
import {localDay} from "../src/services/deadline-rules.js";
import {saveLabel,setTaskLabel} from "../src/services/labels.js";
const make=()=>createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const member=make(),outsider=make();
const ok=async q=>{const {data,error}=await q;if(error)throw error;return data;};
const {user}=await ok(owner.auth.signInWithPassword({email:"steve@gmail.com",password:"pass123"}));
const {user:maria}=await ok(member.auth.signInWithPassword({email:"maria@gmail.com",password:"pass123"}));
await ok(outsider.auth.signInWithPassword({email:"peter@gmail.com",password:"pass123"}));
const project=await ok(owner.rpc("create_project_with_stages",{p_title:"Schedule and checklist verification"}));
let keep=false,file;
try{
  await ok(owner.from("project_members").insert({project_id:project,user_id:maria.id}));
  const stages=await ok(owner.from("project_stages").select("*").eq("project_id",project).order("position"));
  const today=localDay(),yesterday=new Date(today+"T12:00:00Z");yesterday.setUTCDate(yesterday.getUTCDate()-1);
  await mutateBoard("createTask",{project,title:"Prepare the launch checklist",stage:0,due_on:yesterday.toISOString().slice(0,10)});
  const task=(await ok(owner.from("tasks").select("*").eq("project_id",project)))[0];
  await ok(owner.from("tasks").insert([
    ...Array.from({length:25},(_,i)=>({project_id:project,stage_id:stages[0].id,title:"Upcoming task "+(i+1),position:i+1,due_on:"2099-12-31",done:false})),
    {project_id:project,stage_id:stages[0].id,title:"Due today",position:26,due_on:today,done:false},
    {project_id:project,stage_id:stages[0].id,title:"No deadline",position:27,done:false},
    {project_id:project,stage_id:stages[2].id,title:"Completed deadline",position:0,done:true,due_on:today}
  ]));
  assert.equal((await deadlineTasks(project,"overdue")).count,1);
  assert.equal((await deadlineTasks(project,"today")).count,1);
  assert.equal((await deadlineTasks(project,"upcoming")).count,25);
  assert.equal((await deadlineTasks(project,"done")).count,1);
  assert.equal((await deadlineTasks(project,"none")).count,1);
  assert.equal((await deadlineTasks(project,"open")).tasks.length,20);
  assert.equal((await deadlineTasks(project,"open",2)).tasks.length,7);
  await changeChecklist(task.id,"add",{title:"Review release notes"});
  await changeChecklist(task.id,"add",{title:"Confirm final approval"});
  let items=await checklist(task.id);
  await changeChecklist(task.id,"move",{id:items[1].id,direction:-1});
  items=await checklist(task.id);assert.equal(items[0].title,"Confirm final approval");
  await ok(member.rpc("checklist_change",{p_task:task.id,p_action:"edit",p_item:items[0].id,p_done:true}));
  assert.equal((await checklist(task.id))[0].done,true);
  await changeChecklist(task.id,"edit",{id:items[1].id,title:"Review updated release notes"});
  await changeChecklist(task.id,"add",{title:"Temporary item"});
  const temporary=(await checklist(task.id)).at(-1);
  await changeChecklist(task.id,"delete",{id:temporary.id});
  assert.equal((await checklist(task.id)).length,2);
  assert.ok((await member.from("task_checklist").insert({task_id:task.id,title:"Bypass",position:0})).error);
  assert.ok((await outsider.rpc("checklist_change",{p_task:task.id,p_action:"add",p_title:"Forbidden"})).error);
  assert.deepEqual(await ok(outsider.from("task_checklist").select("*").eq("task_id",task.id)),[]);
  await mutateBoard("editTask",{project,id:task.id,title:task.title,description:"Final review",stage:1,due_on:today,assignee_id:maria.id});
  const label=await saveLabel(project,null,"Launch","#78935f");
  await setTaskLabel(project,task.id,label.id,true);
  await ok(member.from("task_comments").insert({task_id:task.id,body:"Ready for review"}));
  file=user.id+"/"+project+"/"+task.id+"/"+crypto.randomUUID()+"--sample.txt";
  await ok(owner.storage.from("task-attachments").upload(file,new Blob(["Sample attachment"],{type:"text/plain"}),{contentType:"text/plain"}));
  await ok(owner.storage.from("task-attachments").remove([file]));file=null;
  const history=await taskActivity(project,1,task.id);
  for(const action of ["Task insert","Task update","Checklist item insert","Checklist item update","Checklist item delete","Label link insert","Comment insert","Attachment insert","Attachment delete"])
    assert.ok(history.events.some(e=>e.action===action),action);
  assert.ok(history.events.some(e=>e.actor_id===maria.id&&e.actor_name==="Maria"));
  assert.ok(history.events.some(e=>e.action==="Attachment insert"&&e.actor_id===user.id));
  assert.equal((await taskActivity(project)).events.length,30);
  assert.ok((await taskActivity(project,2)).events.length>0);
  assert.deepEqual(await ok(outsider.from("task_activity").select("*").eq("project_id",project)),[]);
  assert.ok((await member.from("task_activity").delete().eq("project_id",project)).error);
  assert.ok((await member.from("task_activity").insert({project_id:project,task_id:task.id,task_title:"Forged",actor_name:"Admin",action:"Forged"})).error);
  const deleted=await ok(owner.from("tasks").insert({project_id:project,stage_id:stages[0].id,title:"Deleted task audit",position:28}).select().single());
  await changeChecklist(deleted.id,"add",{title:"Cascade me"});
  await ok(owner.from("tasks").delete().eq("id",deleted.id));
  assert.equal((await checklist(deleted.id)).length,0);
  assert.ok((await taskActivity(project,1,deleted.id)).events.some(e=>e.action==="Task delete"&&e.task_title==="Deleted task audit"));
  await ok(owner.from("project_members").delete().eq("project_id",project).eq("user_id",maria.id));
  assert.deepEqual(await ok(member.from("task_activity").select("*").eq("project_id",project)),[]);
  assert.ok((await member.rpc("checklist_change",{p_task:task.id,p_action:"edit",p_item:items[0].id,p_done:false})).error);
  await ok(owner.from("project_members").insert({project_id:project,user_id:maria.id}));
  console.log("PASS: date filters/paging, checklist CRUD/order/completion, RLS, append-only activity, task/label/comment/file history, deleted-task history and revoked-member denial.");
  if(process.env.KEEP_DETAILS_PREVIEW==="1"){
    writeFileSync(".sites-runtime/details-preview.json",JSON.stringify({project,task:task.id}));
    console.log({project,task:task.id});keep=true;
  }
}finally{
  if(file)await owner.storage.from("task-attachments").remove([file]);
  if(!keep)await ok(owner.from("projects").delete().eq("id",project));
  await Promise.all([owner,member,outsider].map(c=>c.auth.signOut({scope:"local"})));
}
process.exit(0);
