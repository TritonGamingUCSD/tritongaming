# Features reference

Who may do what is in [roles-and-capabilities.md](roles-and-capabilities.md).

How the main pieces work and where the code is. Each section names the files so you can start reading in the right place.

## Meetings (live screen)

Code: `src/app/(portal)/portal/meetings`, `src/app/api/meetings`, `src/lib/meetings`.

- The projector screen (`api/meetings/[id]/live`) refreshes when the server sends a signal (`notifyMeetingLive`, called after a check-in, answer, reaction or excuse) and every 30 seconds as a backstop. Only reactions newer than a cursor are returned; totals come every eighth refresh.
- People answering a poll or rating watch the results move the same way.
- The availability grid blocks times a person already has: meetings meant for them or hosted by them and events they have a ticket for (`lib/meetings/busyItems.ts`).

## Teams (TG Members → Team)

Code: `TeamsPanel` in `src/app/(portal)/portal/meetings/MeetingsSectionContent.tsx`, `src/app/api/meetings/groups`, table `meeting_groups`.

- A team is a name and a list of people (`meeting_groups.member_ids`). It is also what a meeting, plan or event can be sent to, so there is one list, not two.
- **By team** lists the teams closed (name and size only); “Show who” opens one to reveal its people as removable chips, with an “Add person” box. Searching opens the teams a person is in; **By person** shows each officer, lead and exec with their teams, a “no team yet” filter, and a “+ Add to a team” picker. The view is in the address (`/portal/members/team/people`).
- Changes use the same update route as the editor, so people added to a team are told about the meetings and plans the team was chosen for (`lib/meetings/groupChanges.ts`).
- Each person's teams are loaded with the roster (`getMembersData`) and shown as chips on their TG Members card (`MemberCardBody`, `teams`). The public Team page never passes them.

## Documentation

Code: `src/app/(portal)/portal/docs`, `src/app/api/docs`, `src/lib/docs`.

- Open pages refresh on a `notifyDocs` signal (publish, move, rename, delete) with a 2-minute backstop.
- Pages are grouped in categories (each with a color) and can have sub-pages. Edits go to a draft; **Publish** makes them live and keeps a version. A new page starts from one short how-to outline; there are no templates.
- **Layout:** the doc tree is always on the left (a drawer on a phone) and the search box sits above the content. Search (also `/`) matches titles, tags and text, marks the matching words and shows the line around the match.
- **Home, in order:** Quick links, docs for your own teams, Start here (pinned; editors drag to reorder), How-to guides by category, then favorites and recently updated. A banner lists required reading you haven't opened.
- **Quick links** are not documents. Each is a title, an https address, a one-line note and optional teams, kept in `quick_links` and managed on the home with **Add quick link** and the pencil on a tile (editors only: `manage_docs`). They have no tree, drafts, versions, comments or counts; they appear in portal search. Editors drag tiles to change their order (readers see links for their own teams first, then that order). The same tiles also appear on the portal dashboard for anyone who can read the docs.
- **Last reviewed:** each page shows when it was updated and when an editor last marked it as still correct (⋯ → Mark as reviewed, stored in `docs.reviewed_at`). A review counts like an edit for the six-month "worth a look" warning.
- **Organizing:** leads, exec and admins (`manage_docs`) organize in the tree itself. Drag a doc to reorder it or drop it on a category to move it; drag a category header to reorder categories. A category's ⋯ menu has Rename, Change Colour, Add Doc Here and Delete, and **New Category** is at the bottom of the tree. Officers and others only read.
- **Files and history:** a file is attached inside the text, where it belongs: **Insert, File**, `/file`, or drop or paste any file into the editor (pictures show in place, other files become a 📎 link). There is no separate attachments list. **History** opens the published versions on the right and shows the chosen one in the main area with what changed since the version before it marked (new text green, removed text red and struck through); **Restore This Version** brings it back as the draft.
- **Teams:** an editor picks which teams a page is useful for (Team tab in TG Members, stored in `docs.teams`). People on those teams see it under "For your team".
- **Editor:** Tiptap, saved as Markdown. Text colour and highlight use a fixed palette and are stored as inline `<span data-c>` and `<mark data-h>`; the reader renders them through `remarkDocColors`.
- **Required reading:** editors choose roles in a page's ⋯ menu (`doc_required_roles`). Opening the page counts as read (`api/docs/read`, `doc_reads`). Editors see who has read it, can remind the unread (once a day) and can **ask everyone to re-read** after a big change (clears the marks and sends one bell).
- **Comments:** always open under each published page (`doc_comments`). The page's author and last editor get a bell; editors can resolve or delete.
- **Report a problem:** ⋯ → "Report a problem with this doc" opens a Help ticket in the **Doc problem** category with a link to the page.

## Help and role requests

Code: `src/app/(portal)/portal/help`, `src/app/api/help`, `src/lib/notifications/help*.ts`.

- Anyone can open a ticket; exec and admin see all of them.
- **Role requests:** "I need a role" opens a short form (role, division, who can vouch). It becomes a ticket whose text `parseRoleRequest` can read back. Admins (only) see **Approve and give role** on it, preselected from the request. Approving gives the role (`withRole`), replies on the ticket, notifies the person, resolves the ticket and writes the audit log.

## Event Logistics (requests, allocation, event day, inventory, tools)

A self-contained portal section (Team group). **Every recruit, officer and above can look**; only people with the Event Logistics permission (exec, admin, or granted) change anything. The work runs in three steps: **Requests** (what each team needs) → **Allocation** (which device or prize goes to which request) → **Event Day** (tick what happens).

- **Addresses:** `/portal/logistics` is the list of events (a plain list). An event is `/portal/logistics/<event>/<page>` with the page one of `requests-devices`, `requests-prizing`, `allocation-devices`, `allocation-prizing`, `allocation-sponsor-prizing`, `allocation-sponsor-loaners`, `allocation-officer-loaners`, `event-day-devices`, `event-day-prizing`; `?view=type` groups the devices by type. Also `inventory/devices | prizes` and `tools/sponsors | event-steps | bundles | prizes | lists`. Old addresses (`events/<event>/device`, `?view=day`, plan IDs) still open the right place and are tidied. An event's name in the address is made once and never changes.
- **One tab bar on an event:** Requests, Sponsor Loaners, Officer Loaners, Sponsor Prizing, Devices, Prizing, Day: Devices, Day: Prizing (a scrolling row on a phone). The search beside the tabs finds any device (by ID, name or type) and any prize (by name, type, sponsor or size): for a device it says where it goes, where to get it and what step is next. Edit/close/remove an event from the menu on its row in the events list.
- **Requests are the source.** A device request (a bundle or a device type, how many, which games, a team, one contact, notes; the contact is one person, a division lead or an officer or above, the asker by default) makes the empty rows under its team in the Devices allocation (a bundle makes a set per unit). Editing the request adds or removes rows (empty ones first; a device with an event-day step done is never taken out); editing a bundle follows into every open request that uses it (parts added or removed, renames carried); a bundle that a request asks for can't be deleted. A prize request makes a **pool** for its team with a target (how many, dollars) and trims the pool's prizes when it shrinks. The request's contact is written onto its team, so every page shows the same one. No written answers: logistics tells people in person.
- **Devices allocation:** each row is what was asked for, with an ID box: typing an ID fills an empty row or swaps the device (inventory devices, sponsor loaners and officer loaners are all accepted; IDs are suggested), clearing it empties the row. Rows can't be added or deleted here, only in the request; a device no request asked for is flagged. Grouped by team or by device type; Collapse all also folds bundles; a list of devices still free sits under the teams.
- **Prizing allocation extras:** pool lines are grouped by prize Type, a line can be swapped for a similar prize (same type, else a close price), **Fill All Pools** suggests for every pool at once without two pools taking the last of a prize, and a prize promised past its stock is flagged amber (never blocked). A prize has an **In hand** tick (club stock yes; a sponsor prize starts as not here yet, Suggest skips it); its pop-up lists which open events hold it; Sponsor Prizing shows per-sponsor totals; a closed event shows a **Wrap-Up** (promised, given, left over, sponsor prizes to take back).
- **Prizing allocation:** a card per pool (progress for count and dollars, the prizes it has, add from inventory and sponsor prizing, **Suggest** fills what is missing with the closest-value prizes, sponsor prizes first); the old grid is an overview under it.
- **Who may do what:** once a request is sent only the Event Logistics team can change or remove it (including who the contact is); swaps are Event Logistics only; any officer can tick or untick steps, and each tick records who did it (shown on hover).
- **Event day:** only ticking, typing an ID to mark (IDs are suggested from the allocation), and swapping; nothing structural changes. The page asks a tiny question every 20 seconds while visible (requests every 30) so several people on one event see each other's work; saving the same request at once leaves exactly what it asks for. A tick shows at once (spinning ring while it saves), an Undo bar follows it, and a tick made while offline waits on the device and is sent when the connection returns. A camera button scans a device's QR (its ID, or a link ending in it) to mark the selected step; "Unfinished Only" hides lines that are done (`?view=open`).
- **Inventory** (devices, prizes) and the lists of sponsor loaners, officer loaners and sponsor prizing are edited **in place**: plain text until clicked, saved when you leave the box; a Details pop-up holds the rare fields. Forms that remain are pop-ups (an existing item's pop-up holds only what its table row has no box for; on a phone every pop-up is a full-screen sheet with its buttons pinned); Add Device asks only ID, Type, Shelf and Tier (More Details for the rest). Colours mean something: red = needs a device or is wrong, amber = to check, green = ready or done.
- **Tools** (Logistics permission): sponsors, event-day steps, setup bundles, prize steps and sizes, equipment lists. A device type can be marked **Main Device** (names and leads a set, like a PC with its monitor and keyboard); devices follow the Type list's order everywhere. Prizes have a free-text **Type**.
- Cost: opening Logistics is one request; each edit's reply is applied on screen; an open event costs a few tiny reads every 20 seconds only while the tab is visible.
- Checks: `npm run test:logistics`, `test:logistics-plans`, `test:logistics-prizes`, `test:logistics-requests` (need a dev server).

## Notifications

`createNotifications` writes the bell and sends push together. Kinds people can mute (Profile → notifications): meetings, events, account, help and **docs** (`doc_required`, `doc_comment`). A kind not listed always sends.

## Scheduled jobs (`vercel.json`, `src/app/api/cron`)

The free Vercel plan allows two scheduled jobs, each at most once a day, so `vercel.json` has exactly two. Each one is a single route that runs its steps in turn (a failure in one never stops the next).

| Job | Steps | Code |
|---|---|---|
| `daily-reminders` | Day-before and hour-before event reminders; "Today at ..." meeting reminders; a nudge to people who haven't answered a meeting plan | `lib/notifications/eventReminders.ts`, `lib/meetings/reminders.ts`, `lib/meetings/meetingPlanServer.ts` |
| `daily-maintenance` | Removes old notifications (audit alerts after 14 days; ticket and meeting notices 14 days after they are read, 45 at most; everything else 30 read or 90 at most) and individual meeting reactions after 7 days; starts a new quarter's inactive markers; records the team roster and archives finished years; reminds staff of help tickets open over 2 days and tells the admins how many members joined in the last day; tells the admins when the database or file storage reaches 80% / 90% of the free plan (once a week per level; files are totalled on Sundays); on Sundays removes files nothing uses and shrinks old pictures | `lib/meetings/reactionCleanup.ts`, `lib/notifications/notificationCleanup.ts`, `lib/members/quarters.ts`, `lib/members/teamYears.ts`, `lib/storage/storageMaintenance.ts`, `lib/notifications/adminAlerts.ts` |

Both are called with `Authorization: Bearer $CRON_SECRET`. `daily-maintenance?only=notifications|quarters|teams|help|signups|usage|storage` runs a single step; on a dev machine `x-cron-dev: 1` may run only the quarters and teams steps. Don't add a third job to `vercel.json`; add a step to one of these two instead.


## Event report (sponsors)
- **Where:** an event's summary page (`/portal/events/<id>/summary`, anyone with `checkin`). It is a formal, white-sheet report in Triton Gaming navy and gold. **Save as PDF** draws the PDF itself in the browser (no browser print dialog, so no address or page title in the margins): a one-page summary (key numbers, key findings, arrival and ticket-timing charts, audience and interest breakdowns, gender and pronouns always included) plus a second page with photos and the sponsor thank-you when there are any. Attendees' written comments are never included.
- **Details for each copy:** *Prepared for* (picked from the event's own sponsor list; the thank-you then names only that sponsor, otherwise all of them) and hand-typed *Social media reach* numbers, saved with the event in `events.report_social`.
- **Artwork:** the event's poster and design-guide stickers, and up to 6 photos from the gallery on its page.
- **Not in the PDF (team box under the report):** no-shows, cancelled tickets, points, paid tickets and revenue, check-in form completion and where ticket claims came from (QR scans show as Direct, so it understates).
- **Footnote:** data has been collected since the 2026-2027 school year (September 2026); profile details are optional in the portal, so those figures cover only attendees who shared them.
