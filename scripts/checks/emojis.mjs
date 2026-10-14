// Club custom emojis (upload, approval, reactions) as temporary accounts against a running dev server. Run: npm run test:emojis
import { svc, url, env, day, tracker, accounts } from './lib.mjs';
let meetingId; const t=tracker(); const ok=t.ok;
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const { user: baseUser, made, cleanup } = accounts('em');
async function user(name,roles){
  const u=await baseUser(name,roles); const cookie=u.cookie;
  const up=async(name,bytes,type='image/png')=>{const fd=new FormData(); fd.append('file',new Blob([bytes],{type}),'x.png'); fd.append('name',name); const r=await fetch('http://localhost:3000/api/meetings/emojis',{method:'POST',headers:{cookie},body:fd}); let j={}; try{j=await r.json()}catch{} return {s:r.status,j};};
  const upD=async(name,discord)=>{const fd=new FormData(); fd.append('discord',discord); fd.append('name',name); const r=await fetch('http://localhost:3000/api/meetings/emojis',{method:'POST',headers:{cookie},body:fd}); let j={}; try{j=await r.json()}catch{} return {s:r.status,j};};
  return {id:u.id,call:u.call,up,upD};
}
try{
 const officer=await user('officer',['officer']), exec=await user('exec',['exec']), nobody=await user('nobody',[]);
 let r=await nobody.up('mtgtest_a',PNG); ok('someone outside the team cannot upload',r.s===403,r.s);
 r=await officer.up('mtgtest_a',Buffer.from('not an image at all')); ok('a non-image is refused',r.s===400,JSON.stringify(r.j));
 r=await officer.up('Bad Name!',PNG); ok('a bad name is refused',r.s===400);
 r=await officer.up('mtgtest_a',Buffer.concat([PNG,Buffer.alloc(4*1024*1024+10)])); ok('over 4 MB is refused',r.s===400);
 r=await officer.up('mtgtest_a',PNG); ok('an officer can upload',r.s===200&&r.j.approved===false,JSON.stringify(r.j));
 r=await officer.up('MTGTEST_A',PNG); ok('names are unique regardless of case',r.s===409,r.s);
 r=await officer.call('GET','/api/meetings/emojis'); ok('it is waiting, not approved',r.s===200&&r.j.approved.every(e=>e.name!=='mtgtest_a')&&r.j.mine.some(e=>e.name==='mtgtest_a')&&r.j.queue.length===0,JSON.stringify(r.j));
 const id=r.j.mine.find(e=>e.name==='mtgtest_a').id; ok('the picture is reachable',(await fetch(r.j.mine[0].url)).ok);
 r=await exec.call('GET','/api/meetings/emojis'); ok('exec sees it in the queue',r.j.manage===true&&r.j.queue.some(e=>e.id===id));
 r=await officer.call('PATCH',`/api/meetings/emojis/${id}`); ok('an officer cannot approve',r.s===403,r.s);
 r=await exec.call('PATCH',`/api/meetings/emojis/${id}`); ok('exec approves',r.s===200);
 r=await officer.call('GET','/api/meetings/emojis'); ok('now everyone sees it',r.j.approved.some(e=>e.id===id));
 r=await officer.call('DELETE',`/api/meetings/emojis/${id}`); ok('an officer cannot delete an approved one',r.s===403,r.s);
 r=await exec.up('mtgtest_b',PNG); ok('exec uploads go live straight away',r.s===200&&r.j.approved===true,JSON.stringify(r.j));
 r=await officer.upD('mtgtest_d','https://evil.example.com/emojis/123456789012345678.png'); ok('only Discord emoji addresses are accepted',r.s===400,JSON.stringify(r.j));
 r=await officer.upD('mtgtest_d','<:nope:123456789012345678>'); ok('a Discord emoji that does not exist is refused kindly',r.s===400&&/Discord/.test(r.j.error||''),JSON.stringify(r.j));
 // jpg in, small webp out
 const sharp=(await import('sharp')).default;
 const big=await sharp({create:{width:1200,height:800,channels:3,background:{r:200,g:30,b:90}}}).jpeg({quality:100}).toBuffer();
 r=await exec.up('mtgtest_jpg',big,'image/jpeg'); ok('a jpg is accepted',r.s===200,JSON.stringify(r.j));
 const jr=(await svc.from('custom_emojis').select('path').eq('name','mtgtest_jpg').single()).data; const sv=await fetch(svc.storage.from('custom-emojis').getPublicUrl(jr.path).data.publicUrl); const sb=Buffer.from(await sv.arrayBuffer()); const meta=await sharp(sb).metadata();
 ok('it is saved as a 128px square webp',jr.path.endsWith('.webp')&&meta.format==='webp'&&meta.width===128&&meta.height===128&&sb.length<big.length/5,`${meta.format} ${meta.width}x${meta.height} ${sb.length}/${big.length}`);
 // reactions with a custom emoji
 const now=Date.now();
 const {data:m,error:me}=await svc.from('meetings').insert({title:'Mtg Emoji',meeting_date:new Date(now-8*3600e3).toISOString().slice(0,10),starts_at:new Date(now-600e3).toISOString(),ends_at:new Date(now+3000e3).toISOString(),opened_at:new Date(now-600e3).toISOString(),created_by:exec.id,audience:[],invitees:[officer.id],group_ids:[]}).select('id').single(); if(me) console.log(me); meetingId=m.id;
 await svc.from('meeting_attendance').insert({meeting_id:meetingId,user_id:officer.id});
 r=await officer.call('POST',`/api/meetings/${meetingId}/react`,{emoji:`custom:${id}`}); ok('react with a custom emoji',r.s===200&&!r.j.throttled,JSON.stringify(r.j));
 r=await officer.call('POST',`/api/meetings/${meetingId}/react`,{emoji:'🔥'}); ok('a plain emoji is no longer accepted',r.s===400,r.s);
 r=await officer.call('POST',`/api/meetings/${meetingId}/react`,{emoji:'custom:00000000-0000-0000-0000-000000000000'}); ok('an unknown custom emoji is refused',r.s===400,r.s);
 r=await exec.call('GET',`/api/meetings/${meetingId}/live`); ok('the screen gets the picture and the total',r.s===200&&r.j.customEmojis?.[id]?.url&&r.j.reactionTotals[`custom:${id}`]===1,JSON.stringify(r.j.reactionTotals));
 // removal
 r=await exec.call('DELETE',`/api/meetings/emojis/${id}`); ok('exec removes it',r.s===200);
 r=await exec.call('GET','/api/meetings/emojis'); ok('it is gone',!r.j.approved.some(e=>e.id===id));
}catch(e){ console.log('ERROR',e); t.fail(); }
finally{
 const {data:rows}=await svc.from('custom_emojis').select('id,path').like('name','mtgtest_%');
 if(rows?.length){ await svc.storage.from('custom-emojis').remove(rows.map(x=>x.path)); await svc.from('custom_emojis').delete().in('id',rows.map(x=>x.id)); }
 if(meetingId) await svc.from('meetings').delete().eq('id',meetingId);
 for(const id of made) await svc.from('custom_emojis').delete().eq('created_by',id);
 await cleanup();
 process.exit(t.result());
}
