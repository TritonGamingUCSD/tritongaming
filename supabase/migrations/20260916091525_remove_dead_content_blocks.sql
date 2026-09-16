-- 'homepage.recruitment' and 'page.about' were editable in the Content
-- Editor but never actually fetched by any page render (verified by
-- grepping every getContentBlock/getContentBlocks call site) — removed
-- from the block registry in content-blocks.ts; this drops their now
-- orphaned rows so the admin doesn't see stale, unreachable "content" sitting
-- in the database.
delete from public.site_contents where key in ('homepage.recruitment', 'page.about');
