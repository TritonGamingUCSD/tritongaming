# Features reference

How the main pieces work and where the code is. Each section names the files so you can start reading in the right place.

## Shifts

Code: `src/app/(portal)/portal/shifts`, `src/app/api/shifts`, `src/lib/shifts`, `src/app/print/shifts`.

- **Grid:** `event_shifts` defines an event's slots; `shift_signups` holds who is on which station and slot. `claim_shift` (SQL) is the only way to join, so a cell can't be over-filled and nobody is on two stations at once.
- **Guides:** per station (`shift_stations`) with per-event changes (`shift_event_guides`). The guide also holds the **checklist** and the **hand-off note**.
- **Checklists:** exec writes one item per line in Setup → Guides (`api/shifts/[eventId]/guide`). People on that station tick items (`api/.../checklist`); the tick is shared. Exec sees the result in People → Checklists (`ChecklistSummary.tsx`).
- **Hand-off notes:** anyone on a station leaves a note for the next person (`api/.../handoff`). The newest three show at the top of the station's guide.
- **Swap and cover:** a person asks for cover on a shift they hold (`api/.../cover`, action `ask`). Exec and people already working that event who are free in that slot get a bell. Anyone eligible takes it (`take`; SQL `take_shift_cover` moves it in one step). The requester and exec are told; exec can `undo`. If nobody takes it, exec is alerted after 3 hours and again within 2 hours of the shift (`shiftReminders.ts` → `alertStaleCovers`; it runs from the daily job and whenever someone opens the grid, because a daily job alone can't be that exact).
- **Reminders:** the morning of an event, each person with a shift that day gets one bell and push (`sendShiftReminders`, called from the `meeting-reminders` job).
- **Dashboard card:** "Now and next" (`NowNext.tsx`) shows the shift you are on or next, and close to the start brings in the checklist, the last note and a link to ask for cover.
- **Print:** `/print/shifts/[eventId]` is the staff sheet.

## Meetings (live screen)

Code: `src/app/(portal)/portal/meetings`, `src/app/api/meetings`, `src/lib/meetings`.

- The projector screen (`api/meetings/[id]/live`) refreshes when the server sends a signal (`notifyMeetingLive`, called after a check-in, answer, reaction or excuse) and every 30 seconds as a backstop. Only reactions newer than a cursor are returned; totals come every eighth refresh.
- People answering a poll or rating watch the results move the same way.

## Documentation

Code: `src/app/(portal)/portal/docs`, `src/app/api/docs`, `src/lib/docs`.

- Open pages refresh on a `notifyDocs` signal (publish, move, rename, delete) with a 2-minute backstop.
- Pages are grouped in categories (each with a color) and can have sub-pages. Edits go to a draft; **Publish** makes them live and keeps a version.
- **Home:** Start here (pinned), a card per category listing every page (long lists scroll inside the card), tags, and a side panel with favorites and recently updated. A banner lists required reading you haven't opened.
- **Required reading:** editors choose roles in a page's ⋯ menu (`doc_required_roles`). Opening the page counts as read (`api/docs/read`, `doc_reads`). Editors see who has read it, can remind the unread (once a day) and can **ask everyone to re-read** after a big change (clears the marks and sends one bell).
- **Comments:** a quiet thread under each published page (`doc_comments`). The page's author and last editor get a bell; editors can resolve or delete.
- **Report a problem:** ⋯ → "Report a problem with this doc" opens a Help ticket in the **Doc problem** category with a link to the page.

## Help and role requests

Code: `src/app/(portal)/portal/help`, `src/app/api/help`, `src/lib/notifications/help*.ts`.

- Anyone can open a ticket; exec and admin see all of them.
- **Role requests:** "I need a role" opens a short form (role, division, who can vouch). It becomes a ticket whose text `parseRoleRequest` can read back. Admins (only) see **Approve and give role** on it, preselected from the request. Approving gives the role (`withRole`), replies on the ticket, notifies the person, resolves the ticket and writes the audit log.

## Notifications

`createNotifications` writes the bell and sends push together. Kinds people can mute (Profile → notifications): meetings, events, account, help, **shifts** (`shift_*`), **docs** (`doc_required`, `doc_comment`), keys. A kind not listed always sends.

## Scheduled jobs (`vercel.json`, `src/app/api/cron`)

The free Vercel plan allows two scheduled jobs, each at most once a day, so `vercel.json` has exactly two. Each one runs the older single-purpose routes in turn (a failure in one never stops the next); those routes still work on their own.

| Job | Runs | Does |
|---|---|---|
| `daily-reminders` | `event-reminders`, `meeting-reminders` | Day-before and hour-before event reminders; "Today at ..." meeting reminders, meeting-plan nudges, morning-of shift reminders, stale cover alerts |
| `daily-maintenance` | `cleanup-notifications`, `quarter-sync`, `team-sync`, and on Sundays `storage-maintenance` | Removes old notifications; keeps the quarter and team-year records in line with the calendar; weekly removes files nothing uses |

Each is called with `Authorization: Bearer $CRON_SECRET`. Don't add a third job to `vercel.json`; add a step to one of these two instead.
