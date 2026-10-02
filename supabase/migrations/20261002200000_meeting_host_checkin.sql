-- A host who opens check-in for a meeting they're invited to is checked in automatically (method 'host').
alter table public.meeting_attendance drop constraint if exists meeting_attendance_method_check;
alter table public.meeting_attendance
  add constraint meeting_attendance_method_check check (method in ('code', 'manual', 'host'));
