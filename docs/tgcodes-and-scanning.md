# tgcodes, QR codes and the Scan page

A **tgcode** is the portal's own circular code: concentric rings of square-ended dashes in Triton Gaming's colours (navy and royal blue for the message, yellow and light blue
for filler), two ring marks at the top, a dot at each bottom corner, the Triton logo in the middle. It is an SVG (`components/RingCode`), it flips with the portal's light and dark
theme, and **only the portal's Scan page reads it** (a phone's own camera sees a pattern, nothing to open). Code: `src/lib/qr/ringCode/` (`layout.ts` the geometry and bits, `rs.ts`
Reed–Solomon repair, `decode.ts` the reader). It carries a kind letter and 12 hex digits of its own key, so a typed 6-digit code can never be turned into it, and a meeting, a ticket
and a reward can never show the same one (the kind is part of what is drawn and checked).

## What shows which code

| Where | Code | What it carries | Lives |
|---|---|---|---|
| A ticket (My Tickets, full screen) | tgcode, kind `t` | key from the ticket's secret | about 30 s (the previous window counts only for the first 5 s of a new one) |
| Meeting check-in (host's live screen) | tgcode, kind `m` | key from the meeting's secret | about 30 s (same) |
| A reward pickup (Rewards, "show to an officer") | tgcode, kind `r` | first 12 hex digits of the redemption id | until picked up |
| Event self check-in (Check-In → Self Check-In) | ordinary square QR, a link `…/in/<event>` | the link | permanent (public on purpose: attendees may have no account) |
| QR Studio | ordinary square QR, whatever the person made | anything | permanent |

Typed 6-digit codes are separate from the tgcodes: the digits under a ticket, and the code on a meeting's screen.

## What the Scan page does with what it reads

It is `/portal/scan` (the middle button of the phone's bottom bar; a tablet gets the same button in the top bar; a computer is sent to type the code instead). It reads tgcodes and
ordinary QR codes. Every result says exactly what happened.

| It reads | Anyone | Officer who may scan tickets | Officer who may confirm rewards |
|---|---|---|---|
| Meeting tgcode | checks them in (if they may attend and check-in is open), shows which meeting | same | same |
| Ticket tgcode | "That is an event ticket. Show it to an officer." | checks the ticket in, shows whose it is, points and AS-form state | same |
| Reward tgcode | "Show it to an officer to collect your reward." | "your role can't confirm hand-overs" | shows the reward; **Confirm Given** marks it handed over |
| `/in/<event>` link | opens that event's check-in page, which checks them in and shows the result | same | same |
| Other portal link | opens the page | same | same |
| Anything else | "That isn't a tgcode or a portal QR" and keeps looking | same | same |

## The typed code box

One box on the Scan page (always at the bottom), on Check-In → Enter Code, and on My Meetings. Six digits: a meeting's code and a ticket's code are both asked first **without
changing anything**; if only one fits it is done, if neither fits the reason is shown, and if both fit (one in a million) the person is asked **Which one is it?**. Only people who
may scan tickets can ever hit the ticket side.

## Process logic

1. The camera looks at the picture many times a second: a QR first (jsQR / the browser's detector), then the tgcode reader (finds the two ring marks, the two dots, straightens the
   picture, reads the cells where each dash would be, repairs up to 12 wrong bytes of 32, checks the check byte). Either light-on-dark or dark-on-light reads.
2. A tgcode becomes `ring:<kind><12 hex>`; the scanner decides by kind and calls `lib/checkin/anyCode.ts`, which asks the server (`/api/meetings/check-in`,
   `/api/tickets/checkin`, `/api/rewards/redemptions/lookup`). The server decides who may do what and whether the key is current.
3. The result is shown in a card; staff can **Scan Next**.

## After a scan

The person stays on the scan page. While it looks, nothing moves on the camera while it looks (it fades in once the first picture is ready). When a code is read the picture freezes on it, the ring locks and takes
the outcome's colour (green done, amber already used or needs a choice, red refused), a big icon pops in with a ripple (a refusal shakes), and the result slides up over the camera.
**Scan Next** carries on with the same camera. With reduced motion on, none of it moves. A reply with no reason (signed out, too many tries, a server error) is turned into a plain
sentence. Wherever a tgcode is shown the button says **Show tgcode** and uses the ring icon instead of the standard QR glyph. There is no vibration.
