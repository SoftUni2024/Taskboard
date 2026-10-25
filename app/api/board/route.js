import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
const reply = (data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const clean = value => String(value??'').split(/(<[^>]*>)/g).map(part=>{
  if(/^<\/?(?:p|div|br|b|strong|i|em|u|ul|ol|li|h2|h3|blockquote)\s*\/?\s*>$/i.test(part)) return part.toLowerCase();
  return part.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi,'&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}).join('');
function required(value,max=120) { if(typeof value!=='string'||!value.trim()||value.length>max) throw new Error('Please enter a value of 1–'+max+' characters.'); return value.trim(); }
async function identity() {
  const user = await getChatGPTUser(); if(!user) return null;
  await env.DB.prepare('INSERT INTO users (id,email,name) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email').bind(user.userId,user.email.toLowerCase(),user.displayName).run();
  return await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(user.userId).first();
}
async function access(id,user,ownerOnly=false) {
  const p=await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(id).first(); if(!p) throw new Error('Project not found.');
  if(p.owner!==user.id && (ownerOnly || !await env.DB.prepare('SELECT 1 FROM members WHERE project=? AND email=?').bind(id,user.email).first())) throw new Error('You do not have access to this project.');
  return p;
}
export async function GET(request) {
 try {
  const user=await identity(); if(!user) return reply({user:null,projects:[]});
  const id=new URL(request.url).searchParams.get('project');
  if(id) { const project=await access(id,user); const [ts,ms]=await Promise.all([env.DB.prepare('SELECT * FROM tasks WHERE project=? ORDER BY position,created,id').bind(id).all(),env.DB.prepare('SELECT m.email,u.name FROM members m LEFT JOIN users u ON m.email=u.email WHERE m.project=?').bind(id).all()]); const owner=await env.DB.prepare('SELECT email,name FROM users WHERE id=?').bind(project.owner).first(); return reply({user,project,tasks:ts.results,members:ms.results,owner}); }
  const ps=await env.DB.prepare('SELECT p.*, (SELECT COUNT(*) FROM tasks t WHERE t.project=p.id) AS total, (SELECT COUNT(*) FROM tasks t WHERE t.project=p.id AND t.stage=2) AS done FROM projects p WHERE p.owner=? OR EXISTS(SELECT 1 FROM members m WHERE m.project=p.id AND m.email=?) ORDER BY p.created DESC').bind(user.id,user.email).all(); return reply({user,projects:ps.results});
 } catch(e) { return reply({error:e.message},400); }
}
export async function POST(request) {
 try {
  if(request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin) return reply({error:'Invalid origin'},403);
  if(Number(request.headers.get('content-length'))>150000) return reply({error:'Request too large'},413);
  const user=await identity(); if(!user) return reply({error:'Sign in to continue.'},401);
  const b=await request.json(), action=b.action;
  if(action==='profile') { await env.DB.prepare('UPDATE users SET name=? WHERE id=?').bind(required(b.name,80),user.id).run(); return reply({ok:true}); }
  if(action==='createProject') { const id=crypto.randomUUID(); await env.DB.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?)').bind(id,user.id,required(b.title),String(b.description||'').slice(0,2000),/^#[0-9a-f]{6}$/i.test(b.color)?b.color:'#8b9b73',Date.now()).run(); return reply({id}); }
  if(!b.project) throw new Error('Project is required.');
  await access(b.project,user,['editProject','deleteProject','addMember','removeMember'].includes(action));
  if(action==='editProject') await env.DB.prepare('UPDATE projects SET title=?,description=?,color=? WHERE id=?').bind(required(b.title),String(b.description||'').slice(0,2000),/^#[0-9a-f]{6}$/i.test(b.color)?b.color:'#8b9b73',b.project).run();
  else if(action==='deleteProject') await env.DB.batch([env.DB.prepare('DELETE FROM tasks WHERE project=?').bind(b.project),env.DB.prepare('DELETE FROM members WHERE project=?').bind(b.project),env.DB.prepare('DELETE FROM projects WHERE id=?').bind(b.project)]);
  else if(action==='addMember') { const email=required(b.email,254).toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.'); if(email===user.email) throw new Error('You already own this project.'); await env.DB.prepare('INSERT OR IGNORE INTO members VALUES (?,?)').bind(b.project,email).run(); }
  else if(action==='removeMember') await env.DB.prepare('DELETE FROM members WHERE project=? AND email=?').bind(b.project,b.email).run();
  else if(action==='createTask'||action==='editTask') {
    const stage=Number(b.stage); if(!Number.isInteger(stage)||stage<0||stage>2) throw new Error('Invalid stage.');
    const title=required(b.title,180); if(String(b.description||'').length>40000) throw new Error('Description is too long.'); const description=clean(b.description||'');
    if(action==='createTask') { const max=await env.DB.prepare('SELECT COALESCE(MAX(position),-1) AS n FROM tasks WHERE project=? AND stage=?').bind(b.project,stage).first(); await env.DB.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),b.project,title,description,stage,max.n+1,Date.now()).run(); }
    else { const old=await env.DB.prepare('SELECT * FROM tasks WHERE id=? AND project=?').bind(b.id,b.project).first(); if(!old) throw new Error('Task not found.'); const max=await env.DB.prepare('SELECT COALESCE(MAX(position),-1) AS n FROM tasks WHERE project=? AND stage=?').bind(b.project,stage).first(); await env.DB.prepare('UPDATE tasks SET title=?,description=?,stage=?,position=? WHERE id=? AND project=?').bind(title,description,stage,old.stage===stage?old.position:max.n+1,b.id,b.project).run(); }
  }
  else if(action==='deleteTask') await env.DB.prepare('DELETE FROM tasks WHERE id=? AND project=?').bind(b.id,b.project).run();
  else if(action==='moveTask') {
    const stage=Number(b.stage); if(!Number.isInteger(stage)||stage<0||stage>2) throw new Error('Invalid stage.');
    const task=await env.DB.prepare('SELECT id FROM tasks WHERE id=? AND project=?').bind(b.id,b.project).first(); if(!task) throw new Error('Task not found.');
    const target=(await env.DB.prepare('SELECT id FROM tasks WHERE project=? AND stage=? AND id<>? ORDER BY position,created,id').bind(b.project,stage,b.id).all()).results;
    let index=b.before?target.findIndex(t=>t.id===b.before):target.length; if(index<0) index=target.length; target.splice(index,0,task);
    await env.DB.batch(target.map((t,i)=>env.DB.prepare('UPDATE tasks SET stage=?,position=? WHERE id=? AND project=?').bind(stage,i,t.id,b.project)));
  } else throw new Error('Unknown action.');
  return reply({ok:true});
 } catch(e) { return reply({error:e.message},400); }
}
