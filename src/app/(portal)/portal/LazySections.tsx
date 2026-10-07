'use client';

import { createElement, type ComponentProps } from 'react';
import { Calendar, Ticket, Users } from 'lucide-react';
import { SectionLoading, useSectionData } from '@/components/portal/useSectionData';
import EventsSectionContent from './events/EventsSectionContent';
import MembersSectionContent from './members/MembersSectionContent';
import DocsClient from './docs/DocsClient';
import PhotoAlbumsSectionContent from './albums/PhotoAlbumsSectionContent';
import DivisionsSectionContent from './divisions/DivisionsSectionContent';
import SiteContentSectionContent from './content/SiteContentSectionContent';
import AdminSectionContent from './admin/AdminSectionContent';
import ShiftsSectionContent from './shifts/ShiftsSectionContent';
import DivisionMembersSectionContent from './division-members/DivisionMembersSectionContent';
import type { getEventsData } from './events/getEventsData';
import type { getMembersData } from './members/getMembersData';
import type { getDocsData } from './docs/getDocsData';
import type { getPhotoAlbumsData } from './albums/getPhotoAlbumsData';
import type { getAdminData } from './admin/getAdminData';
import type { getStatsData } from './admin/stats/getStatsData';
import type { getContentData } from './admin/content/getContentData';
import type { getShiftsData } from './shifts/getShiftsData';

// The heavy sections: each fetches its own data the first time it is opened (see lib/portalSectionData.ts), then renders the real section.
// `scope` is who is looking (and "viewing as" what), so a changed view never reuses another view's data.
type Awaited_<T extends (...a: never[]) => Promise<unknown>> = Awaited<ReturnType<T>>;

export function EventsLazy({ scope, ...rest }: { scope: string } & Omit<ComponentProps<typeof EventsSectionContent>, 'events' | 'eventsPerMonth' | 'ticketsPerMonth' | 'eventStats'>) {
  const { data, error, retry } = useSectionData<Awaited_<typeof getEventsData>>('events', scope);
  if (!data) return <SectionLoading error={error} retry={retry} />;
  return <EventsSectionContent {...rest} events={data.events} eventsPerMonth={data.eventsPerMonth} ticketsPerMonth={data.ticketsPerMonth} eventStats={data.eventStats} />;
}

export function MembersLazy({ scope, ...rest }: { scope: string } & Omit<ComponentProps<typeof MembersSectionContent>, 'rows'>) {
  const { data, error, retry } = useSectionData<Awaited_<typeof getMembersData>>('members', scope);
  if (!data) return <SectionLoading error={error} retry={retry} />;
  return <MembersSectionContent {...rest} rows={data.rows} />;
}

export function DocsLazy({ scope, ...rest }: { scope: string } & Omit<ComponentProps<typeof DocsClient>, 'initialDocs' | 'initialCategories' | 'initialFavorites'>) {
  const { data, error, retry } = useSectionData<Awaited_<typeof getDocsData>>('docs', scope);
  if (!data) return <SectionLoading error={error} retry={retry} />;
  return <DocsClient {...rest} initialDocs={data.docs} initialCategories={data.categories} initialFavorites={data.favorites} />;
}

export function AlbumsLazy({ scope, ...rest }: { scope: string } & Omit<ComponentProps<typeof PhotoAlbumsSectionContent>, 'albums'>) {
  const { data, error, retry } = useSectionData<Awaited_<typeof getPhotoAlbumsData>>('albums', scope);
  if (!data) return <SectionLoading error={error} retry={retry} />;
  return <PhotoAlbumsSectionContent {...rest} albums={data.albums} />;
}

export function DivisionsLazy({ scope, ...rest }: { scope: string } & Omit<ComponentProps<typeof DivisionsSectionContent>, 'allDivisions' | 'myDivisions'>) {
  const { data, error, retry } = useSectionData<{ divisions: ComponentProps<typeof DivisionsSectionContent>['allDivisions'] | null; myDivisions: ComponentProps<typeof DivisionsSectionContent>['myDivisions'] | null }>('divisions', scope);
  if (!data) return <SectionLoading error={error} retry={retry} />;
  return <DivisionsSectionContent {...rest} allDivisions={data.divisions ?? undefined} myDivisions={data.myDivisions ?? undefined} />;
}

export function SiteContentLazy({ scope, ...rest }: { scope: string } & Omit<ComponentProps<typeof SiteContentSectionContent>, 'contentMap' | 'lastEdited' | 'creditPeople'>) {
  const { data, error, retry } = useSectionData<{ contentMap: Awaited_<typeof getContentData>['contentMap'] | null; lastEdited: Awaited_<typeof getContentData>['lastEdited'] | null; creditPeople: ComponentProps<typeof SiteContentSectionContent>['creditPeople'] }>('site-content', scope);
  if (!data) return <SectionLoading error={error} retry={retry} />;
  return <SiteContentSectionContent {...rest} contentMap={data.contentMap ?? undefined} lastEdited={data.lastEdited ?? undefined} creditPeople={data.creditPeople} />;
}

export function AdminLazy({ scope, ...rest }: { scope: string } & Omit<ComponentProps<typeof AdminSectionContent>, keyof Awaited_<typeof getAdminData> | 'statsData' | 'roleHistoryEntries'>) {
  const { data, error, retry } = useSectionData<{ admin: Omit<Awaited_<typeof getAdminData>, 'stats'> & { stats: { label: string; value: number }[] }; stats: Awaited_<typeof getStatsData>; roleHistoryEntries: ComponentProps<typeof AdminSectionContent>['roleHistoryEntries'] | null }>('admin', scope);
  if (!data) return <SectionLoading error={error} retry={retry} />;
  const iconProps = { size: 22, strokeWidth: 1.5, 'aria-hidden': true } as const;
  const ICONS: Record<string, typeof Users> = { Members: Users, Events: Calendar, Tickets: Ticket };
  const stats = data.admin.stats.map(({ label, value }) => ({ label, value, icon: createElement(ICONS[label] ?? Users, iconProps) }));
  return <AdminSectionContent {...rest} {...data.admin} stats={stats} statsData={data.stats} roleHistoryEntries={data.roleHistoryEntries ?? undefined} />;
}

export function ShiftsLazy({ scope, ...rest }: { scope: string } & Omit<ComponentProps<typeof ShiftsSectionContent>, 'events' | 'stations' | 'docs' | 'templates'>) {
  const { data, error, retry } = useSectionData<Awaited_<typeof getShiftsData>>('shifts', scope);
  if (!data) return <SectionLoading error={error} retry={retry} />;
  return <ShiftsSectionContent {...rest} events={data.events} stations={data.stations} docs={data.docs} templates={data.templates} />;
}

export function DivisionMembersLazy({ scope }: { scope: string }) {
  const { data, error, retry } = useSectionData<{ groups: ComponentProps<typeof DivisionMembersSectionContent>['groups'] }>('division-members', scope);
  if (!data) return <SectionLoading error={error} retry={retry} />;
  return <DivisionMembersSectionContent groups={data.groups} />;
}
