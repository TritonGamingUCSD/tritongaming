import { getProfile, getUserRoles } from '@/lib/core/auth';
import { hasCapability } from '@/lib/portal/capabilities';
import { createClient } from '@/lib/supabase/server';
import { getCreditPeople } from '@/lib/members/creditPeople';
import { getEventsData } from '@/app/(portal)/portal/events/getEventsData';
import { getMembersData } from '@/app/(portal)/portal/members/getMembersData';
import { getDocsData } from '@/app/(portal)/portal/docs/getDocsData';
import { getPhotoAlbumsData } from '@/app/(portal)/portal/albums/getPhotoAlbumsData';
import { getDivisionsData } from '@/app/(portal)/portal/divisions/getDivisionsData';
import { getMyDivisionsData } from '@/app/(portal)/portal/divisions/getMyDivisionsData';
import { getContentData } from '@/app/(portal)/portal/admin/content/getContentData';
import { getAdminData } from '@/app/(portal)/portal/admin/getAdminData';
import { getStatsData } from '@/app/(portal)/portal/admin/stats/getStatsData';
import { getRoleHistoryData } from '@/app/(portal)/portal/admin/history/getRoleHistoryData';
import { getShiftsData } from '@/app/(portal)/portal/shifts/getShiftsData';
import { getDivisionMembersData } from '@/app/(portal)/portal/division-members/getDivisionMembersData';

// The data behind the heavy portal sections, loaded the first time a section is opened instead of with every /portal page load.
// The same permission rules as the portal page apply (the person's real or "viewed as" roles); someone without the capability gets a 403.
export const LAZY_SECTIONS = ['events', 'members', 'docs', 'albums', 'divisions', 'site-content', 'admin', 'shifts', 'division-members'] as const;
export type LazySectionId = (typeof LAZY_SECTIONS)[number];
export const isLazySection = (id: string): id is LazySectionId => (LAZY_SECTIONS as readonly string[]).includes(id);

export async function loadPortalSection(id: LazySectionId): Promise<{ status: number; data?: unknown; error?: string }> {
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile) return { status: 401, error: 'Unauthorized' };
  const can = (c: Parameters<typeof hasCapability>[1]) => hasCapability(roles, c);
  const no = { status: 403, error: 'You do not have access to that section.' };
  switch (id) {
    case 'events':
      return can('view_events') ? { status: 200, data: await getEventsData() } : no;
    case 'members':
      return can('view_members') ? { status: 200, data: await getMembersData() } : no;
    case 'docs':
      return can('view_docs') ? { status: 200, data: await getDocsData({ userId: profile.id, canEdit: can('manage_docs') }) } : no;
    case 'albums':
      return can('view_photo_albums') ? { status: 200, data: await getPhotoAlbumsData() } : no;
    case 'divisions': {
      const manage = can('manage_divisions_directory');
      const lead = roles.some((r) => r.role === 'division');
      if (!manage && !lead) return no;
      const [all, mine] = await Promise.all([manage ? getDivisionsData() : Promise.resolve(null), lead ? getMyDivisionsData(roles) : Promise.resolve(null)]);
      return { status: 200, data: { divisions: all?.divisions ?? null, myDivisions: mine ?? null } };
    }
    case 'site-content': {
      if (!can('manage_site_content')) return no;
      const supabase = await createClient();
      const [content, creditPeople] = await Promise.all([getContentData(), getCreditPeople(supabase).catch(() => [])]);
      return { status: 200, data: { contentMap: content?.contentMap ?? null, lastEdited: content?.lastEdited ?? null, creditPeople } };
    }
    case 'shifts': {
      const manage = can('manage_shifts');
      if (!(manage || can('signup_shifts'))) return no;
      return { status: 200, data: await getShiftsData(manage) };
    }
    case 'division-members':
      return can('view_division_members') ? { status: 200, data: { groups: await getDivisionMembersData(can('view_members')) } } : no;
    case 'admin': {
      if (!can('view_admin_dashboard')) return no;
      const [admin, stats, history] = await Promise.all([getAdminData(roles), getStatsData(), can('manage_roles') ? getRoleHistoryData() : Promise.resolve(null)]);
      // The stat tiles carry React icons, which cannot travel as JSON: send just the label and number, the page puts the icon back.
      return { status: 200, data: { admin: { ...admin, stats: admin.stats.map(({ label, value }) => ({ label, value })) }, stats, roleHistoryEntries: history?.entries ?? null } };
    }
  }
}
