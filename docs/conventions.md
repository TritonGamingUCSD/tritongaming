# Conventions

## Theme

Portal styles use tokens, never one-theme colors: `--pp-ink`, `--pp-card`, `--pp-line`, `rgba(var(--pp-ink-rgb), x)`, and status colors `--pp-ok`, `--pp-warn`, `--pp-bad`, `--pp-info`, `--pp-violet`. `npm run check:theme` rejects a literal that only works in one theme; a literal that is deliberately fixed carries a `/* theme-ok */` comment on the same line. Always look at light and dark, and at phone width (390px).

The sign-in page uses the same tokens and the same saved light/dark choice.

## CSS Modules

One `*.module.css` per section or component. Selectors must contain a local class. Shared surfaces (`card`, `panel`) come from `components/ui/Surface.module.css` through `composes`. Delete a class when the markup stops using it; a class built from a variable (``styles[`status_${x}`]``) is easy to miss, so search for the prefix before deleting.

## Routing

Every tab, sub-tab and view toggle in the portal must be in the address. Write it with `usePortalTabSync` (it takes `tab, subtab`) and read it on load with `useUrlNav`. The first view of a section keeps the short address. When you rename or merge a tab, map the old address to the new one so old links keep working. See [portal-navigation.md](portal-navigation.md).

## Interface habits

- Titles are Title Case; use the shared `SectionHeader`, `SectionTabs`, `Dialog`, `Field`, `Button`, `Notice`.
- Anything that cannot be undone uses `confirmHold` (hold to confirm).
- Forms that save in one go use `SaveBar` and `useUnsavedChanges`.
- Anything several people can edit shows who else is editing (`EditingNow`).
- Drag lists use `useDragReorder`; they move live while dragging.
- Prefer improving a screen that exists over adding a new tab. New surfaces go inside the screen people are already on (a panel, a dialog, a line in a card), not in a new menu.
- Quiet by default: a thing that is not needed right now starts collapsed (a `<details>`, a "+N more").

## Server and client components

A server component cannot pass a **function** to a client component (the page fails with "Functions cannot be passed directly to Client Components"). Pass plain data: strings, numbers, objects. Typecheck does not catch this; open the page.

## Notifications

Always send through `createNotifications`. Give each new kind a `type` and, if people should be able to mute it, a category in `webPush.ts` (`PUSH_CATEGORIES` and `categoryOf`). Do not notify a whole role for something only a few people need; notify the people involved and show the rest in the screen.

## Linting and checks

```
npm run type-check     # tsc --noEmit
npm run lint           # ESLint (Next rules)
npm test               # Vitest
npm run check:theme    # theme tokens
```

`npm run lint` has no errors; the React-compiler style rules (`set-state-in-effect`, `refs`, `purity`) are warnings on purpose. Unused imports and variables are errors; prefix an intentionally unused name with `_`.

## Files and names

Put shared logic in the right `src/lib/<topic>/` folder (see [code-map.md](code-map.md)). Name by what a thing is, not where it is used. Keep a comment only where the reason is not obvious from the code.

## Git

Do not commit generated or secret files (`.env.local`). Migrations are committed with the code that needs them.
