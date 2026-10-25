import template from "./task-checklist.html?raw";
import "./task-checklist.css";
import {checklist,changeChecklist} from "../../services/task-details.js";
import {notify,notifyError} from "../../services/api.js";
import {supabase} from "../../services/supabase.js";
import {watchProjectTasks} from "../../services/task-sync.js";
export function mountChecklist(host,project,task) {
  host.innerHTML=template;
  const list=host.querySelector("ol"),input=host.querySelector("[data-check-new]"),add=host.querySelector("[data-check-add]"),status=host.querySelector("[data-check-status]");
  let active=true,busy=false,editing=null,draft="",rows=[],version=0,confirming=null;
  if(!task){status.textContent="Create this task first, then add checklist items.";input.disabled=add.disabled=true;return ()=>{active=false;};}
  function button(text,action,disabled=false) {
    const b=document.createElement("button");b.type="button";b.className="btn btn-outline-primary btn-sm";b.textContent=text;b.disabled=busy||disabled;b.onclick=action;return b;
  }
  async function refresh(){
    const v=++version,next=await checklist(task.id);
    if(!active||v!==version)return;
    rows=next;render();
  }
  async function run(action,message){
    if(busy)return;busy=true;render();
    try{await action();editing=null;confirming=null;if(message)notify(message);await refresh();}
    catch(error){notifyError(error);}
    finally{busy=false;if(active)render();}
  }
  function render(){
    input.disabled=add.disabled=busy||!!editing||!!confirming||rows.length>=200;
    const scroll=list.scrollTop;list.replaceChildren();
    status.textContent=rows.length ? rows.filter(r=>r.done).length+" of "+rows.length+" complete" : "No checklist items yet.";
    rows.forEach((item,index)=>{
      const li=document.createElement("li"),row=document.createElement("div"),actions=document.createElement("div");
      row.className="check-row";actions.className="check-actions";
      const check=document.createElement("input");check.type="checkbox";check.className="form-check-input";check.checked=item.done;check.setAttribute("aria-label","Complete: "+item.title);check.disabled=busy||!!editing||!!confirming;
      check.onchange=()=>run(()=>changeChecklist(task.id,"edit",{id:item.id,done:check.checked}));
      const text=document.createElement("span");text.className="check-title"+(item.done?" complete":"");text.textContent=(index+1)+". "+item.title;row.append(check,text);
      if(editing===item.id){
        const area=document.createElement("input");area.className="form-control";area.maxLength=200;area.value=draft;area.setAttribute("aria-label","Edit checklist item");area.disabled=busy;area.oninput=()=>draft=area.value;text.replaceWith(area);
        actions.append(button("Save item",()=>run(()=>changeChecklist(task.id,"edit",{id:item.id,title:draft}),"Checklist item updated")),button("Cancel edit",()=>{editing=null;render();}));
      }else if(confirming===item.id){
        const prompt=document.createElement("span");prompt.textContent="Delete this item?";
        actions.append(prompt,button("Delete item",()=>run(()=>changeChecklist(task.id,"delete",{id:item.id}),"Checklist item deleted")),button("Cancel",()=>{confirming=null;render();}));
      }else {
        const locked=!!editing||!!confirming;
        actions.append(button("Edit item",()=>{editing=item.id;draft=item.title;render();},locked),
          button("↑",()=>run(()=>changeChecklist(task.id,"move",{id:item.id,direction:-1})),locked||index===0),
          button("↓",()=>run(()=>changeChecklist(task.id,"move",{id:item.id,direction:1})),locked||index===rows.length-1),
          button("Delete",()=>{confirming=item.id;render();},locked));
        actions.children[1].setAttribute("aria-label","Move checklist item up");
        actions.children[2].setAttribute("aria-label","Move checklist item down");
      }
      li.append(row,actions);list.append(li);
    });
    list.scrollTop=scroll;
  }
  add.onclick=()=>run(async()=>{await changeChecklist(task.id,"add",{title:input.value});input.value="";},"Checklist item added");
  input.onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();if(!add.disabled)add.click();}};
  refresh().catch(error=>{if(active){status.textContent="Could not load checklist. Reopen the task to retry.";notifyError(error);}});
  const stop=watchProjectTasks(supabase,project,{refresh,canRefresh:()=>active&&!busy&&!editing&&!confirming,onError:notifyError});
  return ()=>{active=false;version++;stop();};
}
