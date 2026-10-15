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
- **Organizing:** leads, exec and admins (`manage_docs`) organize in the tree itself. Drag a doc to reorder it or drop it on a category to move it; drag a category header to reorder categories. A category's ⋯ menu has Rename, Change Colour, Add Doc Here and Delete, and **New Category** is at the bottom of the tree. Officers and others only read.
- **Teams:** an editor picks which teams a page is useful for (Team tab in TG Members, stored in `docs.teams`). People on those teams see it under "For your team".
- **Editor:** Tiptap, saved as Markdown. Text colour and highlight use a fixed palette and are stored as inline `<span data-c>` and `<mark data-h>`; the reader renders them through `remarkDocColors`.
- **Required reading:** editors choose roles in a page's ⋯ menu (`doc_required_roles`). Opening the page counts as read (`api/docs/read`, `doc_reads`). Editors see who has read it, can remind the unread (once a day) and can **ask everyone to re-read** after a big change (clears the marks and sends one bell).
- **Comments:** always open under each published page (`doc_comments`). The page's author and last editor get a bell; editors can resolve or delete.
- **Report a problem:** ⋯ → "Report a problem with this doc" opens a Help ticket in the **Doc problem** category with a link to the page.

## Help and role requests

Code: `src/app/(portal)/portal/help`, `src/app/api/help`, `src/lib/notifications/help*.ts`.

- Anyone can open a ticket; exec and admin see all of them.
- **Role requests:** "I need a role" opens a short form (role, division, who can vouch). It becomes a ticket whose text `parseRoleRequest` can read back. Admins (only) see **Approve and give role** on it, preselected from the request. Approving gives the role (`withRole`), replies on the ticket, notifies the person, resolves the ticket and writes the audit log.

## Notifications

`createNotifications` writes the bell and sends push together. Kinds people can mute (Profile → notifications): meetings, events, account, help and **docs** (`doc_required`, `doc_comment`). A kind not listed always sends.

## Scheduled jobs (`vercel.json`, `src/app/api/cron`)

The free Vercel plan allows two scheduled jobs, each at most once a day, so `vercel.json` has exactly two. Each one is a single route that runs its steps in turn (a failure in one never stops the next).

| Job | Steps | Code |
|---|---|---|
| `daily-reminders` | Day-before and hour-before event reminders; "Today at ..." meeting reminders; a nudge to people who haven't answered a meeting plan | `lib/notifications/eventReminders.ts`, `lib/meetings/reminders.ts`, `lib/meetings/meetingPlanServer.ts` |
| `daily-maintenance` | Removes old notifications (audit alerts after 14 days; ticket and meeting notices 14 days after they are read, 45 at most; everything else 30 read or 90 at most) and individual meeting reactions after 7 days; starts a new quarter's inactive markers; records the team roster and archives finished years; on Sundays removes files nothing uses and shrinks old pictures | `lib/meetings/reactionCleanup.ts`, `lib/notifications/notificationCleanup.ts`, `lib/members/quarters.ts`, `lib/members/teamYears.ts`, `lib/storage/storageMaintenance.ts` |

Both are called with `Authorization: Bearer $CRON_SECRET`. `daily-maintenance?only=notifications|quarters|teams|storage` runs a single step; on a dev machine `x-cron-dev: 1` may run only the quarters and teams steps. Don't add a third job to `vercel.json`; add a step to one of these two instead.
