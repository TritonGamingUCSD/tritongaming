-- Files are attached inside the text of a doc now (a link where the file belongs), so the separate attachments list is gone. No doc had any.
alter table public.docs drop column if exists attachments;
