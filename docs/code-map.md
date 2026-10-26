# Code map: `src/lib`

Shared logic is grouped by topic. Import with the alias, for example `import { hasCapability } from '@/lib/portal/capabilities'`. A name that starts with `use` is a React hook for client components. A name ending in `Server` only runs on the server.

Pure logic (no database, no React) is what the unit tests in `src/lib/__tests__` cover. Keep new logic pure where you can and put the database calls in a thin layer around it.

## `core/`: used everywhere
| File | Purpose |
|---|---|
| `auth.ts` | Get the signed-in user and profile on the server (`getUser`, `getProfile`, `getViewingUser`) |
| `cronAuth.ts` | Checks a scheduled job is called with the cron secret |
| `timezone.ts` | Pacific-time helpers: formatting, day keys, multi-day events |
| `slug.ts` | Turns a title into a URL slug |

## `portal/`: the portal shell
| File | Purpose |
|---|---|
| `capabilities.ts` | The roles, the capabilities each grants, and `hasCapability` |
| `grantedCapabilities.ts` | One-off capabilities exec gives a single person |
| `roleGrant.ts` | `withRole`: adds a role to someone's existing ones (used by bulk roles and role-request approval) |
| `roleColors.ts` | Colors used for each role |
| `usePortalTabSync.ts`, `usePortalParams.ts` | Put the open tab and sub-tab in the address and read them back |
| `portalPath.ts`, `portalNav.ts`, `portalShare.ts` | Section addresses, in-page navigation, and share-preview targets |
| `portalCommands.ts` | What the search bar can jump to |
| `portalCounts.ts`, `todos.ts` | The numbers in the sidebar and the dashboard to-do list |
| `portalSectionData.ts` | Loaders for the lazily loaded sections |
| `viewAs.ts` | "View as" another role or person (read-only preview) |

## `docs/`
| File | Purpose |
|---|---|
| `docsTree.ts` | Builds the category/sub-page tree; category colors; ages ("Updated 3 days ago"); tags |
| `docsServer.ts` | Authorization (`authorizeDocs`), the columns routes read, who is editing now |
| `docsSync.ts` | The light "what changed" payload the open page loads |
| `docsLive.ts` | `notifyDocs()`: tells open pages something changed |
| `docColors.ts`, `docColorMarks.ts`, `remarkDocColors.ts` | The text colour and highlight palette, the editor marks, and how the reader draws them |
| `docsLinks.ts` | `[[Doc title]]` links and "linked from" |
| `markdown.ts`, `markdownToc.ts` | Markdown helpers and the "On this page" outline |

## `meetings/`
| File | Purpose |
|---|---|
| `meetings.ts` | Meetings, repeating series, who is expected, check-in rules |
| `meetingAudience.ts` | Who a meeting is for |
| `meetingPlans.ts`, `meetingPlanServer.ts` | "When can you meet?" planning |
| `meetingLive.ts`, `useMeetingLive.ts` | The live "something changed" signal for the projector screen and poll results (server sends, browser listens) |
| `meetingFun.ts` | Polls, ratings and reactions during a meeting |
| `groupChanges.ts` | Team groups |
| `reminders.ts` | "Today at ..." meeting reminders |
| `busyItems.ts` | The meetings and ticketed events a person already has (blocks times on the planning grid, feeds portal search) |

## `events/`
| File | Purpose |
|---|---|
| `events.ts`, `eventSummary.ts`, `eventTheme.ts` | Event data, the post-event summary, an event's own look |
| `checkinDays.ts`, `checkinWindow.ts`, `checkinForm.ts`, `performCheckin.ts` | Check-in rules and the check-in action |
| `rotatingCode.ts`, `rotationConstants.ts`, `ticketCodeCache.ts` | The QR code that changes every few seconds |
| `monthBuckets.ts`, `weekGroups.ts` | Group events by month and week for the events lists |
| `stripe.ts` | Stripe client |

## `members/`
| File | Purpose |
|---|---|
| `profile.ts`, `profileCompleteness.ts`, `names.ts`, `linkedEmails.ts` | Profiles, what is still missing, how names are shown |
| `divisions.ts`, `creditPeople.ts` | Divisions and people credited on pages |
| `strikes.ts`, `strikeLabels.ts` | The strike tracker |
| `quarters.ts`, `teamYears.ts` | Quarter calendar, active/inactive, yearly team records, alumni move |
| `majors.ts`, `tiers.ts` | Majors list and reward tiers |

## `notifications/`
| File | Purpose |
|---|---|
| `notify.ts` | `createNotifications`: bell and push in one step (`pushOnly`: push for rows already in the bell) |
| `memberNotices.ts` | Notices to the member an admin action is about: role changed, points added or removed, reward handed over or cancelled |
| `adminAlerts.ts` | Tells the admins: free-plan usage at 80% / 90%, a failed scheduled job, help tickets waiting over 2 days, a daily new-member note, and which audit entries are risky (pushed to devices from `logAudit`) |
| `webPush.ts`, `pushClient.ts` | Push delivery, the kinds a member can mute, and the browser side |
| `notificationCleanup.ts` | Removes old notifications (audit alerts after 14 days, routine ones soon after they are read, the rest after 30 to 90) |
| `help.ts`, `helpConstants.ts` | Help tickets: authorization, categories, role request text |
| `audit.ts`, `auditFilters.ts` | The audit log and its filters. `logAudit` records a person's action (and pushes risky ones to admins); `logSystem` records what a scheduled job did on its own. Database triggers also log changes to events, divisions, docs, rewards and similar |

## `qr/`
`qrCodeStyling.ts` and `qrPresets.ts` (QR Studio). `lib/qr/tgCode/` is the portal's own circular code (tickets, meeting check-in, reward pickups): `layout.ts` (the geometry and bits), `marks.ts` and `find.ts` (the marks every format shares, and finding them), `rs.ts` (Reed–Solomon repair), `decode.ts` (the reader), `legacy*.ts` (the first format, still read), `testCamera.ts` (the tests' software camera); it (the "TGcode", see `docs/tgcodes-and-scanning.md`) is drawn by `components/TGcode` and read by the Scan page (`portal/scan`, `components/portal/UniversalScanner`).

## `storage/`
`imageUpload.ts`, `imageOptimize.ts`, `fileUpload.ts`, `fontUpload.ts`, `sitePhotos.ts`, `googlePhotosAlbum.ts` (uploads and photos); `storageBuckets.ts`, `storageMaintenance.ts` (buckets and the weekly clean-up of unused files); `storageKeys.ts` (the Storage Keys section: who holds which physical key).

## `site/`: the public website
`content.ts`, `content-blocks.ts`, `contentPreview*.ts` (editable text blocks), `pageBlocks.ts`, `pageLayout.ts`, `ogCard*.ts(x)`, `ogPage.tsx`, `ogRoutes.tsx` (share images), `shortLinks.ts`, `links.ts`, `attribution.ts`, `games.ts`, `youtube.ts`, `revalidate.ts`, `refreshPublicCache.ts`.

## `logistics/`: event logistics (separate from check-in)
Also: `requests.ts` / `requestServer.ts` / `requestRows.ts` (what a request turns into: rows, sets, a prize station, contact; follows bundle edits), `prizes.ts` (stock rules, `suggestPrizes`), `prizing.ts` (the Prizing page's grouping, status, needs and fixes), `prizeServer.ts` (totals, closing an event), `live.ts` (announcing changes on Realtime). UI in `app/(portal)/portal/logistics/`: `PlanView` (the event page), `PlanSheet` (device lines), `RequestsTab`, `PrizingPage` / `PrizingParts` / `PrizingDialogs` / `useLiveTeam` (the Prizing page), `BorrowedTab`, `Cells` (click-to-edit cells), `DeviceFinder`, `logisticsRoute.ts` (addresses).
`constants.ts` (conditions, borrowed kinds, list kinds, the starting kit per device type), `devices.ts` (reading a device from the browser, the ID matching rule, the history lines for a change), `plans.ts` (which steps apply to which device, picking devices and bundles, what to look at before the day, progress; pure and tested), `planServer.ts` (loading a plan, finding what was typed, overlap with other events), `auth.ts` (`authorizeLogistics('view' | 'manage')`). Routes: `app/api/logistics` (one bootstrap GET, devices, options, sponsors, people, and `plans` with its stations, devices, borrowed, pick, swap, steps and version). Pages: `app/(portal)/portal/logistics` (`LogisticsSectionContent`, `EquipmentTab`, `DeviceDialog`, `logisticsRoute.ts` (the addresses), `PrizesTab` (the storage prizes), `PrizingTab` / `PrizeGrid` (an event's prize allocation grid) / `PlanPrizes` (the day counts), `SponsorPrizingTab`, `RequestsTab`, `Panel` (the in-page form shell used instead of dialogs), `BorrowedTab` (sponsor loaners and officer loaners), `usePrizes`, `PlansTab` (the list and the address), `PlanView` (the one sheet: plan and event day), `PlanSheet` (its lines and step boxes), `planRows` (rows, lines, sets), `PickDialog`, `BorrowedDialog`, `SwapDialog`, `SponsorsTab`, `ToolsTab`, `Combo` for the add-while-picking dropdown, `useLogistics` / `usePlans` for the in-memory data).

## `ui/`: client helpers
`confirmHold.ts` (hold to confirm), `toast.ts`, `fetchWithRetry.ts`, `useDraft.ts` (unsent drafts), `useDragReorder.ts`, `useEditingPresence.ts`, `useOnlineStatus.ts`, `useUnsavedChanges.ts`, `useVisiblePoll.ts`.

## `supabase/`
The four Supabase clients described in [architecture.md](architecture.md). `localAuth.ts` makes `auth.getUser()` a local check and provides `strictUser` for routes that change roles or settings (see [usage-and-limits.md](usage-and-limits.md)).

`components/ScrollArrows` (mounted once in the root layout) finds anything that scrolls sideways and adds a left and a right arrow at its ends, shown only while there is more that way; nothing opts in (skip one with `data-no-scroll-arrows`). Like `components/ClickFeedback`, it works on the page's DOM, so a new scrolling strip or table gets arrows without any code.

**Trivia:** `lib/trivia` (`game.ts` the rules: points, drawing, the automatic question time, standings, reading pasted/CSV questions; pure and tested; `server.ts` auth, the live broadcast and the public state; `gameServer.ts` start / reveal / next / finish), routes in `app/api/trivia` (quizzes, quiz access list, questions, games, join, play, answer, mine), pages in `app/(portal)/portal/trivia` (`TriviaSectionContent`, `QuizzesTab`, `QuizEditor` (the Questions and Games tabs of a quiz), `QuestionDialog` (Add Question), `BulkAdd` (Paste Many and CSV), `SharePanel` (private quizzes), `QuizGames`, `HostGame`, `PlayGame`, `PlayTab`, `useGame` (the live channel plus the back-up polling), `triviaRoute.ts`).
