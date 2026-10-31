'use client';

import { Tracker } from './Tracker';

// The strike tracker. Exec, HR (the "manage strikes" permission) and admins see everyone and add strikes directly. Every action takes a reason the person can read, and nobody changes their own record.
export default function StrikesSectionContent() {
  return <Tracker />;
}
