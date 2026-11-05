// Pages that belong together are one entry in the sidebar and one row of tabs under the top bar ("People": Members, Division Leads, Divisions). Each page keeps its own address and its own permissions: a family only changes how they are
// listed and reached. A person who can open just one page of a family sees that page by its own name. Plain data (no imports).
export interface Family {
  id: string;
  label: string;
  /** False when the name already says what is inside (no small line of page names under it). */
  peek?: boolean;
  children: { id: string; label: string }[];
}

export const FAMILIES: Family[] = [
  {
    id: 'people',
    label: 'People',
    children: [
      { id: 'members', label: 'Members' },
      { id: 'division-members', label: 'Leads' },
      { id: 'divisions', label: 'Divisions' },
    ],
  },
  {
    id: 'standing',
    label: 'Standing',
    children: [
      { id: 'strikes', label: 'Strikes' },
      { id: 'quarters', label: 'Quarter Status' },
    ],
  },
  {
    id: 'run-events',
    label: 'Events & Check-In',
    peek: false,
    children: [
      { id: 'events', label: 'Events' },
      { id: 'checkin', label: 'Check-In' },
    ],
  },
];

export const familyOf = (sectionId: string): Family | undefined => FAMILIES.find((f) => f.children.some((c) => c.id === sectionId));
