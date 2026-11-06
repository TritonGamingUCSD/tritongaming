-- Word filter: explicit body words refuse the save (the clinical ones stay on the warning list). "cum laude" is allowed as a phrase. Words are rot13-encoded. Safe to run more than once.
insert into public.word_filter_terms (term, kind, partial, builtin)
select translate(w, 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm'), 'block', false, true
from unnest(string_to_array('gvgf,obbof,qvyqb,phz,pyvg,wvfz,ahgfnpx,xabpxref,ivoengbe,obare,sryyngvb,phaavyvathf,znfgheongr,fbqbzvmr,rwnphyngr', ',')) as w
on conflict (term, kind) do nothing;
delete from public.word_filter_terms where kind = 'warn' and term in (select translate(w, 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm') from unnest(string_to_array('gvgf,obbof,qvyqb,phz,pyvg,wvfz,ahgfnpx,xabpxref,ivoengbe,obare,sryyngvb,phaavyvathf,znfgheongr,fbqbzvmr,rwnphyngr', ',')) as w);
insert into public.word_filter_terms (term, kind, partial, builtin)
select translate(w, 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm'), 'allow', false, true
from unnest(string_to_array('phz ynhqr,zntan phz ynhqr,fhzzn phz ynhqr', ',')) as w
on conflict (term, kind) do nothing;
