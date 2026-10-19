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
| `notify.ts` | `createNotifications`: bell and push in one step |
| `webPush.ts`, `pushClient.ts` | Push delivery, the kinds a member can mute, and the browser side |
| `notificationCleanup.ts` | Removes old notifications (audit alerts after 14 days, routine ones soon after they are read, the rest after 30 to 90) |
| `help.ts`, `helpConstants.ts` | Help tickets: authorization, categories, role request text |
| `audit.ts`, `auditFilters.ts` | The audit log and its filters |

## `qr/`
`qrCodeStyling.ts` and `qrPresets.ts` (QR Studio). `lib/qr/tgCode/` is the portal's own circular code (tickets, meeting check-in, reward pickups): `layout.ts` (the geometry and bits), `marks.ts` and `find.ts` (the marks every format shares, and finding them), `rs.ts` (Reed–Solomon repair), `decode.ts` (the reader), `legacy*.ts` (the first format, still read), `testCamera.ts` (the tests' software camera); it (the "TGcode", see `docs/tgcodes-and-scanning.md`) is drawn by `components/TGcode` and read by the Scan page (`portal/scan`, `components/portal/UniversalScanner`).

## `storage/`
`imageUpload.ts`, `imageOptimize.ts`, `fileUpload.ts`, `fontUpload.ts`, `sitePhotos.ts`, `googlePhotosAlbum.ts` (uploads and photos); `storageBuckets.ts`, `storageMaintenance.ts` (buckets and the weekly clean-up of unused files); `storageKeys.ts` (the Storage Keys section: who holds which physical key).

## `site/`: the public website
`content.ts`, `content-blocks.ts`, `contentPreview*.ts` (editable text blocks), `pageBlocks.ts`, `pageLayout.ts`, `ogCard*.ts(x)`, `ogPage.tsx`, `ogRoutes.tsx` (share images), `shortLinks.ts`, `links.ts`, `attribution.ts`, `games.ts`, `youtube.ts`, `revalidate.ts`, `refreshPublicCache.ts`.

## `ui/`: client helpers
`confirmHold.ts` (hold to confirm), `toast.ts`, `fetchWithRetry.ts`, `useDraft.ts` (unsent drafts), `useDragReorder.ts`, `useEditingPresence.ts`, `useOnlineStatus.ts`, `useUnsavedChanges.ts`, `useVisiblePoll.ts`.

## `supabase/`
The four Supabase clients described in [architecture.md](architecture.md). `localAuth.ts` makes `auth.getUser()` a local check and provides `strictUser` for routes that change roles or settings (see [usage-and-limits.md](usage-and-limits.md)).
