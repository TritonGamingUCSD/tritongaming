# Portal navigation rules

Every section of the portal follows the same shape, so people always know where they are.

1. **Header** (`SectionHeader`): title, one readable line under it, the section's main action on the right. On desktop the top bar already names the section, so only the action shows. Pass `flush` when the page already spaces its children with a flex gap.
2. **Tabs** (`SectionTabs`, underline): the main jobs in the section. Labels are Title Case (automatic), each has an icon. Order: personal first (My …), then run/do, then review, then **Tools** last for setup and rarely used things. The setup tab is always called **Tools**.
3. **Sub-views** (`SectionTabs variant="segmented"`): a pill switch for a view inside a tab. Text only (icons are dropped automatically). Never a third level.
4. **Deep links**: every tab and sub-view is in the address (`?section=…&tab=…&subtab=…`). Pick with `usePortalTabSync`; read with `useUrlNav`. With no tab in the link, a section reopens on the tab the person last used on this device (a link that names a tab always wins). Always check the tab is one the person may use.
5. **Hide what is not needed**: one tab means no tab bar; one sub-view means no pill switch.
6. **Spacing**: leave breathing room (about 1.25rem between header, tabs and content) and never let controls collapse or touch. Check phone (390px) and desktop whenever layout moves.
