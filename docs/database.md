# Database

## Security model

Most tables have **row level security on and no policies for portal data**. The portal reads and writes through **API routes using the service role**, and each route checks who is calling. Treat the route's check as the boundary. Public data (events, divisions, site content) has small, explicit read policies.

## Migrations

Every change is a new file in `supabase/migrations` named `YYYYMMDDHHMMSS_description.sql`. Keep them additive where you can (add a column, add a table). Apply to the linked project with:

```
npx supabase db query --linked -f supabase/migrations/<file>.sql
```

Check the result with a `select` afterwards. This runs on the **live** database, so commit the file with the code that needs it, and apply it before or with the deploy.

## Tables by area

**People and access:** `profiles`, `profile_private`, `user_roles`, `role_capabilities` (what each role can do), `capability_grants` (one-off capabilities for one person), `role_change_log`, `divisions`.

**Events and rewards:** `events`, `tickets`, `ticket_checkins` (one row per ticket per day), `event_feedback`, `checkin_form_settings`, `point_transactions`, `reward_items`, `reward_redemptions`, `tier_definitions`.

**Shifts**
- `event_shifts` the grid for one event (start, end, slot length, signup open, requirement).
- `shift_stations` the stations; `shift_overrides` per-slot headcount changes.
- `shift_signups` who is on which station and slot; `arrived_at` marks "I'm here".
- `shift_event_guides` per-event location, notes and script for a station; `shift_templates` saved write-ups.
- `shift_absences` time people are away; `shift_exemptions` exempt from the requirement.
- `shift_cover_requests` swap and cover requests (`open`, `taken`, `cancelled`, `undone`; `alerted_at` / `alerted_final_at` stamp the exec alerts).
- `shift_checklist_items` a checklist per event and station; the tick is on the row (`done_by`, `done_at`).
- `shift_handoff_notes` notes for the next person at a station.
- Functions: `claim_shift` (locks the slot so a cell can never be over-filled), `take_shift_cover` and `undo_shift_cover` (move a shift in one step).

**Docs:** `docs`, `doc_categories` (with a color), `doc_versions` (every publish), `doc_favorites`, `doc_editing` (who has it open), `doc_required_roles` and `doc_reads` (required reading), `doc_comments` (threads).

**Help:** `help_tickets` (categories `bug`, `question`, `account`, `tickets`, `doc`, `other`), `help_messages`.

**Meetings and team:** `meetings`, `meeting_series`, `meeting_attendance`, `meeting_absences`, `meeting_series_absences`, `meeting_plans`, `meeting_plan_responses`, `meeting_answers`, `meeting_reactions`, `meeting_groups`, `custom_emojis`, `internal_events`, `internal_event_rsvps`, and `reminders_sent` (remembers who already got which reminder; also used to send once a day).

**Members and attendance:** `strikes` and its tables (`strike_events`, `strike_settings`, ...), `academic_quarters`, `quarter_roster`, `officer_quarter_status`, `team_years`, `team_year_members`, `team_settings`.

**Other:** `notifications`, `push_subscriptions`, `push_preferences`, `audit_log`, `storage_keys` and `storage_key_events`, `site_contents` and `content_drafts` (editable website text), `short_links`, `photo_albums`, `calendar_connections`, `help_canned_replies`.

## Test data

Never test against real events or docs. Create throwaway rows (names starting `ZZ`), and delete them and their audit lines afterwards. See [testing.md](testing.md).
