# Division walk-through (try it with a real Head and a real Member)

Division pages are still admin-only. Turn them on for the test in Admin > Settings > Divisions (or view the portal as the Head), then go through this list. Use a throwaway test event and delete it after.
Mark each line done or write what looked wrong.

## As a Division Head
1. Switch to the division with the hat switcher. The sidebar, top-left logo, colors and breadcrumb all name the division. Refresh: you stay on it.
2. Home shows the next event, its registered and checked-in numbers, and the Heads/Members/Alumni counts.
3. **Page**: set a banner, tagline and color, then Save. Open the public page (`/<address>`): the hero shows them and the whole page uses the color.
4. **Members**: search a person by name, add them as Member. Change them to Alumni. Add one by exact email. Remove them. Try to demote the only Head (it must refuse).
5. **Events**: Create Event, publish it. It appears on `/<address>/events` and on the club's events page. Edit it. Invite another division as co-host (Events row, Invite Co-Host).
6. **Check-In**: the self check-in QR shows for the event. Turn self check-in on and off.
7. Scan a ticket in the code box (top bar) and in Scan on a phone: it checks in. A ticket for a club event is not found.
8. **QR Codes**: starts with the division's logo and color. Download one.
9. **Live Tools**: Trivia, Polls, Q&A and Photo Booth are separate pages. Make one in each; it shows only under this division (not in the club's lists).
10. Phone: the bottom bar and More sheet show the division's pages; Home goes to the division's home.

11. **Home**: post an announcement (it shows for Members, who are notified); remove it.
12. **Members**: the "Taking join requests" switch. Turn it off: students see "Not taking requests". Turn it on, ask to join as a student, then Approve and Decline requests.

## As a Division Member
1. Sees Home, Events? (no), Check-In, QR Codes, Live Tools, Members (read only). No Page or edit buttons.
2. Can check in people at the division's events, not at the club's.
3. Cannot add or remove people.

## As a student or guest
1. Home opens with the member pass (student) or welcome ticket (guest).
2. With divisions open (or you are a preview person), cards to explore appear. "Ask To Join" sends a request (it then shows "Asked ✓"); the division's Discord is a small link beside it. A closed division says "Not taking requests".

## Public pages
1. `/<address>`, `/events`, `/team`, `/gallery`: one navbar (the division's), no club navbar stacked above it, footer at the bottom, nothing odd on a phone.
2. `/divisions/<address>` shows the same page.
