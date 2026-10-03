// Drives the strike tracker as temporary accounts against a running dev server, and removes everything it made. It sends a header that makes the
// server skip alerts to HR and admins (those would reach real people; production ignores it). Run: npm run test:strikes
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));
const url=env.NEXT_PUBLIC_SUPABASE_URL, svc=createClient(url, env.SUPABASE_SERVICE_ROLE_KEY); const ref=new URL(url).hostname.split('.')[0];
const startedAt=new Date().toISOString(); const made=[]; let fails=0; const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL'),n,c?'':x); if(!c)fails++;}; const grantIds=[]; const meetingIds=[];
async function user(name,roles){
  const email=`mtg-strike-${name}-${Date.now()}@example.test`; const {data}=await svc.auth.admin.createUser({email,email_confirm:true}); const id=data.user.id; made.push(id);
  await svc.from('profiles').update({display_name:'Mtg '+name,onboarded_at:new Date().toISOString(),year:'2028',class_of:2028,college:'Sixth',major:'CS',pronouns:'they/them'}).eq('id',id);
  for(const r of roles) await svc.from('user_roles').insert({user_id:id,role:r});
  const c=createClient(url,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); const {data:lk}=await svc.auth.admin.generateLink({type:'magiclink',email}); const {data:s}=await c.auth.verifyOtp({token_hash:lk.properties.hashed_token,type:'magiclink'});
  const cookie=`sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString('base64url')}`;
  const call=async(m,p,b)=>{const r=await fetch('http://localhost:3000'+p,{method:m,headers:{cookie,'content-type':'application/json','x-strikes-test':'1'},body:b?JSON.stringify(b):undefined}); let j={}; try{j=await r.json()}catch{} return {s:r.status,j};};
  return {id,call};
}
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date());
try{
 const exec=await user('exec',['exec']), exec2=await user('exec2',['exec']), lead=await user('lead',['lead']), A=await user('a',['officer']), B=await user('b',['officer']);
 let r;
 // Exec add strikes directly: no draft, no approval. Leads can only request.
 r=await lead.call('POST','/api/strikes',{user_id:A.id,reason:'x',incident_date:today}); ok('a lead cannot add a strike',r.s===403,r.s);
 r=await lead.call('GET','/api/strikes'); ok('a lead cannot open the tracker',r.s===403,r.s);
 r=await A.call('POST','/api/strikes/vouchers',{user_id:B.id,reason:'x'}); ok('an officer cannot give a voucher',r.s===403,r.s);
 r=await exec.call('POST','/api/strikes',{user_id:A.id,reason:'Missed the gen meeting',incident_date:today,category:'meeting'}); ok('exec adds a strike directly',r.s===201,JSON.stringify(r));
 const sid=r.j.id;
 r=await A.call('GET','/api/strikes/mine'); ok('it shows for the person immediately',r.j.active===1&&r.j.strikes[0].reason==='Missed the gen meeting',JSON.stringify(r.j));
 r=await exec.call('PATCH',`/api/strikes/${sid}`,{action:'remove'}); ok('taking a strike away needs a reason',r.s===400,r.s);
 r=await exec.call('PATCH',`/api/strikes/${sid}`,{action:'remove',reason:'Was excused after all'}); ok('exec takes it away with a reason',r.s===200,r.s);
 r=await A.call('GET','/api/strikes/mine'); ok('the person sees the reason, not who did it',r.j.active===0&&r.j.history.some(e=>e.kind==='strike_removed'&&e.reason==='Was excused after all')&&!JSON.stringify(r.j).includes(exec.id));
 r=await exec.call('PATCH',`/api/strikes/${sid}`,{action:'reinstate'}); ok('reinstating needs a reason',r.s===400,r.s);
 r=await exec.call('PATCH',`/api/strikes/${sid}`,{action:'reinstate',reason:'Excuse was not valid'}); ok('reinstate with a reason',r.s===200,r.s);
 // Vouchers
 r=await exec.call('POST','/api/strikes/vouchers',{user_id:B.id}); ok('a voucher needs a reason',r.s===400,r.s);
 r=await exec.call('POST','/api/strikes/vouchers',{user_id:B.id,reason:'Ran the tabling shift'}); ok('give a voucher',r.s===201&&!r.j.usedOnStrike,JSON.stringify(r));
 const vid=r.j.id;
 r=await exec.call('DELETE',`/api/strikes/vouchers/${vid}`,{}); ok('removing a voucher needs a reason',r.s===400,r.s);
 r=await B.call('DELETE',`/api/strikes/vouchers/${vid}`,{reason:'x'}); ok('the person cannot remove their own voucher',r.s===403,r.s);
 r=await exec.call('DELETE',`/api/strikes/vouchers/${vid}`,{reason:'Given by mistake'}); ok('exec removes it with a reason',r.s===200,r.s);
 r=await B.call('GET','/api/strikes/mine'); const v=r.j.voucherList[0]; ok('the person sees it was removed and why',r.j.vouchers===0&&v.removed_reason==='Given by mistake'&&r.j.history.some(e=>e.kind==='voucher_removed'&&e.reason==='Given by mistake'),JSON.stringify(r.j));
 r=await exec.call('POST','/api/strikes',{user_id:B.id,reason:'No-show',incident_date:today}); r=await B.call('GET','/api/strikes/mine'); ok('a removed voucher is not spent on a new strike',r.j.active===1,JSON.stringify(r.j));
 r=await exec.call('POST','/api/strikes/vouchers',{user_id:B.id,reason:'Great event'}); ok('a voucher given to someone with a strike removes it at once',r.s===201&&r.j.usedOnStrike);
 r=await B.call('GET','/api/strikes/mine'); ok('so they are back to 0, with a used voucher in the history',r.j.active===0&&r.j.history.some(e=>e.kind==='voucher_used'),JSON.stringify(r.j));
 // A voucher waits and is used automatically on the next strike
 r=await exec.call('POST','/api/strikes/vouchers',{user_id:A.id,reason:'Helped set up'}); const early=r.j.usedOnStrike; 
 r=await exec.call('GET',`/api/strikes/people/${A.id}`); ok('exec sees the history with who did it',r.s===200&&r.j.events.every(e=>e.by),JSON.stringify(r.j.events));
 // Nobody changes their own record
 r=await exec.call('POST','/api/strikes',{user_id:exec.id,reason:'x',incident_date:today}); ok('nobody adds a strike to themselves',r.s===403,r.s);
 r=await exec.call('POST','/api/strikes/vouchers',{user_id:exec.id,reason:'x'}); ok('nor gives themselves a voucher',r.s===403,r.s);
 // Warning + 3 strikes: the first mark is the Warning, the limit is 3 strikes (4 marks)
 const W=await user('w',['officer']); const add=(u,t)=>exec.call('POST','/api/strikes',{user_id:u.id,reason:t,incident_date:today});
 await add(W,'one'); r=await W.call('GET','/api/strikes/mine'); ok('the first mark is a Warning',r.j.active===1&&!r.j.atLimit&&r.j.strikes[0].mark==='Warning',JSON.stringify(r.j));
 ok('the history says Warning added, with the reason, and never who',r.j.history.some(e=>e.kind==='strike_added'&&e.label==='Warning'&&e.reason==='one')&&!JSON.stringify(r.j).includes(exec.id)&&!JSON.stringify(r.j).includes('actor'),JSON.stringify(r.j.history));
 await add(W,'two'); await add(W,'three'); r=await W.call('GET','/api/strikes/mine'); ok('three marks is 2 strikes, not at the limit',r.j.active===3&&!r.j.atLimit&&r.j.strikes.some(x=>x.mark==='Strike 2'));
 let n=(await svc.from('notifications').select('body').eq('user_id',W.id).eq('type','strike_update')).data; ok('no limit notice before 3 strikes',!n.some(x=>/HR team will be contacting you/.test(x.body)));
 await add(W,'four'); r=await W.call('GET','/api/strikes/mine'); ok('warning + 3 strikes is the limit',r.j.atLimit&&r.j.strikes.some(x=>x.mark==='Strike 3'),JSON.stringify(r.j));
 n=(await svc.from('notifications').select('body').eq('user_id',W.id).eq('type','strike_update')).data; ok('they are told the HR team will contact them',n.some(x=>/HR team will be contacting you/.test(x.body)));
 ok('and nothing mentions a reason',n.every(x=>!/one|two|three|four/.test(x.body)));
 // A voucher removes the oldest mark, which is the warning; the next one becomes the warning
 r=await exec.call('POST','/api/strikes/vouchers',{user_id:W.id,reason:'Helped out'}); ok('a voucher removes the warning',r.j.usedOnStrike);
 r=await W.call('GET','/api/strikes/mine'); ok('the next oldest becomes the Warning and they are off the limit',r.j.active===3&&!r.j.atLimit&&r.j.strikes.find(x=>x.reason==='two').mark==='Warning',JSON.stringify(r.j.strikes.map(x=>[x.reason,x.mark,x.status])));
 // A waiting voucher removes the OLDEST strike when a new one is added; the rest move up (Strike 1 becomes the Warning)
 const V=await user('v',['officer']); const addOn=(u,t,d)=>exec.call('POST','/api/strikes',{user_id:u.id,reason:t,incident_date:d});
 const ago=(n)=>new Date(Date.now()-n*86400e3).toISOString().slice(0,10);
 await addOn(V,'newer',ago(1)); await exec.call('POST','/api/strikes/vouchers',{user_id:V.id,reason:'Earned'});   // removes the only strike at once
 await exec.call('POST','/api/strikes/vouchers',{user_id:V.id,reason:'Earned again'});   // waits (no strikes)
 r=await addOn(V,'later',ago(0)); ok('a waiting voucher is used when a strike is added',r.j.voucherUsed===true,JSON.stringify(r.j));
 r=await V.call('GET','/api/strikes/mine'); ok('it removed the oldest happened, so the count did not go up',r.j.active===0,JSON.stringify(r.j.strikes.map(x=>[x.reason,x.status])));
 const V2=await user('v2',['officer']); await addOn(V2,'oldest',ago(5)); await addOn(V2,'middle',ago(3)); await addOn(V2,'newest',ago(1));
 r=await exec.call('POST','/api/strikes/vouchers',{user_id:V2.id,reason:'Earned'});
 const left=await svc.from('strike_vouchers').select('id',{count:'exact',head:true}).eq('user_id',V2.id); ok('a voucher is deleted once it is used (one voucher, one strike)',left.count===0,left.count);
 r=await V2.call('GET','/api/strikes/mine'); const pick=(t)=>r.j.strikes.find(x=>x.reason===t);
 ok('a voucher removes the oldest and the rest move up one',pick('oldest').status==='removed'&&pick('middle').mark==='Warning'&&pick('newest').mark==='Strike 1',JSON.stringify(r.j.strikes.map(x=>[x.reason,x.mark,x.status])));
 // Reset
 r=await lead.call('POST','/api/strikes/reset',{reason:'x'}); ok('a lead cannot reset',r.s===403,r.s);
 r=await exec.call('POST','/api/strikes/reset',{}); ok('a reset needs a reason',r.s===400,r.s);
 r=await exec.call('POST','/api/strikes/reset',{user_id:exec.id,reason:'x'}); ok('nobody resets themselves',r.s===403,r.s);
 const mk=async(t)=>{const {data}=await svc.from('meetings').insert({title:t,meeting_date:today,starts_at:new Date(Date.now()-3*3600e3).toISOString(),ends_at:new Date(Date.now()-60e3).toISOString(),opened_at:new Date(Date.now()-3*3600e3).toISOString()}).select('id').single(); meetingIds.push(data.id); return data.id;};
 const K=await user('k',['officer']); await exec.call('POST','/api/strikes/vouchers',{user_id:K.id,reason:'Carries over'});
 const old0=await mk('Strike check old meeting'); r=await exec.call('GET','/api/strikes/suggestions'); ok('a miss before the reset is suggested',r.j.suggestions.some(x=>x.user_id===W.id&&x.meeting_id===old0));
 await add(exec2,'mine'); r=await exec.call('POST','/api/strikes/reset',{reason:'Test quarter reset'}); ok('exec resets everyone',r.s===200&&r.j.people>=1,JSON.stringify(r));
 r=await W.call('GET','/api/strikes/mine'); ok('their record is gone, leaving only the reset and its reason',r.j.active===0&&r.j.strikes.length===0&&r.j.history.length===1&&r.j.history[0].kind==='strikes_reset'&&r.j.history[0].reason==='Test quarter reset',JSON.stringify(r.j));
 const gone=await svc.from('strikes').select('id',{count:'exact',head:true}).eq('user_id',W.id); ok('the old strikes are deleted from the database',gone.count===0);
 const au=await svc.from('audit_log').select('id',{count:'exact',head:true}).in('entity_type',['strike','strike voucher']); ok('and so are the strike lines in the audit log',au.count===0,au.count);
 r=await K.call('GET','/api/strikes/mine'); ok('an unused voucher carries over a reset',r.j.vouchers===1&&r.j.voucherList[0].reason==='Carries over',JSON.stringify(r.j));
 r=await exec.call('GET','/api/strikes/suggestions'); ok('misses from before the reset do not come back',!r.j.suggestions.some(x=>x.user_id===W.id&&x.meeting_id===old0));
 r=await exec2.call('GET','/api/strikes/mine'); ok('a bulk reset skips the person doing it',r.j.active===0);
 r=await exec2.call('GET','/api/strikes/mine'); r=await exec.call('GET','/api/strikes/mine'); 
 r=await exec2.call('POST','/api/strikes/reset',{user_id:A.id,reason:'Single reset'}); ok('a single person can be reset too',r.s===200,r.s);
 await svc.from('strike_cleared').delete().in('user_id',made);   // as if a new quarter has started
 // Missed meetings: shown the moment the meeting ends; excuse (with a reason), dismiss, add a strike; decided ones move to "past"
 const {data:mt}=await svc.from('meetings').insert({title:'Strike check meeting',meeting_date:today,starts_at:new Date(Date.now()-3*3600e3).toISOString(),ends_at:new Date(Date.now()-60e3).toISOString(),opened_at:new Date(Date.now()-3*3600e3).toISOString()}).select('id').single(); meetingIds.push(mt.id);
 const mine=async()=>(await exec.call('GET','/api/strikes/suggestions')).j; const k=(u)=>({user_id:u.id,meeting_id:mt.id});
 let j=await mine(); ok('a miss shows right after the meeting ends (no 24h wait)',[A,B,lead].every(u=>j.suggestions.some(x=>x.user_id===u.id&&x.meeting_id===mt.id)));
 r=await exec.call('POST','/api/strikes/suggestions',{action:'excuse',items:[k(A)]}); ok('excusing needs a reason',r.s===400,r.s);
 r=await exec.call('POST','/api/strikes/suggestions',{action:'excuse',reason:'Marked absent by mistake',items:[k(A)]}); ok('excuse with a reason',r.s===200,r.s);
 r=await exec.call('POST','/api/strikes/suggestions',{action:'dismiss',reason:'Was sick',items:[k(B)]}); ok('dismiss',r.s===200,r.s);
 r=await exec.call('POST','/api/strikes/suggestions',{action:'add',items:[k(lead)]}); ok('add a strike for a miss',r.s===201,r.s);
 j=await mine(); ok('decided ones leave the list',!j.suggestions.some(x=>x.meeting_id===mt.id&&[A,B,lead].some(u=>u.id===x.user_id)));
 const po=(u)=>j.past.find(x=>x.user_id===u.id&&x.meeting_id===mt.id);
 ok('dismissed and struck ones appear in past with their reason; excused ones appear nowhere on this page',!po(A)&&po(B)?.outcome==='dismissed'&&po(B).reason==='Was sick'&&po(lead)?.outcome==='strike',JSON.stringify(j.past));
 const {data:ab}=await svc.from('meeting_absences').select('excused,reason').eq('meeting_id',mt.id).eq('user_id',A.id).single(); ok('excusing records the normal excused absence',ab.excused&&ab.reason==='Marked absent by mistake');
 r=await exec.call('POST','/api/strikes/suggestions',{action:'undo',items:[k(lead)]}); ok('a strike can’t be put back from here',r.s===404,r.s);
 r=await exec.call('POST','/api/strikes/suggestions',{action:'undo',items:[k(B)]}); ok('a dismissed one can be put back',r.s===200,r.s);
 j=await mine(); ok('it is back on the list, but the excused one stays off',j.suggestions.some(x=>x.user_id===B.id&&x.meeting_id===mt.id)&&!j.suggestions.some(x=>x.user_id===A.id&&x.meeting_id===mt.id));
 r=await lead.call('POST','/api/strikes/suggestions',{action:'excuse',reason:'x',items:[k(B)]}); ok('a lead cannot excuse',r.s===403,r.s);
}catch(e){ console.log('ERROR',e); fails++; }
finally{
 // The bulk reset test touches every real tracked person's "cleared" marker and writes strike lines to the audit log: undo both.
 await svc.from('strike_cleared').delete().gte('cleared_at',startedAt); await svc.from('audit_log').delete().like('entity_type','strike%').gte('created_at',startedAt);
 for(const id of meetingIds) await svc.from('meetings').delete().eq('id',id);
 for(const id of made){ await svc.from('notifications').delete().eq('user_id',id); await svc.auth.admin.deleteUser(id); }
 const {count}=await svc.from('strikes').select('id',{count:'exact',head:true}).in('user_id',made.length?made:['00000000-0000-0000-0000-000000000000']); console.log('left over strikes for test users:',count);
 console.log(fails?`${fails} FAILED`:'ALL PASSED'); process.exit(fails?1:0);
}
