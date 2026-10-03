// Poll and rating questions, live tallies and check-in opening as soon as the host opens it. Run: npm run test:questions
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));
const url=env.NEXT_PUBLIC_SUPABASE_URL, svc=createClient(url, env.SUPABASE_SERVICE_ROLE_KEY); const ref=new URL(url).hostname.split('.')[0];
const made=[]; let mid; let fails=0; const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL'),n,c?'':x); if(!c)fails++;};
async function user(name,roles){
  const email=`mtg-q-${name}-${Date.now()}@example.test`; const {data}=await svc.auth.admin.createUser({email,email_confirm:true}); const id=data.user.id; made.push(id);
  await svc.from('profiles').update({display_name:'Mtg '+name,onboarded_at:new Date().toISOString(),year:'2028',class_of:2028,college:'Sixth',major:'CS',pronouns:'they/them'}).eq('id',id);
  for(const r of roles) await svc.from('user_roles').insert({user_id:id,role:r});
  const c=createClient(url,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); const {data:lk}=await svc.auth.admin.generateLink({type:'magiclink',email}); const {data:s}=await c.auth.verifyOtp({token_hash:lk.properties.hashed_token,type:'magiclink'});
  const cookie=`sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString('base64url')}`;
  const call=async(m,p,b)=>{const r=await fetch('http://localhost:3000'+p,{method:m,headers:{cookie,'content-type':'application/json'},body:b?JSON.stringify(b):undefined}); let j={}; try{j=await r.json()}catch{} return {s:r.status,j};};
  return {id,call};
}
try{
 const host=await user('host',['lead']), A=await user('a',['officer']), B=await user('b',['officer']), C=await user('c',['officer']);
 // starts in 3 hours: check-in must still work the moment the host opens it
 const now=Date.now(); const day=new Date(now-8*3600e3).toISOString().slice(0,10);
 const {data:m}=await svc.from('meetings').insert({title:'Mtg Question',meeting_date:day,starts_at:new Date(now+3*3600e3).toISOString(),ends_at:new Date(now+4*3600e3).toISOString(),created_by:host.id,audience:[],invitees:[A.id,B.id,C.id],group_ids:[]}).select('id').single(); mid=m.id;
 let r=await host.call('POST','/api/meetings/update',{meeting_id:mid,question:'Pick one',question_type:'poll',question_options:['Only one']}); ok('a poll needs 2 to 4 options',r.s===400,JSON.stringify(r.j));
 r=await host.call('POST','/api/meetings/update',{meeting_id:mid,question:'Controller or keyboard?',question_type:'poll',question_options:['Controller','Keyboard','Controller','']}); ok('a poll is saved (duplicates and blanks dropped)',r.s===200,JSON.stringify(r.j));
 const row=(await svc.from('meetings').select('question_type,question_options').eq('id',mid).single()).data; ok('stored as a poll with two options',row.question_type==='poll'&&row.question_options.length===2,JSON.stringify(row));
 r=await host.call('POST','/api/meetings/open',{meeting_id:mid}); ok('host opens the meeting',r.s===200,JSON.stringify(r.j));
 const code=(await host.call('GET',`/api/meetings/${mid}/live`)).j.code; ok('there is a code even though it is hours before the start',!!code);
 r=await A.call('POST','/api/meetings/check-in',{code}); ok('members can check in right away',r.s===200,JSON.stringify(r.j));
 await B.call('POST','/api/meetings/check-in',{code});
 r=await A.call('POST',`/api/meetings/${mid}/answer`,{answer:'Mouse'}); ok('an answer that is not an option is refused',r.s===400,JSON.stringify(r.j));
 r=await A.call('POST',`/api/meetings/${mid}/answer`,{answer:'Controller'}); ok('voting for an option works',r.s===200,JSON.stringify(r.j));
 await B.call('POST',`/api/meetings/${mid}/answer`,{answer:'Controller'});
 r=await A.call('GET',`/api/meetings/${mid}/results`); ok('live results for someone checked in',r.s===200&&r.j.counts.Controller===2&&r.j.counts.Keyboard===0&&r.j.total===2,JSON.stringify(r.j));
 r=await C.call('GET',`/api/meetings/${mid}/results`); ok('results are not shown to someone who has not checked in',r.s===403,r.s);
 r=await A.call('POST',`/api/meetings/${mid}/answer`,{answer:'Keyboard'}); ok('changing your vote works',r.s===200);
 r=await host.call('GET',`/api/meetings/${mid}/live`); ok('the screen gets the tally',r.j.tally.counts.Controller===1&&r.j.tally.counts.Keyboard===1&&r.j.meeting.question_type==='poll',JSON.stringify(r.j.tally));
 r=await host.call('POST','/api/meetings/update',{meeting_id:mid,question:'Controller or keyboard?',question_type:'rating'}); ok('the type is locked while check-in is open',r.s===409,r.s);
 await host.call('POST','/api/meetings/close',{meeting_id:mid});
 r=await host.call('POST','/api/meetings/update',{meeting_id:mid,question:'How hyped are you?',question_type:'rating'}); ok('after closing, switch to a rating',r.s===200,JSON.stringify(r.j));
 await svc.from('meeting_answers').delete().eq('meeting_id',mid); await host.call('POST','/api/meetings/open',{meeting_id:mid});
 r=await A.call('POST',`/api/meetings/${mid}/answer`,{answer:'7'}); ok('a rating outside 1 to 5 is refused',r.s===400);
 await A.call('POST',`/api/meetings/${mid}/answer`,{answer:'5'}); await B.call('POST',`/api/meetings/${mid}/answer`,{answer:'4'});
 r=await A.call('GET',`/api/meetings/${mid}/results`); ok('the rating average is 4.5',r.j.average===4.5&&r.j.total===2,JSON.stringify(r.j));
 const t=await A.call('GET','/api/meetings/today'); const tm=t.j.meetings.find(x=>x.id===mid); ok('the phone is told the type',tm?.question_type==='rating'&&tm.my_answer==='5',JSON.stringify(tm));
}catch(e){ console.log('ERROR',e); fails++; }
finally{
 if(mid) await svc.from('meetings').delete().eq('id',mid);
 for(const id of [...made].reverse()){ await svc.from('notifications').delete().eq('user_id',id); await svc.auth.admin.deleteUser(id); }
 console.log(fails?`${fails} FAILED`:'ALL PASSED'); process.exit(fails?1:0);
}
