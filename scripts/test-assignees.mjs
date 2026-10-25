import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { supabase as owner, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../src/services/supabase.js";
import { mutateBoard } from "../src/services/board-store.js";
import { loadPagedBoard } from "../src/services/paged-data.js";
import { writeFileSync } from "node:fs";
const client = () => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const member = client(), outsider = client(), admin = client();
const ok = async query => {const {data,error} = await query; if(error) throw error; return data;};
const login = (c,email,password) => ok(c.auth.signInWithPassword({email,password}));
const {user} = await login(owner,"steve@gmail.com","pass123");
const {user: maria} = await login(member,"maria@gmail.com","pass123");
const {user: peter} = await login(outsider,"peter@gmail.com","pass123");
await login(admin,process.env.ADMIN_EMAIL,process.env.ADMIN_PASSWORD);
const project = await ok(owner.rpc("create_project_with_stages",{p_title:"Assignee verification"}));
let keep = false;
try {
  await ok(owner.from("project_members").insert({project_id:project,user_id:maria.id}));
  const people = await ok(member.rpc("task_assignees",{p_project:project}));
  assert.deepEqual(new Set(people.map(p=>p.id)),new Set([user.id,maria.id]));
  assert.ok((await outsider.rpc("task_assignees",{p_project:project})).error);
  await mutateBoard("createTask",{project,title:"Prepare the launch checklist",stage:0,assignee_id:maria.id});
  const task = (await ok(owner.from("tasks").select("*").eq("project_id",project)))[0];
  assert.equal(task.assignee_id,maria.id);
  let board = await loadPagedBoard(project,user);
  assert.equal(board.tasks[0].assignee_name,"Maria");
  await ok(member.from("tasks").update({assignee_id:user.id}).eq("id",task.id).select().single());
  assert.equal((await loadPagedBoard(project,user)).tasks[0].assignee_name,"Steve");
  assert.ok((await owner.from("tasks").update({assignee_id:peter.id}).eq("id",task.id)).error);
  assert.ok((await admin.from("tasks").update({assignee_id:peter.id}).eq("id",task.id)).error);
  assert.deepEqual(await ok(outsider.from("tasks").update({assignee_id:peter.id}).eq("id",task.id).select()),[]);
  await mutateBoard("editTask",{project,id:task.id,title:task.title,stage:1,description:"Updated",assignee_id:maria.id});
  board = await loadPagedBoard(project,user);
  assert.equal(board.tasks[0].stage,1);
  assert.equal(board.tasks[0].assignee_id,maria.id);
  await mutateBoard("moveTask",{project,id:task.id,stage:2});
  assert.equal((await loadPagedBoard(project,user)).tasks[0].assignee_id,maria.id);
  await ok(owner.from("project_members").delete().eq("project_id",project).eq("user_id",maria.id));
  assert.equal((await loadPagedBoard(project,user)).tasks[0].assignee_id,null);
  assert.ok((await member.rpc("task_assignees",{p_project:project})).error);
  await ok(owner.from("project_members").insert({project_id:project,user_id:maria.id}));
  await mutateBoard("editTask",{project,id:task.id,title:task.title,stage:0,description:"",assignee_id:null});
  assert.equal((await loadPagedBoard(project,user)).tasks[0].assignee_name,"Unassigned");
  console.log("PASS: owner/member assignment, unassignment, persistence, board names, moves, outsider denial, invalid targets and membership removal cleanup.");
  if(process.env.KEEP_ASSIGNEE_PREVIEW === "1") {
    writeFileSync(".sites-runtime/assignee-preview.json",JSON.stringify({project,task:task.id}));
    console.log({project,task:task.id});
    keep = true;
  }
} finally {
  if(!keep) await ok(owner.from("projects").delete().eq("id",project));
  await Promise.all([owner,member,outsider,admin].map(c=>c.auth.signOut({scope:"local"})));
}
process.exit(0);
