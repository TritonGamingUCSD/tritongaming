// Excusing someone for EVERY week of a repeating meeting, as temporary accounts against a running dev server. Run: npm run test:series-absence
import { svc, url, env, day, tracker, accounts } from './lib.mjs';
let seriesId; const t=tracker(); const ok=t.ok;
const { user, made, cleanup } = accounts('sa');
const wd=(d)=>new Date(d+'T12:00:00Z').getUTCDay();
try{
 const host=await user('host',['lead']), A=await user('a',['officer']), B=await user('b',['officer']), X=await user('x',['officer']);
 const d1=day(3), d2=day(10), d3=day(17), weekday=wd(d1);
 const {data:ser}=await svc.from('meeting_series').insert({title:'Mtg Series Absence',weekday,start_time:'17:00',end_time:'18:00',audience:[],invitees:[A.id,B.id],group_ids:[],created_by:host.id}).select('id').single(); seriesId=ser.id;
 let r=await X.call('POST','/api/meetings/absence',{series_id:seriesId,date:d1,user_id:A.id,repeat:true}); ok('an officer cannot excuse people',r.s===403,r.s);
 r=await host.call('GET',`/api/meetings/absence?series_id=${seriesId}&date=${d1}`); ok('a repeating meeting says so',r.s===200&&r.j.repeating===true&&r.j.absences.length===0,JSON.stringify(r.j));
 r=await host.call('POST','/api/meetings/absence',{series_id:seriesId,date:d1,user_id:A.id,reason:'Standing class',repeat:false}); ok('excuse for just one week',r.s===200);
 ok('that does not touch the series',(await svc.from('meeting_series_absences').select('user_id').eq('series_id',seriesId)).data.length===0);
 r=await host.call('GET',`/api/meetings/absence?series_id=${seriesId}&date=${d2}`); ok('another week is not excused',r.j.absences.length===0);
 r=await host.call('POST','/api/meetings/absence',{series_id:seriesId,date:d1,user_id:A.id,reason:'Standing class',repeat:true}); ok('excuse every week',r.s===200,JSON.stringify(r.j));
 const st=(await svc.from('meeting_series_absences').select('user_id,reason,excused,plan_id').eq('series_id',seriesId)).data; ok('the series remembers it',st.length===1&&st[0].user_id===A.id&&st[0].reason==='Standing class'&&st[0].excused===true&&st[0].plan_id===null,JSON.stringify(st));
 r=await host.call('GET',`/api/meetings/absence?series_id=${seriesId}&date=${d2}`); ok('a later week shows them, marked every week',r.j.absences.length===1&&r.j.absences[0].every_week===true&&r.j.absences[0].user_id===A.id,JSON.stringify(r.j));
 // a week that already exists (made by someone excusing B for it) gets A too once it is created
 r=await host.call('POST','/api/meetings/absence',{series_id:seriesId,date:d3,user_id:B.id,reason:'Sick'}); ok('another person excused for one later week',r.s===200);
 const occ3=(await svc.from('meetings').select('id').eq('series_id',seriesId).eq('meeting_date',d3).single()).data.id;
 ok('that week starts with the every-week person already excused',(await svc.from('meeting_absences').select('user_id,excused').eq('meeting_id',occ3)).data.some(a=>a.user_id===A.id&&a.excused));
 // an existing coming week that was made BEFORE the every-week mark is updated too
 r=await host.call('POST','/api/meetings/absence',{series_id:seriesId,date:d3,user_id:B.id,reason:'Away',repeat:true}); ok('excuse another person every week',r.s===200);
 const occ2=(await svc.from('meetings').select('id').eq('series_id',seriesId).eq('meeting_date',d2).maybeSingle()).data;
 r=await host.call('POST','/api/meetings/absence',{series_id:seriesId,date:d2,user_id:X.id,reason:'once'}); const occ2b=(await svc.from('meetings').select('id').eq('series_id',seriesId).eq('meeting_date',d2).single()).data.id;
 ok('the week that now exists has both every-week people',(await svc.from('meeting_absences').select('user_id').eq('meeting_id',occ2b)).data.filter(a=>[A.id,B.id].includes(a.user_id)).length===2);
 // excused counts for the attendance report
 // stopping
 r=await host.call('DELETE','/api/meetings/absence',{series_id:seriesId,date:d1,user_id:A.id,repeat:true}); ok('stop excusing every week',r.s===200);
 ok('the series forgets them',(await svc.from('meeting_series_absences').select('user_id').eq('series_id',seriesId).eq('user_id',A.id)).data.length===0);
 ok('and the coming weeks that exist lose the mark',(await svc.from('meeting_absences').select('user_id').in('meeting_id',[occ3,occ2b]).eq('user_id',A.id)).data.length===0);
 ok('the other every-week person stays',(await svc.from('meeting_series_absences').select('user_id').eq('series_id',seriesId).eq('user_id',B.id)).data.length===1);
 // an opened week is left alone
 await svc.from('meetings').update({opened_at:new Date().toISOString()}).eq('id',occ3);
 r=await host.call('DELETE','/api/meetings/absence',{series_id:seriesId,date:d1,user_id:B.id,repeat:true}); ok('stopping again works (from another week)',r.s===200);
 ok('a week that is already open keeps its marks',(await svc.from('meeting_absences').select('user_id').eq('meeting_id',occ3).eq('user_id',B.id)).data.length===1);
 // a one-off meeting cannot be excused every week
 const {data:one}=await svc.from('meetings').insert({title:'Mtg one-off',meeting_date:d1,starts_at:new Date(Date.now()+3*86400e3).toISOString(),ends_at:new Date(Date.now()+3*86400e3+3600e3).toISOString(),created_by:host.id,audience:[],invitees:[A.id],group_ids:[]}).select('id').single();
 r=await host.call('POST','/api/meetings/absence',{meeting_id:one.id,user_id:A.id,repeat:true}); ok('a one-off meeting cannot be excused every week',r.s===400,JSON.stringify(r.j)); await svc.from('meetings').delete().eq('id',one.id);
}catch(e){ console.log('ERROR',e); t.fail(); }
finally{
 if(seriesId){ await svc.from('meetings').delete().eq('series_id',seriesId); await svc.from('meeting_series').delete().eq('id',seriesId); }
 await svc.from('audit_log').delete().eq('entity_type','meeting attendance').like('summary','%Mtg Series Absence%');
 await cleanup();
 process.exit(t.result());
}
