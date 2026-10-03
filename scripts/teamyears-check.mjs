// Drives the yearly team records and the graduate-to-alumni move as temporary accounts against a running dev server, and removes everything it made.
// It never turns the automatic alumni move on while it runs a sync, and only moves its own test accounts. Run: npm run test:teamyears
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));
const url=env.NEXT_PUBLIC_SUPABASE_URL, svc=createClient(url, env.SUPABASE_SERVICE_ROLE_KEY); const ref=new URL(url).hostname.split('.')[0];
const made=[]; const quarterIds=[]; const years=[2080,2085,2086,2090]; let fails=0; const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL'),n,c?'':x); if(!c)fails++;};
async function user(name,roles,profile={}){
  const email=`mtg-ty-${name}-${Date.now()}@example.test`; const {data}=await svc.auth.admin.createUser({email,email_confirm:true}); const id=data.user.id; made.push(id);
  await svc.from('profiles').update({display_name:'Mtg '+name,onboarded_at:new Date().toISOString(),year:'2028',class_of:2028,college:'Sixth',major:'CS',pronouns:'they/them',...profile}).eq('id',id);
  for(const r of roles) await svc.from('user_roles').insert({user_id:id,role:r});
  const c=createClient(url,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); const {data:lk}=await svc.auth.admin.generateLink({type:'magiclink',email}); const {data:s}=await c.auth.verifyOtp({token_hash:lk.properties.hashed_token,type:'magiclink'});
  const cookie=`sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString('base64url')}`;
  const call=async(m,p,b)=>{const r=await fetch('http://localhost:3000'+p,{method:m,headers:{cookie,'content-type':'application/json'},body:b?JSON.stringify(b):undefined}); let j={}; try{j=await r.json()}catch{} return {s:r.status,j};};
  return {id,call};
}
const day=(n)=>new Date(Date.now()-8*3600e3+n*86400e3).toISOString().slice(0,10);
const q=async(term,y,s,e)=>{const {data}=await svc.from('academic_quarters').insert({term,start_year:y,starts_on:day(s),ends_on:day(e)}).select('id').single(); quarterIds.push(data.id); return data.id;};
const roster=(qid,u,tier,title)=>svc.from('quarter_roster').insert({quarter_id:qid,user_id:u.id,tier,title,name:'Mtg x',last_seen:day(-100)});
const mark=(qid,u)=>svc.from('officer_quarter_status').insert({quarter_id:qid,user_id:u.id});
const member=(list,u)=>list.find(m=>m.user_id===u.id);
try{
 const admin=await user('admin',['admin']), exec=await user('exec',['exec']);
 const A=await user('a',['officer'],{org_title:'Marketing Officer'}), L=await user('l',['lead'],{org_title:'Events Lead'}), E=await user('e',['exec'],{org_title:'President'});
 const I=await user('i',['officer']), M=await user('m',['officer']), X=await user('x',['alumni']), G=await user('g',['officer'],{class_of:2020}), H=await user('h',['officer'],{class_of:2020}), F=await user('f',['officer'],{class_of:2099});
 // a finished academic year, 2085-86: fall, winter, spring
 const f=await q('fall',2085,-200,-130), w=await q('winter',2085,-120,-60), sp=await q('spring',2085,-50,-5);
 for(const qq of [f,w,sp]){ await roster(qq,A,'officer','Marketing Officer'); await roster(qq,E,'exec','President'); await roster(qq,I,'officer','Idle'); await roster(qq,M,'officer','Maybe'); await roster(qq,G,'officer','Grad'); await roster(qq,H,'officer','Grad2'); }
 await roster(f,L,'officer','Old title'); await roster(w,L,'officer','Old title'); await roster(sp,L,'lead','Events Lead'); await roster(f,X,'officer','Left early');
 for(const qq of [f,w,sp]) await mark(qq,I).then(()=>{}); await mark(f,M); await mark(w,M); for(const qq of [f,w,sp]) await mark(qq,H);
 let r=await A.call('GET','/api/team-years'); ok('an officer cannot read the yearly lists',r.s===403,r.s);
 r=await exec.call('GET','/api/team-years'); const y85=r.j.years?.find(y=>y.start_year===2085);
 ok('exec sees the year, built from its quarters (not archived yet)',r.s===200&&y85&&!y85.archived&&y85.label==='2085-86',JSON.stringify(y85?.label));
 ok('active in any quarter counts: officer, exec, someone active only in Spring, and someone who left early (6 people with the graduate)',!!member(y85.members,A)&&!!member(y85.members,E)&&!!member(y85.members,M)&&!!member(y85.members,X));
 ok('inactive all year is not counted',!member(y85.members,I)&&!member(y85.members,H));
 ok('the highest title wins, with the title from the quarter they held it',member(y85.members,L)?.tier==='lead'&&member(y85.members,L)?.title==='Events Lead'&&member(y85.members,E)?.tier==='exec');
 // archive
 r=await exec.call('POST','/api/team-years/2085',{action:'archive'}); ok('exec records the year',r.s===200&&r.j.count===6,JSON.stringify(r.j));
 r=await exec.call('GET','/api/team-years'); const a85=r.j.years.find(y=>y.start_year===2085); ok('it is now archived with the same people',a85.archived&&a85.members.length===6&&!!member(a85.members,L));
 // admin edits
 r=await exec.call('POST','/api/team-years/2085',{action:'add',name:'Nope',tier:'officer'}); ok('exec cannot add to a year',r.s===403,r.s);
 const lm=member(a85.members,L);
 r=await exec.call('PATCH',`/api/team-years/members/${lm.id}`,{title:'x'}); ok('exec cannot edit a year',r.s===403,r.s);
 r=await admin.call('PATCH',`/api/team-years/members/${lm.id}`,{title:'Head of Events'}); ok('admin edits a title',r.s===200);
 r=await admin.call('POST','/api/team-years/2085',{action:'archive'}); r=await admin.call('GET','/api/team-years'); const b85=r.j.years.find(y=>y.start_year===2085); ok('a rebuild keeps what an admin edited',member(b85.members,L)?.title==='Head of Events'&&b85.members.length===6,JSON.stringify(member(b85.members,L)));
 r=await admin.call('POST','/api/team-years/2080',{action:'add',name:'Old Timer',tier:'officer',title:'Treasurer'}); ok('admin adds someone by name to an earlier year',r.s===201,JSON.stringify(r.j)); const ot=r.j.id;
 r=await admin.call('POST','/api/team-years/2080',{action:'add',user_id:X.id,tier:'lead'}); ok('or an existing member',r.s===201); const xm=r.j.id;
 r=await admin.call('POST','/api/team-years/2080',{action:'add',user_id:X.id,tier:'lead'}); ok('not the same person twice',r.s===400,r.s);
 r=await admin.call('GET','/api/team-years'); const y80=r.j.years.find(y=>y.start_year===2080); ok('the earlier year lists them',y80?.members.length===2&&y80.archived);
 r=await admin.call('DELETE',`/api/team-years/members/${xm}`); ok('admin removes one',r.s===200);
 // the daily job: a finished year gets archived by itself; today's roster is recorded
 const f6=await q('fall',2086,-300,-250), s6=await q('spring',2086,-240,-210); await roster(s6,A,'officer','Marketing Officer'); await roster(f6,L,'lead','Events Lead');
 const cur=await q('fall',2090,-3,60); await mark(cur,H);   // H sits this quarter out too, so they were never active on record
 r=await fetch('http://localhost:3000/api/cron/team-sync',{headers:{'x-cron-dev':'1'}}); const cj=await r.json(); ok('the daily job runs',r.status===200&&cj.captured>=1,JSON.stringify(cj));
 ok('it archived the finished year by itself (marked automatic)',(await svc.from('team_years').select('auto').eq('start_year',2086).single()).data?.auto===true);
 ok('and recorded who held a title this quarter',(await svc.from('quarter_roster').select('user_id').eq('quarter_id',cur).eq('user_id',A.id)).data.length===1);
 ok('moving to alumni did not run (the setting is off)',cj.moved===0);
 // alumni
 r=await exec.call('GET','/api/team-years'); const cand=r.j.candidates.map(c=>c.id);
 ok('graduates who were active are ready for Alumni',cand.includes(G.id));
 ok('not the one who was inactive the whole time, nor someone who has not graduated',!cand.includes(H.id)&&!cand.includes(F.id));
 r=await exec.call('POST','/api/team-years/alumni',{action:'move',user_ids:[G.id]}); ok('exec cannot move graduates',r.s===403,r.s);
 r=await admin.call('POST','/api/team-years/alumni',{action:'move',user_ids:[G.id,H.id]}); ok('admin moves them (only the ready one)',r.s===200&&r.j.moved===1,JSON.stringify(r.j));
 const roles=(await svc.from('user_roles').select('role').eq('user_id',G.id)).data.map(x=>x.role); ok('they are alumni and no longer an officer',roles.includes('alumni')&&!roles.includes('officer'),JSON.stringify(roles));
 ok('the person who was not ready kept their role',(await svc.from('user_roles').select('role').eq('user_id',H.id)).data.some(x=>x.role==='officer'));
 r=await admin.call('POST','/api/team-years/alumni',{action:'auto',on:true}); ok('the automatic move can be switched on',r.s===200); r=await exec.call('GET','/api/team-years'); ok('and shows as on',r.j.autoAlumni===true);
 r=await admin.call('POST','/api/team-years/alumni',{action:'auto',on:false}); r=await exec.call('GET','/api/team-years'); ok('and off again',r.j.autoAlumni===false);
}catch(e){ console.log('ERROR',e); fails++; }
finally{
 for(const y of years) await svc.from('team_years').delete().eq('start_year',y);
 for(const id of quarterIds) await svc.from('academic_quarters').delete().eq('id',id);
 await svc.from('team_settings').upsert({key:'auto_alumni',value:'off'},{onConflict:'key'});
 await svc.from('user_roles').update({granted_by:null}).in('granted_by',made); await svc.from('role_change_log').delete().in('user_id',made);
 for(const id of [...made].reverse()){ await svc.from('notifications').delete().eq('user_id',id); const {error}=await svc.auth.admin.deleteUser(id); if(error) console.log('could not delete',id,error.message); }
 await svc.from('audit_log').delete().eq('entity_type','team year').gte('created_at',new Date(Date.now()-3600e3).toISOString());
 const {count:t}=await svc.from('team_years').select('start_year',{count:'exact',head:true}); const {count:q2}=await svc.from('academic_quarters').select('id',{count:'exact',head:true});
 console.log('left over: team years',t,'quarters',q2); console.log(fails?`${fails} FAILED`:'ALL PASSED'); process.exit(fails?1:0);
}
