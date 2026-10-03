// Drives the storage-key routes as temporary accounts (exec, lead, officers, a recruit, an alumnus) against a running dev server, then removes
// everything it made. Only the temporary accounts are ever notified. Run: npm run test:keys
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));
const url=env.NEXT_PUBLIC_SUPABASE_URL, svc=createClient(url, env.SUPABASE_SERVICE_ROLE_KEY); const ref=new URL(url).hostname.split('.')[0];
const made=[]; const keyIds=[]; let fails=0; const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL'),n,c?'':x); if(!c)fails++;};
async function user(name,roles){
  const email=`mtg-key-${name}-${Date.now()}@example.test`; const {data}=await svc.auth.admin.createUser({email,email_confirm:true}); const id=data.user.id; made.push(id);
  await svc.from('profiles').update({display_name:'Mtg '+name,onboarded_at:new Date().toISOString(),year:'2028',class_of:2028,college:'Sixth',major:'CS',pronouns:'they/them'}).eq('id',id);
  for(const r of roles) await svc.from('user_roles').insert({user_id:id,role:r});
  const c=createClient(url,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); const {data:lk}=await svc.auth.admin.generateLink({type:'magiclink',email}); const {data:s}=await c.auth.verifyOtp({token_hash:lk.properties.hashed_token,type:'magiclink'});
  const cookie=`sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString('base64url')}`;
  const call=async(m,p,b)=>{const r=await fetch('http://localhost:3000'+p,{method:m,headers:{cookie,'content-type':'application/json'},body:b?JSON.stringify(b):undefined}); let j={}; try{j=await r.json()}catch{} return {s:r.status,j};};
  return {id,call};
}
try{
 const exec=await user('exec',['exec']), lead=await user('lead',['lead']), A=await user('a',['officer']), B=await user('b',['officer']), C=await user('c',['recruit']), old=await user('alumni',['alumni']);
 let r=await fetch('http://localhost:3000/api/keys'); ok('signed-out is refused',r.status===401,r.status);
 r=await old.call('GET','/api/keys'); ok('alumnus cannot see keys',r.s===403,r.s);
 r=await old.call('POST','/api/keys',{name:'Mtg Nope'}); ok('alumnus cannot add a key',r.s===403,r.s);
 for(const [n,u] of [['officer',A],['lead',lead],['recruit',C]]){ r=await u.call('POST','/api/keys',{name:'Mtg Nope'}); ok(`${n} cannot add a key (exec and admin only)`,r.s===403,r.s); }
 for(const [n,u] of [['exec',exec],['lead',lead],['officer',A],['recruit',C]]){ r=await u.call('GET','/api/keys'); ok(`${n} can see keys`,r.s===200,r.s); }

 r=await exec.call('POST','/api/keys',{name:'  '}); ok('a key needs a name',r.s===400,JSON.stringify(r.j));
 r=await exec.call('POST','/api/keys',{name:'Mtg Storage closet',color:'#60a5fa',holder:{kind:'member',user_id:A.id}}); ok('exec adds a key held by an officer',r.s===201,JSON.stringify(r.j)); const k1=r.j.id; keyIds.push(k1);
 r=await exec.call('POST','/api/keys',{name:'Mtg Bike cage',holder:{kind:'place',label:'Marshall front desk',note:'ask for Sam'}}); ok('key can start at a place',r.s===201,JSON.stringify(r.j)); const k2=r.j.id; keyIds.push(k2);
 r=await exec.call('POST','/api/keys',{name:'Mtg Bad',holder:{kind:'person'}}); ok('outsider needs a name',r.s===400,JSON.stringify(r.j));
 r=await exec.call('POST','/api/keys',{name:'Mtg Bad',holder:{kind:'member',user_id:old.id}}); ok('cannot give to someone outside the team list',r.s===400,JSON.stringify(r.j));
 r=await exec.call('POST','/api/keys',{name:'Mtg Third',color:'not-a-color'}); ok('unknown color falls back',r.s===201,JSON.stringify(r.j)); keyIds.push(r.j.id); const k3=r.j.id;

 r=await B.call('GET','/api/keys'); const L=r.j.keys.filter(k=>keyIds.includes(k.id));
 ok('list shows all three, with holders',L.length===3&&L.find(k=>k.id===k1).holder.name==='Mtg a'&&L.find(k=>k.id===k2).holder.kind==='place'&&L.find(k=>k.id===k1).holder.kind==='member',JSON.stringify(L.map(k=>k.holder)));
 ok('color is kept, unknown color falls back',L.find(k=>k.id===k1).color==='#60a5fa'&&L.find(k=>k.id===k3).color==='#ffc72c'&&!('key_of' in L[0]));
 ok('people list is the team (not the alumnus)',r.j.people.some(p=>p.id===A.id)&&!r.j.people.some(p=>p.id===old.id));

 // take
 const before=L.find(k=>k.id===k1);
 r=await B.call('POST',`/api/keys/${k1}/move`,{action:'take',expected_updated_at:before.updated_at}); ok('B takes the key',r.s===200,JSON.stringify(r.j));
 let {data:row}=await svc.from('storage_keys').select('holder_kind,holder_user_id').eq('id',k1).single(); ok('key is now B\'s',row.holder_user_id===B.id&&row.holder_kind==='member');
 let {data:n}=await svc.from('notifications').select('user_id,title').eq('type','storage_key').in('user_id',[A.id,B.id]); ok('previous holder A told, B not',n.length===1&&n[0].user_id===A.id,JSON.stringify(n));
 r=await B.call('POST',`/api/keys/${k1}/move`,{action:'take'}); ok('taking a key you already have is refused',r.s===400,JSON.stringify(r.j));
 r=await C.call('POST',`/api/keys/${k1}/move`,{action:'take',expected_updated_at:before.updated_at}); ok('stale view is refused (someone moved it)',r.s===409&&r.j.stale===true,JSON.stringify(r.j));

 // give: to member, outsider, place
 r=await B.call('POST',`/api/keys/${k1}/move`,{action:'give',to:{kind:'member',user_id:C.id},note:'for the weekend'}); ok('B hands to recruit C',r.s===200,JSON.stringify(r.j));
 ({data:n}=await svc.from('notifications').select('user_id,title,body,href').eq('type','storage_key').eq('user_id',C.id)); ok('C is notified they got the key',n.length===1&&/gave you/.test(n[0].title)&&n[0].href==='/portal?section=keys',JSON.stringify(n));
 r=await C.call('POST',`/api/keys/${k1}/move`,{action:'give',to:{kind:'person',label:'Sam from facilities',note:'555-0100'}}); ok('hand to someone outside the club',r.s===200,JSON.stringify(r.j));
 ({data:row}=await svc.from('storage_keys').select('holder_kind,holder_user_id,holder_label,holder_note').eq('id',k1).single()); ok('outsider recorded with name and contact',row.holder_kind==='person'&&row.holder_user_id===null&&row.holder_label==='Sam from facilities'&&row.holder_note==='555-0100',JSON.stringify(row));
 r=await A.call('POST',`/api/keys/${k1}/move`,{action:'give',to:{kind:'place',label:'Locked drawer, room 204'}}); ok('hand it to a place (recorded by someone who saw it)',r.s===200,JSON.stringify(r.j));
 r=await A.call('POST',`/api/keys/${k1}/move`,{action:'give',to:{kind:'place',label:'locked drawer, room 204'}}); ok('same place again is refused',r.s===400,JSON.stringify(r.j));
 r=await A.call('POST',`/api/keys/${k1}/move`,{action:'give',to:{kind:'member',user_id:old.id}}); ok('cannot hand to a non-team account',r.s===400,JSON.stringify(r.j));
 r=await A.call('POST',`/api/keys/${k1}/move`,{action:'steal'}); ok('unknown action refused',r.s===400);

 // history
 r=await A.call('GET',`/api/keys/${k1}/history`); const ev=r.j.events;
 ok('history keeps every move, newest first',ev.length===5&&ev[0].kind==='gave'&&ev[ev.length-1].kind==='created'&&ev.some(e=>e.kind==='took'&&e.actor==='Mtg b'),JSON.stringify(ev.map(e=>[e.kind,e.actor,e.from,e.to])));
 ok('history names who and where (plain names, with the kind)',ev.some(e=>e.to==='Sam from facilities'&&e.toKind==='person')&&ev.some(e=>e.to==='Locked drawer, room 204'&&e.toKind==='place')&&ev.some(e=>e.actorIsFrom===true&&e.kind==='gave')&&ev.some(e=>e.kind==='gave'&&e.actorIsFrom===false));

 // multiple keys per member -> icons data
 await C.call('POST',`/api/keys/${k2}/move`,{action:'take'}); await C.call('POST',`/api/keys/${k3}/move`,{action:'take'});
 const {data:held}=await svc.from('storage_keys').select('id').eq('holder_user_id',C.id); ok('a member can hold several keys',held.length===2,held.length);

 // add / edit / delete: exec and admin only
 r=await exec.call('GET','/api/keys'); ok('exec is told it can manage',r.j.canManage===true&&r.j.keys.every(k=>k.canEdit===true));
 r=await A.call('GET','/api/keys'); ok('officer is told it cannot',r.j.canManage===false&&r.j.keys.every(k=>k.canEdit===false));
 for(const [n,u] of [['officer',A],['lead',lead],['recruit',C]]){
   r=await u.call('PATCH',`/api/keys/${k1}`,{name:'Mtg Renamed'}); ok(`${n} cannot edit a key`,r.s===403,r.s);
   r=await u.call('DELETE',`/api/keys/${k1}`); ok(`${n} cannot delete a key`,r.s===403,r.s);
 }
 ({data:row}=await svc.from('storage_keys').select('name').eq('id',k1).single()); ok('nothing changed after the refused edits',row.name==='Mtg Storage closet');
 r=await exec.call('PATCH',`/api/keys/${k1}`,{name:'Mtg Storage closet (renamed)',color:'#a78bfa'}); ok('exec can edit',r.s===200,JSON.stringify(r.j));
 r=await exec.call('PATCH',`/api/keys/${k1}`,{color:'red'}); ok('bad color refused',r.s===400);
 r=await exec.call('DELETE',`/api/keys/${k1}`); ok('exec can delete',r.s===200,r.s);
 ({data:row}=await svc.from('storage_keys').select('id').eq('id',k1).maybeSingle()); ok('deleted key is gone',!row);
 const {data:evs}=await svc.from('storage_key_events').select('id').eq('key_id',k1); ok('its history goes with it',evs.length===0);
 r=await exec.call('DELETE',`/api/keys/${k2}`); ok('exec can delete another key',r.s===200,r.s);
 r=await A.call('GET',`/api/keys/not-a-uuid/history`); ok('bad id is a 404',r.s===404,r.s);
}catch(e){console.log('ERR',e); fails++}
finally{
  if(keyIds.length) await svc.from('storage_keys').delete().in('id',keyIds);
  await svc.from('storage_keys').delete().like('name','Mtg %');
  if(made.length) await svc.from('notifications').delete().in('user_id',made);
  for(const id of made){ await svc.auth.admin.deleteUser(id); }
  const {count}=await svc.from('storage_keys').select('id',{count:'exact',head:true}).like('name','Mtg %');
  console.log('leftover test keys:',count);
  console.log(fails?`${fails} FAILED`:'all passed'); }
