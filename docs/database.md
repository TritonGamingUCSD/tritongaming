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

**Docs:** `docs`, `doc_categories` (with a color), `doc_versions` (every publish), `doc_favorites`, `doc_editing` (who has it open), `doc_required_roles` and `doc_reads` (required reading), `doc_comments` (threads), `quick_links` (the tiles on the docs home; server-only). `docs.teams` lists the teams a page is for.

**Help:** `help_tickets` (categories `bug`, `question`, `account`, `tickets`, `doc`, `other`), `help_messages`.

**Meetings and team:** `meetings`, `meeting_series`, `meeting_attendance`, `meeting_absences`, `meeting_series_absences`, `meeting_plans`, `meeting_plan_responses`, `meeting_answers`, `meeting_reactions`, `meeting_reaction_counts` and `meeting_reaction_batches` (emoji totals, counted on the host screen and saved in batches), `meeting_groups`, `custom_emojis` and `reminders_sent` (remembers who already got which reminder; also used to send once a day).

**Members and attendance:** `strikes` and its tables (`strike_events`, `strike_settings`, ...), `academic_quarters`, `quarter_roster`, `officer_quarter_status`, `team_years`, `team_year_members`, `team_settings`.

**Logistics:** `logistics_devices`, `logistics_options` (the editable dropdown lists, one table keyed by `kind`), `logistics_sponsors`, `logistics_device_log`. No client access; the routes use the service role and check `view_logistics` / `manage_logistics`.

**Other:** `notifications`, `push_subscriptions`, `push_preferences`, `audit_log`, `site_contents` and `content_drafts` (editable website text), `short_links`, `help_canned_replies`.

## Test data

Never test against real events or docs. Create throwaway rows (names starting `ZZ`), and delete them and their audit lines afterwards. See [testing.md](testing.md).

## Features that were removed

The older migration files stay as history, but these no longer exist in the live database (the last two migrations, `20261007100000` and `20261014100000`, finish the clean-up):

- **Shifts:** `event_shifts`, `shift_stations`, `shift_signups`, `shift_overrides`, `shift_event_guides`, `shift_templates`, `shift_absences`, `shift_exemptions`, `shift_cover_requests`, `shift_checklist_items`, `shift_handoff_notes` and the functions `claim_shift`, `take_shift_cover`, `undo_shift_cover`.
- **Storage keys:** `storage_keys`, `storage_key_events`.
- **Internal events:** `internal_events`, `internal_event_rsvps`.
- **Portal photo albums:** `photo_albums`. (An event's own albums are the `events.photo_albums` column and are still there.)
- **Referrals (invite a friend):** `profiles.referral_code`, `profiles.referred_by`, `point_transactions.related_user_id`, the `referral_bonus` ledger type and the `referral_bonus_points()` function (migration `20261015130000`). `award_checkin_points`, `reverse_checkin`, `reverse_point_transaction`, `handle_new_user` and `admin_delete_account` were rewritten without them. Nothing had ever been referred or paid.
- **Calendar:** `calendar_connections` (the Google Calendar link) and `profiles.calendar_token` (the subscription link).
- **Meeting "private" flag:** `meetings.is_private` and `meeting_series.is_private` (it only hid a meeting from the removed "All TG meetings" calendar).

When you drop a table, also search the SQL functions for it (`select proname from pg_proc where pg_get_functiondef(oid) ~ 'table_name'`, limited to normal functions): deleting an event, deleting an account and the admin activity feed all read `photo_albums` and would have failed until they were rewritten.
