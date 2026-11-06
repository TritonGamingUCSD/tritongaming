-- Word filter: more words, from the club's list. Hard slurs and swears refuse the save; mild swears, insults, body words and identity words (gay, queer) only warn (saved, flagged in the log).
-- Words are rot13-encoded here. Words already on a list are left alone, and a word already blocked is not added to the warning list. Safe to run more than once.
insert into public.word_filter_terms (term, kind, partial, builtin)
select translate(w, 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm'), 'block', false, true
from unnest(string_to_array('avttre,snt,pbpxfhpxre,puvax,zbgureshpxre,ohggshpx,ovgpu,ergneq,qlxr,juber,chffl,fyhg,ubzb,shpx,fuvgurnq,yrfob,nffubyr,cevpx,fxnax,fcvp,xvxr,pbpx,tbbx,gjng,onfgneq,fuvg,phag,qvpx,ubbxre,oybjwbo,evzwbo', ',')) as w
on conflict (term, kind) do nothing;
insert into public.word_filter_terms (term, kind, partial, builtin)
select t, 'warn', false, true from (select translate(w, 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm') as t from unnest(string_to_array('tnl,dhrre,ybfre,tbqqnza,ahgfnpx,zbeba,fbqbzvmr,qhzo,pyvg,gvgf,qvyqb,fghcvq,vqvbg,ohyyfuvg,znfgheongr,nff,wrex,xabpxref,pnfgengr,ivoengbe,gheq,nahf,whtf,phz,obare,qrsrpngr,fhpx,wvfz,fpebghz,ubeal,cvff,penc,rwnphyngr,crpxre,cravf,uhzc,sryyngvb,qnza,intvan,sbeavpngr,phaavyvathf,obbof,uryy,avccyrf,fperj,ynzr,sneg,grfgvpyrf,fangpu,onyyf,betnfz,qbex,rkperzrag,frzra,oernfgf,pbvghf,obbgl,crr,ohgg,pyvznk,enaql', ',')) as w) x
where not exists (select 1 from public.word_filter_terms b where b.term = x.t and b.kind = 'block')
on conflict (term, kind) do nothing;
