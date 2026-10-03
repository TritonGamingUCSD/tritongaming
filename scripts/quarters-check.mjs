// Drives the quarter calendar and inactive marks as temporary accounts against a running dev server, and removes everything it made. Run: npm run test:quarters
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));
const url=env.NEXT_PUBLIC_SUPABASE_URL, svc=createClient(url, env.SUPABASE_SERVICE_ROLE_KEY); const ref=new URL(url).hostname.split('.')[0];
const made=[]; const quarterIds=[]; const meetingIds=[]; let fails=0; const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL'),n,c?'':x); if(!c)fails++;};
async function user(name,roles){
  const email=`mtg-qt-${name}-${Date.now()}@example.test`; const {data}=await svc.auth.admin.createUser({email,email_confirm:true}); const id=data.user.id; made.push(id);
  await svc.from('profiles').update({display_name:'Mtg '+name,onboarded_at:new Date().toISOString(),year:'2028',class_of:2028,college:'Sixth',major:'CS',pronouns:'they/them'}).eq('id',id);
  for(const r of roles) await svc.from('user_roles').insert({user_id:id,role:r});
  const c=createClient(url,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); const {data:lk}=await svc.auth.admin.generateLink({type:'magiclink',email}); const {data:s}=await c.auth.verifyOtp({token_hash:lk.properties.hashed_token,type:'magiclink'});
  const cookie=`sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString('base64url')}`;
  const call=async(m,p,b)=>{const r=await fetch('http://localhost:3000'+p,{method:m,headers:{cookie,'content-type':'application/json'},body:b?JSON.stringify(b):undefined}); let j={}; try{j=await r.json()}catch{} return {s:r.status,j};};
  const can=async(cap)=>(await c.rpc('has_capability',{_capability:cap})).data;
  return {id,call,can};
}
const day=(n)=>new Date(Date.now()-8*3600e3+n*86400e3).toISOString().slice(0,10);
const marker=async(id)=>(await svc.from('user_roles').select('id').eq('user_id',id).eq('role','inactive')).data.length;
const notes=async(id)=>(await svc.from('notifications').select('title').eq('user_id',id).eq('type','quarter_status').order('created_at')).data.map(x=>x.title);
try{
 const admin=await user('admin',['admin']), exec=await user('exec',['exec']), A=await user('a',['officer']), L=await user('l',['lead']), R=await user('r',['recruit']), B=await user('b',['officer']);
 let r;
 // setting up quarters is admin only
 r=await exec.call('POST','/api/quarters',{term:'fall',start_year:2090,starts_on:day(-5),ends_on:day(40)}); ok('exec cannot set up quarters',r.s===403,r.s);
 r=await A.call('GET','/api/quarters'); ok('an officer cannot open Quarter status',r.s===403,r.s);
 r=await admin.call('POST','/api/quarters',{term:'fall',start_year:2090,starts_on:day(-5),ends_on:day(40)}); ok('admin adds the current quarter',r.s===201,JSON.stringify(r.j)); const fall=r.j.id; quarterIds.push(fall);
 r=await admin.call('POST','/api/quarters',{term:'winter',start_year:2090,starts_on:day(30),ends_on:day(80)}); ok('overlapping quarter rejected',r.s===400,JSON.stringify(r.j));
 r=await admin.call('POST','/api/quarters',{term:'winter',start_year:2090,starts_on:day(50),ends_on:day(100)}); ok('admin adds the next quarter',r.s===201); const winter=r.j.id; quarterIds.push(winter);
 r=await admin.call('POST','/api/quarters',{term:'fall',start_year:2089,starts_on:day(-300),ends_on:day(-200)}); ok('admin adds a past quarter',r.s===201); const past=r.j.id; quarterIds.push(past);
 r=await exec.call('GET','/api/quarters'); ok('exec sees the quarters and the officers and leads (not exec or recruits)',r.s===200&&r.j.quarters.length>=3&&r.j.people.some(p=>p.id===A.id)&&r.j.people.some(p=>p.id===L.id)&&!r.j.people.some(p=>p.id===exec.id||p.id===R.id)&&r.j.currentId===fall&&r.j.canSetup===false,JSON.stringify(r.j.quarters?.map(q=>q.name)));
 ok('only current and upcoming quarters are editable',r.j.quarters.find(q=>q.id===past).editable===false&&r.j.quarters.find(q=>q.id===fall).editable&&r.j.quarters.find(q=>q.id===winter).editable);
 // permissions before: officer can check in, lead can manage events
 ok('before: an officer can check in',await A.can('checkin')===true); ok('before: a lead can manage events',await L.can('manage_events')===true);
 // marking
 r=await exec.call('PUT','/api/quarters/status',{quarter_id:fall,user_ids:[A.id],inactive:true}); ok('exec marks an officer inactive',r.s===200&&r.j.added.length===1,JSON.stringify(r.j));
 ok('the officer carries the inactive marker',await marker(A.id)===1);
 ok('they are told',(await notes(A.id)).some(t=>/inactive for Fall 2090/.test(t)),JSON.stringify(await notes(A.id)));
 ok('inactive: can no longer check in',await A.can('checkin')===false);
 ok('inactive: can still view events, docs and members',await A.can('view_events')===true&&await A.can('view_docs')===true&&await A.can('view_members')===true);
 r=await exec.call('PUT','/api/quarters/status',{quarter_id:fall,user_ids:[L.id],inactive:true}); ok('exec marks a lead inactive',r.s===200);
 ok('inactive lead: can no longer manage events, host meetings or manage docs',await L.can('manage_events')===false&&await L.can('host_meetings')===false&&await L.can('manage_docs')===false);
 ok('inactive lead: can still view events',await L.can('view_events')===true);
 r=await exec.call('PUT','/api/quarters/status',{quarter_id:fall,user_ids:[exec.id],inactive:true}); ok('exec cannot be inactive',r.s===400,JSON.stringify(r.j));
 r=await exec.call('PUT','/api/quarters/status',{quarter_id:fall,user_ids:[R.id],inactive:true}); ok('recruits cannot be inactive',r.s===400,JSON.stringify(r.j));
 r=await exec.call('PUT','/api/quarters/status',{quarter_id:past,user_ids:[A.id],inactive:true}); ok('a past quarter cannot be changed',r.s===400,JSON.stringify(r.j));
 r=await A.call('PUT','/api/quarters/status',{quarter_id:fall,user_ids:[A.id],inactive:false}); ok('an officer cannot bring themselves back',r.s===403,r.s);
 // the effects on meetings and strikes: a meeting that ended an hour ago, for the default team roles
 const today=day(0); const {data:mt}=await svc.from('meetings').insert({title:'Quarter check meeting',meeting_date:today,starts_at:new Date(Date.now()-3*3600e3).toISOString(),ends_at:new Date(Date.now()-3600e3).toISOString(),opened_at:new Date(Date.now()-3*3600e3).toISOString()}).select('id').single(); meetingIds.push(mt.id);
 r=await exec.call('GET',`/api/meetings/${mt.id}/live`); const missing=(r.j.missing??[]).map(p=>p.id); ok('an inactive officer and lead are not in the "not here yet" list; an active officer is',r.s===200&&!missing.includes(A.id)&&!missing.includes(L.id)&&missing.includes(B.id),JSON.stringify(missing));
 r=await exec.call('GET','/api/strikes/suggestions'); const sg=(r.j.suggestions??[]).filter(x=>x.meeting_id===mt.id).map(x=>x.user_id); ok('missed-meeting suggestions skip the inactive and include the active',r.s===200&&!sg.includes(A.id)&&!sg.includes(L.id)&&sg.includes(B.id),JSON.stringify(sg));
 r=await exec.call('GET','/api/strikes'); const trk=r.j.people??[]; ok('the strike tracker still lists the inactive, flagged, so their record stays',r.s===200&&trk.find(p=>p.id===A.id)?.inactive===true&&trk.find(p=>p.id===B.id)?.inactive===false);
 r=await exec.call('POST','/api/strikes',{user_id:A.id,reason:'x',incident_date:today}); ok('no strike can be added to an inactive officer',r.s===400,JSON.stringify(r.j));
 r=await exec.call('POST','/api/strikes/vouchers',{user_id:A.id,reason:'Earned before'}); ok('a voucher can still be given to them, and stays',r.s===201);
 r=await A.call('GET','/api/strikes/mine'); ok('their voucher is on their record while inactive',r.j.vouchers===1,JSON.stringify(r.j));
 r=await exec.call('GET',`/api/meetings/attendance?from=${today}&to=${today}`); const att=(r.j.people??[]).map(p=>p.id); ok('the attendance report has the active officer (absent) and not the inactive ones',r.s===200&&att.includes(B.id)&&!att.includes(A.id)&&!att.includes(L.id),JSON.stringify(att.length));
 r=await A.call('GET','/api/strikes/mine'); ok('an inactive officer still sees their own (empty) strike page',r.s===200);
 r=await admin.call('PUT','/api/admin/roles',{userId:A.id,roles:[{role:'officer',division_id:null}]}); ok('an admin can still save the person’s roles, and the marker stays',r.s===200&&await marker(A.id)===1,JSON.stringify(r.j));
 r=await admin.call('PUT','/api/admin/roles',{userId:A.id,roles:[{role:'officer',division_id:null},{role:'inactive',division_id:null}]}); ok('the marker cannot be assigned by hand',r.s===400,r.s);
 // saving roles keeps the marker
 await svc.rpc('admin_set_user_roles',{_user_id:A.id,_roles:[{role:'officer',division_id:null}],_granted_by:admin.id}); ok('saving the person’s roles keeps the marker',await marker(A.id)===1);
 const rl=(await svc.from('role_change_log').select('before,after').eq('user_id',A.id)).data; ok('and the marker is not in the role history',JSON.stringify(rl).indexOf('inactive')<0,JSON.stringify(rl));
 // next quarter: marks for later do nothing yet; switching over
 r=await exec.call('PUT','/api/quarters/status',{quarter_id:winter,user_ids:[A.id],inactive:true}); ok('mark for the next quarter',r.s===200&&r.j.added.length===0&&r.j.removed.length===0,JSON.stringify(r.j));
 r=await admin.call('PATCH',`/api/quarters/${fall}`,{ends_on:day(-2)}); r=await admin.call('PATCH',`/api/quarters/${winter}`,{starts_on:day(-1)}); ok('the next quarter begins',r.s===200,JSON.stringify(r.j));
 ok('marked for the new quarter: still inactive',await marker(A.id)===1&&await A.can('checkin')===false);
 ok('not marked for it: the lead is active again',await marker(L.id)===0&&await L.can('manage_events')===true);
 ok('the lead is told',(await notes(L.id)).some(t=>/active again/.test(t)),JSON.stringify(await notes(L.id)));
 r=await exec.call('PUT','/api/quarters/status',{quarter_id:winter,user_ids:[A.id],inactive:false}); ok('bringing someone back',r.s===200&&r.j.removed.length===1,JSON.stringify(r.j));
 ok('active again: can check in',await marker(A.id)===0&&await A.can('checkin')===true);
 // deleting a quarter takes its marks with it
 await exec.call('PUT','/api/quarters/status',{quarter_id:winter,user_ids:[A.id],inactive:true}); ok('marked again',await marker(A.id)===1);
 r=await admin.call('DELETE',`/api/quarters/${winter}`); ok('admin deletes a quarter',r.s===200);
 ok('its marks go; the current quarter is Fall again, so Fall’s marks apply',await marker(A.id)===1&&await marker(L.id)===1);
 r=await exec.call('DELETE',`/api/quarters/${fall}`); ok('exec cannot delete a quarter',r.s===403,r.s);
}catch(e){ console.log('ERROR',e); fails++; }
finally{
 for(const id of meetingIds) await svc.from('meetings').delete().eq('id',id);
 for(const id of quarterIds) await svc.from('academic_quarters').delete().eq('id',id);
 // The roles saved by the admin point back at them (granted_by / the role history), which would stop them being deleted.
 await svc.from('user_roles').update({granted_by:null}).in('granted_by',made); await svc.from('role_change_log').delete().in('user_id',made);
 for(const id of [...made].reverse()){ await svc.from('notifications').delete().eq('user_id',id); const {error}=await svc.auth.admin.deleteUser(id); if(error) console.log('could not delete',id,error.message); }
 await svc.from('audit_log').delete().in('entity_type',['quarter','quarter status']).gte('created_at',new Date(Date.now()-3600e3).toISOString());
 const {count:q}=await svc.from('academic_quarters').select('id',{count:'exact',head:true}); const {count:m}=await svc.from('user_roles').select('id',{count:'exact',head:true}).eq('role','inactive');
 console.log('left over: quarters',q,'inactive markers',m);
 console.log(fails?`${fails} FAILED`:'ALL PASSED'); process.exit(fails?1:0);
}
