import template from "./labels.html?raw";
import "./labels.css";
import "../../components/task-labels/task-labels.css";
import {requireUser,notify,notifyError} from "../../services/api.js";
import {projectLabels,labeledTaskPage,saveLabel,deleteLabel,labelChip} from "../../services/labels.js";
import {taskAssignees,assigneeName} from "../../services/task-assignees.js";
import {supabase} from "../../services/supabase.js";
import {openDialog,confirmDelete,closeDialogs} from "../../components/dialog/dialog.js";
import {taskForm} from "../../components/task-form/task-form.js";
import {sanitizeRichText} from "../../services/rich-text.js";
import {watchProjectTasks} from "../../services/task-sync.js";
export {template};
export const title="Tasks by label";
export async function mount(root,{id}) {
  if(!(await requireUser(false)))return;
  let active=true,version=0,page=1,labels=[],selected=new URLSearchParams(location.search).get("label")||"",count=0;
  const filter=root.querySelector("[data-filter]"),status=root.querySelector("[data-status]");
  root.querySelector("[data-board]").href="/project/"+id+"/tasks";
  const {data:project,error}=await supabase.from("projects").select("title").eq("id",id).single();
  if(error)throw new Error(error.message);
  root.querySelector("[data-project-title]").textContent=project.title;
  const {data:stages,error:stageError}=await supabase.from("project_stages").select("*").eq("project_id",id).order("position").order("id");
  if(stageError)throw new Error(stageError.message);
  function url() {
    const path="/project/"+id+"/labels"+(selected?"?label="+encodeURIComponent(selected):"");
    history.replaceState({},"",path);
  }
  async function refresh() {
    const v=++version;
    const nextLabels=await projectLabels(id);
    if(!active||v!==version)return;
    labels=nextLabels;
    if(!labels.some(label=>label.id===selected)){selected=labels[0]?.id||"";page=1;}
    const [result,people]=await Promise.all([selected?labeledTaskPage(id,selected,page):{tasks:[],count:0},taskAssignees(id)]);
    if(!active||v!==version)return;
    count=result.count;
    if(page>1 && (page-1)*20>=count){page=1;return refresh();}
    url();
    filter.replaceChildren(...labels.map(label=>{
      const option=document.createElement("option");option.value=label.id;option.textContent=label.name;return option;
    }));
    filter.value=selected;filter.disabled=!labels.length;
    root.querySelector("[data-edit]").disabled=root.querySelector("[data-delete]").disabled=!selected;
    const chosen=labels.find(label=>label.id===selected);
    root.querySelector("[data-selected-label]").replaceChildren(...(chosen?[labelChip(chosen)]:[]));
    status.textContent=!labels.length?"No labels yet. Create a label, then add it to tasks from their popups.":count?count+" task"+(count===1?"":"s")+" with this label.":"No tasks have this label yet.";
    const body=root.querySelector("tbody");body.replaceChildren();
    for(const task of result.tasks) {
      const row=document.createElement("tr");
      for(const text of [task.title,task.project_stages?.name||"",task.done?"Done":"Open",assigneeName(task,people)]){
        const cell=document.createElement("td");cell.textContent=text;row.append(cell);
      }
      const cell=document.createElement("td"),open=document.createElement("button");
      open.className="btn btn-sm btn-outline-primary";open.textContent="View task";
      open.onclick=()=>taskForm(id,{...task,stage:stages.findIndex(s=>s.id===task.stage_id),description:sanitizeRichText(task.description)},0,refresh,stages);
      cell.append(open);row.append(cell);body.append(row);
    }
    root.querySelector("[data-prev]").disabled=page===1;
    root.querySelector("[data-next]").disabled=page*20>=count;
    root.querySelector("[data-page]").textContent="Page "+page+" of "+Math.max(1,Math.ceil(count/20));
  }
  function labelForm(label) {
    openDialog({
      title:label?"Edit label":"New label",
      body:'<label for="label-name" class="form-label">Label name</label><input id="label-name" name="name" class="form-control mb-3" required maxlength="40"><label for="label-color" class="form-label">Color</label><input id="label-color" name="color" type="color" class="form-control form-control-color">',
      submitLabel:label?"Save label":"Create label",
      onMount(dialog){dialog.querySelector("[name=name]").value=label?.name||"";dialog.querySelector("[name=color]").value=label?.color||"#78935f";},
      async onSubmit(form){
        const saved=await saveLabel(id,label?.id,form.get("name"),form.get("color"));
        selected=saved.id;page=1;
        notify(label?"Label updated":"Label created");await refresh();
      }
    });
  }
  filter.onchange=()=>{selected=filter.value;page=1;refresh().catch(notifyError);};
  root.querySelector("[data-create]").onclick=()=>labelForm();
  root.querySelector("[data-edit]").onclick=()=>labelForm(labels.find(l=>l.id===selected));
  root.querySelector("[data-delete]").onclick=()=>{
    const label=labels.find(l=>l.id===selected);
    if(label)confirmDelete("Delete label?","Delete “"+label.name+"” and remove it from all tasks? The tasks will remain.",async()=>{
      await deleteLabel(label.id);selected="";page=1;notify("Label deleted");await refresh();
    });
  };
  root.querySelector("[data-prev]").onclick=()=>{if(page>1){page--;refresh().catch(notifyError);}};
  root.querySelector("[data-next]").onclick=()=>{if(page*20<count){page++;refresh().catch(notifyError);}};
  await refresh();
  const stop=watchProjectTasks(supabase,id,{refresh,canRefresh:()=>active,onError:notifyError});
  return ()=>{active=false;version++;stop();closeDialogs();};
}
