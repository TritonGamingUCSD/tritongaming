// Drives the meeting-plan API routes as temporary accounts (lead, officers, a stranger) against a running dev server, and removes
// everything it made. Invitees are the temporary accounts only, so nobody real is notified. Run: npm run test:plans
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));
const url=env.NEXT_PUBLIC_SUPABASE_URL, svc=createClient(url, env.SUPABASE_SERVICE_ROLE_KEY); const ref=new URL(url).hostname.split('.')[0];
const made=[]; let fails=0; const ok=(n,c,x='')=>{console.log((c?'PASS':'FAIL'),n,c?'':x); if(!c)fails++;};
async function user(name,roles){
  const email=`mtg-plan-${name}-${Date.now()}@example.test`; const {data}=await svc.auth.admin.createUser({email,email_confirm:true}); const id=data.user.id; made.push(id);
  await svc.from('profiles').update({display_name:'Mtg '+name,onboarded_at:new Date().toISOString(),year:'2028',class_of:2028,college:'Sixth',major:'CS',pronouns:'they/them'}).eq('id',id);
  for(const r of roles) await svc.from('user_roles').insert({user_id:id,role:r});
  const c=createClient(url,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); const {data:lk}=await svc.auth.admin.generateLink({type:'magiclink',email}); const {data:s}=await c.auth.verifyOtp({token_hash:lk.properties.hashed_token,type:'magiclink'});
  const cookie=`sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString('base64url')}`;
  const call=async(m,p,b)=>{const r=await fetch('http://localhost:3000'+p,{method:m,headers:{cookie,'content-type':'application/json'},body:b?JSON.stringify(b):undefined}); let j={}; try{j=await r.json()}catch{} return {s:r.status,j};};
  return {id,call};
}
const day=(n)=>{const d=new Date(Date.now()-8*3600e3+n*86400e3); return d.toISOString().slice(0,10)};
try{
 const host=await user('host',['lead']), A=await user('a',['officer']), B=await user('b',['officer']), C=await user('c',['recruit']), X=await user('x',['officer']);
 const aud={audience:[],group_ids:[],invitees:[A.id,B.id,C.id]};
 const base={kind:'once',title:'Mtg Plan Test',duration_min:60,window_start:'09:00',window_end:'12:00',range_start:day(1),range_end:day(3),...aud};
 let r=await host.call('POST','/api/meeting-plans',{...base,range_end:day(30)}); ok('range over 14 days rejected',r.s===400,JSON.stringify(r.j));
 r=await A.call('POST','/api/meeting-plans',base); ok('officer cannot create',r.s===403,r.s);
 r=await host.call('POST','/api/meeting-plans',base); ok('lead creates plan',r.s===201,JSON.stringify(r.j)); const pid=r.j.id;
 // notifications
 const {data:n1}=await svc.from('notifications').select('user_id').eq('type','meeting_invite').ilike('title','When can you meet%').in('user_id',[A.id,B.id,C.id,host.id]); ok('invitees notified, host not',n1.length===3&&!n1.some(x=>x.user_id===host.id),JSON.stringify(n1));
 r=await X.call('GET','/api/meeting-plans'); ok('stranger sees no plan',r.s===200&&r.j.plans.length===0,JSON.stringify(r.j).slice(0,100));
 r=await A.call('GET','/api/meeting-plans'); ok('invited person sees plan, host in people',r.j.plans.length===1&&r.j.plans[0].people.some(p=>p.id===host.id)&&r.j.plans[0].days.length===3,JSON.stringify(r.j.plans?.[0]?.people));
 const d1=day(1), d2=day(2);
 r=await A.call('PUT',`/api/meeting-plans/${pid}/availability`,{slots:{[d1]:{'09:00':1,'09:30':1,'10:00':2},[day(9)]:{'09:00':1},[d2]:{'09:15':1}}}); ok('A saves availability',r.s===200,JSON.stringify(r.j));
 r=await B.call('PUT',`/api/meeting-plans/${pid}/availability`,{slots:{[d1]:{'09:00':1,'09:30':1,'10:00':1,'10:30':1}}}); ok('B saves',r.s===200);
 r=await host.call('PUT',`/api/meeting-plans/${pid}/availability`,{slots:{[d1]:{'09:00':1,'09:30':1,'10:00':1}}}); ok('host fills own time',r.s===200);
 r=await X.call('PUT',`/api/meeting-plans/${pid}/availability`,{slots:{}}); ok('stranger cannot answer',r.s===403,r.s);
 r=await B.call('GET','/api/meeting-plans'); const pv=r.j.plans[0]; ok('everyone sees results with names; bad slots cleaned',Object.keys(pv.responses).length===3&&!pv.responses[A.id][day(9)]&&!pv.responses[A.id][d2],JSON.stringify(pv.responses[A.id]));
 // a day that is yesterday drops out
 await svc.from('meeting_plans').update({range_start:day(-1)}).eq('id',pid);
 r=await host.call('GET','/api/meeting-plans'); ok('past day removed from plan',r.j.plans[0].days.length===4&&!r.j.plans[0].days.includes(day(-1)),JSON.stringify(r.j.plans[0].days)); await svc.from('meeting_plans').update({range_start:day(1)}).eq('id',pid);
 r=await B.call('POST',`/api/meeting-plans/${pid}/action`,{action:'decide',day:d1,start:'09:00'}); ok('non-host cannot decide',r.s===403,r.s);
 r=await host.call('POST',`/api/meeting-plans/${pid}/action`,{action:'decide',day:d1,start:'11:30'}); ok('start must fit window',r.s===400,JSON.stringify(r.j));
 r=await host.call('POST',`/api/meeting-plans/${pid}/action`,{action:'nudge'}); ok('nudge reaches non-responder only',r.s===200&&r.j.reminded===1,JSON.stringify(r.j));
 r=await host.call('POST',`/api/meeting-plans/${pid}/action`,{action:'nudge'}); ok('second reminder within 12 hours is refused',r.s===429,JSON.stringify(r.j));
 // 09:30-10:30: A has 09:30 avail,10:00 if-needed -> ok (if needed); decide 10:00-11:00: A has 10:00 ifneeded,10:30 unmarked -> unavailable; C no answer -> expected
 r=await host.call('POST',`/api/meeting-plans/${pid}/action`,{action:'decide',day:d1,start:'10:00'}); ok('host decides',r.s===200&&r.j.absent.length===1&&r.j.absent[0]==='Mtg a',JSON.stringify(r.j)); const mid=r.j.meeting_id;
 const {data:abs}=await svc.from('meeting_absences').select('user_id,reason,excused').eq('meeting_id',mid); ok('only unavailable person absent (excused, reason)',abs.length===1&&abs[0].user_id===A.id&&abs[0].excused===true&&abs[0].reason==='Not available at the chosen time',JSON.stringify(abs));
 const {data:mt}=await svc.from('meetings').select('title,starts_at,created_by,invitees').eq('id',mid).single(); ok('meeting created for host with audience',mt.created_by===host.id&&mt.invitees.length===3,JSON.stringify(mt));
 r=await A.call('PUT',`/api/meeting-plans/${pid}/availability`,{slots:{}}); ok('answers locked after decided',r.s===409,r.s);
 r=await host.call('POST',`/api/meeting-plans/${pid}/action`,{action:'reopen'}); ok('host reopens',r.s===200,JSON.stringify(r.j));
 const {data:gone}=await svc.from('meetings').select('id').eq('id',mid); ok('meeting removed on reopen',gone.length===0);
 r=await A.call('PUT',`/api/meeting-plans/${pid}/availability`,{slots:{[d1]:{'09:00':1,'09:30':1,'10:00':1,'10:30':1}}}); ok('answers unlocked after reopen',r.s===200);
 // edit dates keeps answers
 r=await host.call('PATCH',`/api/meeting-plans/${pid}`,{range_start:day(2),range_end:day(4)}); ok('host edits dates after answers',r.s===200,JSON.stringify(r.j));
 r=await host.call('GET','/api/meeting-plans'); ok('removed day hidden',!r.j.plans[0].days.includes(d1)&&r.j.plans[0].days.length===3,JSON.stringify(r.j.plans[0].days));
 r=await host.call('PATCH',`/api/meeting-plans/${pid}`,{range_start:d1,range_end:day(3)}); r=await host.call('GET','/api/meeting-plans'); ok('answers return when day returns',!!r.j.plans[0].responses[B.id]?.[d1]?.['09:00'],JSON.stringify(r.j.plans[0].responses[B.id]));
 const {data:n2}=await svc.from('notifications').select('title').in('user_id',[A.id]).ilike('title','%dates changed%'); ok('dates-changed notice sent',n2.length>=1);
 // weekly plan
 const wk={kind:'weekly',title:'Mtg Weekly Test',duration_min:60,window_start:'17:00',window_end:'20:00',...aud};
 r=await host.call('POST','/api/meeting-plans',wk); ok('weekly plan',r.s===201,JSON.stringify(r.j)); const wid=r.j.id;
 await A.call('PUT',`/api/meeting-plans/${wid}/availability`,{slots:{'3':{'17:00':1,'17:30':1}}}); await B.call('PUT',`/api/meeting-plans/${wid}/availability`,{slots:{'3':{'17:00':1,'17:30':1},'2':{'18:00':1,'18:30':1}}});
 r=await host.call('POST',`/api/meeting-plans/${wid}/action`,{action:'decide',weekday:2,start:'18:00'}); ok('weekly decide Tuesday: A absent',r.s===200&&r.j.absent.join()==='Mtg a',JSON.stringify(r.j)); const sid=r.j.series_id;
 const {data:ss}=await svc.from('meeting_series').select('weekday,start_time,end_time,title').eq('id',sid).single(); ok('series created',ss.weekday===2&&ss.start_time.startsWith('18:00')&&ss.end_time.startsWith('19:00'),JSON.stringify(ss));
 const {data:sa}=await svc.from('meeting_series_absences').select('user_id').eq('series_id',sid); ok('standing absence for A',sa.length===1&&sa[0].user_id===A.id);
 // an upcoming Tuesday occurrence materialized => A absent
 let tue=day(1); while(new Date(tue+'T12:00:00Z').getUTCDay()!==2) tue=day(1+(new Date(tue+'T12:00:00Z')-new Date(day(1)+'T12:00:00Z'))/86400e3+1);
 r=await host.call('GET',`/api/meetings/absence?series_id=${sid}&date=${tue}`); ok('virtual occurrence shows standing absence',r.s===200&&r.j.absences.length===1&&r.j.absences[0].user_id===A.id,JSON.stringify(r.j).slice(0,200));
 r=await host.call('POST','/api/meetings/absence',{series_id:sid,date:tue,user_id:C.id,reason:'test'}); const {data:occ}=await svc.from('meetings').select('id').eq('series_id',sid).eq('meeting_date',tue).single(); const {data:oa}=await svc.from('meeting_absences').select('user_id').eq('meeting_id',occ.id); ok('materialized occurrence copies standing absences',oa.some(x=>x.user_id===A.id)&&oa.some(x=>x.user_id===C.id),JSON.stringify(oa));
 r=await host.call('POST',`/api/meeting-plans/${wid}/action`,{action:'reopen'}); ok('weekly reopen removes series',r.s===200,JSON.stringify(r.j)); const {data:s2}=await svc.from('meeting_series').select('id').eq('id',sid); ok('series gone',s2.length===0);
 // a time already on someone's calendar is unavailable for sure, and an empty grid is not an answer
 const pl2=await host.call('POST','/api/meeting-plans',{kind:'once',title:'Mtg Busy Test',duration_min:60,window_start:'09:00',window_end:'12:00',range_start:day(2),range_end:day(3),audience:[],group_ids:[],invitees:[A.id,B.id]}); const p2=pl2.j.id;
 const bm=await host.call('POST','/api/meetings/schedule',{title:'Mtg Busy Meeting',repeat:'once',date:day(2),start:'09:00',end:'10:00',audience:[],group_ids:[],invitees:[A.id]});
 r=await A.call('GET','/api/meeting-plans'); const bp=r.j.plans.find(x=>x.id===p2); ok('my calendar shows as busy',bp.busy.some(b=>b.day===day(2)&&b.start==='09:00'&&b.end==='10:00'&&b.title==='Mtg Busy Meeting'),JSON.stringify(bp.busy));
 r=await B.call('GET','/api/meeting-plans'); ok('someone not in that meeting has no busy time',r.j.plans.find(x=>x.id===p2).busy.length===0);
 await A.call('PUT',`/api/meeting-plans/${p2}/availability`,{slots:{[day(2)]:{'09:00':1,'09:30':1,'10:00':1,'10:30':2}}});
 const {data:sv}=await svc.from('meeting_plan_responses').select('slots').eq('plan_id',p2).eq('user_id',A.id).single(); ok('busy slots are not saved as available',!sv.slots[day(2)]['09:00']&&!sv.slots[day(2)]['09:30']&&sv.slots[day(2)]['10:00']===1,JSON.stringify(sv.slots));
 await B.call('PUT',`/api/meeting-plans/${p2}/availability`,{slots:{}});
 r=await host.call('GET','/api/meeting-plans'); const hp=r.j.plans.find(x=>x.id===p2); ok('empty grid is not an answer; real answer is',!hp.responses[B.id]&&!!hp.responses[A.id],JSON.stringify(Object.keys(hp.responses)));
 r=await host.call('POST',`/api/meeting-plans/${p2}/action`,{action:'nudge'}); ok('empty-grid person is still reminded',r.s===200&&r.j.reminded===1,JSON.stringify(r.j));
 await B.call('PUT',`/api/meeting-plans/${p2}/availability`,{slots:{[day(2)]:{'09:00':1,'09:30':1,'10:00':1,'10:30':1,'11:00':1}}});
 r=await host.call('GET','/api/meeting-plans'); ok('host sees what blocks A (for ranking)',(r.j.plans.find(x=>x.id===p2).blocked[A.id]??[]).some(b=>b.title==='Mtg Busy Meeting'),JSON.stringify(r.j.plans.find(x=>x.id===p2).blocked));
 r=await host.call('POST',`/api/meeting-plans/${p2}/action`,{action:'decide',day:day(2),start:'09:00'}); ok('time blocked for A: A absent, C stays expected',r.s===200&&r.j.absent.join()==='Mtg a',JSON.stringify(r.j));
 const {data:ba}=await svc.from('meeting_absences').select('user_id,reason').eq('meeting_id',r.j.meeting_id); ok('absent reason names what blocks the time',ba.length===1&&ba[0].reason.includes('Mtg Busy Meeting')&&ba[0].reason.startsWith('Not available at the chosen time'),JSON.stringify(ba));
 await host.call('POST',`/api/meeting-plans/${p2}/action`,{action:'reopen'});
 await host.call('DELETE',`/api/meeting-plans/${p2}`); if(bm.j.id) await svc.from('meetings').delete().eq('id',bm.j.id);
 // a weekly meeting can have a last day: nothing shows after it, in the schedule or the calendar
 const wd=new Date(day(1)+'T12:00:00Z').getUTCDay();
 const ser=await host.call('POST','/api/meetings/schedule',{title:'Mtg Ends Test',repeat:'weekly',weekday:wd,start:'09:00',end:'10:00',ends_on:day(9),audience:[],group_ids:[],invitees:[A.id]}); ok('weekly meeting with a last day',ser.s===201,JSON.stringify(ser.j));
 r=await host.call('POST','/api/meetings/schedule',{title:'Mtg Ends Test',repeat:'weekly',weekday:wd,start:'09:00',end:'10:00',ends_on:day(-3),audience:[],group_ids:[],invitees:[A.id]}); ok('a last day in the past is refused',r.s===400,JSON.stringify(r.j));
 r=await host.call('GET','/api/meetings/schedule'); const mine=r.j.upcoming.filter(x=>x.series_id===ser.j.id); ok('no occurrences after the last day',mine.length>=1&&mine.every(x=>x.date<=day(9)),JSON.stringify(mine.map(x=>x.date)));
 r=await A.call('GET',`/api/calendar?from=${day(0)}&to=${day(60)}`); const cal=(r.j.items??[]).filter(x=>x.title==='Mtg Ends Test'); ok('calendar stops at the last day',cal.length>=1&&cal.every(x=>x.date<=day(9)),JSON.stringify(cal.map(x=>x.date)));
 r=await host.call('PATCH',`/api/meetings/series/${ser.j.id}`,{ends_on:null}); const {data:cleared}=await svc.from('meeting_series').select('ends_on').eq('id',ser.j.id).single(); ok('clearing the last day removes it',r.s===200&&cleared.ends_on===null,JSON.stringify(cleared));
 await svc.from('meeting_series').delete().eq('id',ser.j.id);
 // someone added to a saved group later is asked to everything the group was chosen for
 const D=await user('d',['officer']);
 r=await host.call('POST','/api/meetings/groups',{name:'Mtg Group Test',member_ids:[A.id]}); const gid=r.j.group?.id??r.j.id; ok('group created',r.s<300&&!!gid,JSON.stringify(r.j));
 const gAud={audience:[],invitees:[D.id],group_ids:[gid]};
 const gm=await host.call('POST','/api/meetings/schedule',{title:'Mtg Group Meeting',repeat:'once',date:day(2),start:'10:00',end:'11:00',...gAud}); ok('meeting for a group',gm.s===201,JSON.stringify(gm.j));
 const gp=await host.call('POST','/api/meeting-plans',{kind:'weekly',title:'Mtg Group Plan',duration_min:60,window_start:'17:00',window_end:'20:00',...gAud}); ok('plan for a group',gp.s===201,JSON.stringify(gp.j));
 const ge=await host.call('POST','/api/internal-events',{title:'Mtg Group Event',date:day(2),start:'12:00',end:'13:00',...gAud}); ok('internal event for a group',ge.s===201,JSON.stringify(ge.j));
 await svc.from('notifications').delete().in('user_id',[A.id,B.id,C.id,D.id]);
 r=await host.call('PATCH',`/api/meetings/groups/${gid}`,{member_ids:[A.id,B.id,C.id,D.id]}); ok('group updated',r.s===200,JSON.stringify(r.j));
 const gn=async(u)=>((await svc.from('notifications').select('title').eq('user_id',u).ilike('title','%Mtg Group%')).data??[]).map(x=>x.title).sort();
 const nb=await gn(B.id), na=await gn(A.id), nd=await gn(D.id);
 ok('new member told about the meeting, the event and the plan',nb.length===3&&nb.some(t=>t.includes('Meeting'))&&nb.some(t=>t.includes('Event'))&&nb.some(t=>t.includes('Plan')),JSON.stringify(nb));
 ok('existing member not told again',na.length===0,JSON.stringify(na));
 ok('person already invited directly not told twice',nd.length===0,JSON.stringify(nd));
 r=await host.call('PATCH',`/api/meetings/groups/${gid}`,{member_ids:[A.id,B.id,C.id,D.id]}); const nb2=await gn(B.id); ok('saving again with no new people sends nothing more',nb2.length===3,JSON.stringify(nb2));
 await host.call('DELETE',`/api/meeting-plans/${gp.j.id}`); await svc.from('meetings').delete().eq('id',gm.j.id); await svc.from('internal_events').delete().eq('id',ge.j.id); await host.call('DELETE',`/api/meetings/groups/${gid}`);
 // reminders after 24h
 await svc.from('meeting_plans').update({created_at:new Date(Date.now()-30*3600e3).toISOString()}).eq('id',pid);
 const {sendPlanReminders}=await import('/Users/jasperhuang/Repositories/tritongaming/src/lib/meetings/meetingPlanServer.ts').catch(()=>({}));
 r=await host.call('DELETE',`/api/meeting-plans/${pid}`); ok('host deletes open plan',r.s===200); r=await host.call('DELETE',`/api/meeting-plans/${wid}`);
}catch(e){console.log('ERR',e); fails++}
finally{
  // clean up: every notification the test caused (to the temporary accounts), then the accounts themselves
  if(made.length) await svc.from('notifications').delete().in('user_id',made);
  for(const id of made){ await svc.auth.admin.deleteUser(id);}
  const {data:stray}=await svc.from('notifications').select('id,title').or('title.ilike.%Mtg Plan%,title.ilike.%Mtg Weekly%,title.ilike.%Mtg Busy%,title.ilike.%Mtg Group%,title.ilike.%Mtg Reminder%'); if(stray?.length){ await svc.from('notifications').delete().in('id',stray.map(x=>x.id)); console.log('removed',stray.length,'stray test notifications'); } else console.log('no test notifications left behind');
  console.log(fails?`${fails} FAILED`:'all passed'); }
