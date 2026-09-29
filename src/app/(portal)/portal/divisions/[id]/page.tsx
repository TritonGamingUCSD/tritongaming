import { redirect, notFound } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import EditDivisionClient from './EditDivisionClient';
import type { DivisionFormValues } from '../DivisionForm';

export const metadata = { title: 'Edit Division' };
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export default async function EditDivisionPage({ params }: Params) {
  const { id } = await params;
  const roles = await getUserRoles();
  // Scoped exactly like the RLS policy that actually enforces this write
  // (manage_division can update own division content) — true unconditionally
  // for lead/exec/admin, true for a 'division' role holder only when this
  // id matches their own division_id. One edit page serves both the full
  // exec/admin directory and a division lead editing just their own page.
  if (!hasCapability(roles, 'manage_division', id)) redirect('/portal');

  const supabase = await createClient();
  const { data: division } = await supabase
    .from('divisions')
    .select('id, name, slug, description, logo_url, discord_url, application_url, social_links, social_embeds')
    .eq('id', id)
    .maybeSingle();

  if (!division) notFound();

  // Renaming/re-slugging a division changes its public URL — a
  // directory-level decision reserved for exec/admin, not day-to-day
  // content upkeep a division lead does. See the /api/divisions route's
  // own canManageDirectory gate, which actually enforces this.
  const canManageDirectory = hasCapability(roles, 'manage_divisions_directory');

  const initial: DivisionFormValues = {
    name: division.name,
    slug: division.slug,
    description: division.description ?? '',
    logo_url: division.logo_url ?? '',
    discord_url: division.discord_url ?? '',
    application_url: division.application_url ?? '',
    social_links: division.social_links ?? {},
    social_embeds: division.social_embeds ?? [],
  };

  return (
    <EditDivisionClient
      divisionId={division.id}
      initial={initial}
      canManageDirectory={canManageDirectory}
      backHref={canManageDirectory ? '/portal?section=site-content&tab=divisions' : '/portal?section=site-content&tab=my-division'}
    />
  );
}
