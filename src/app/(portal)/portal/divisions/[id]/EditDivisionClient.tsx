'use client';

import { useRouter } from 'next/navigation';
import { deleteIfReplaced } from '@/lib/imageUpload';
import DivisionForm, { type DivisionFormValues } from '../DivisionForm';

export default function EditDivisionClient({
  divisionId,
  initial,
  canManageDirectory,
  backHref,
}: {
  divisionId: string;
  initial: DivisionFormValues;
  canManageDirectory: boolean;
  backHref: string;
}) {
  const router = useRouter();

  // Goes through the existing /api/divisions route (not a direct Supabase
  // call, unlike EditEventClient) — it already encodes real authorization
  // nuance a bare RLS policy can't (a division lead can't rename/re-slug,
  // only exec/admin can), plus server-side sanitization of social_links/
  // social_embeds. No reason to bypass that just to match events' plumbing
  // when the actual ask was a consistent editing *experience*.
  async function handleUpdate(form: DivisionFormValues): Promise<string | void> {
    const res = await fetch('/api/divisions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: divisionId,
        ...(canManageDirectory ? { name: form.name, slug: form.slug } : {}),
        description: form.description,
        logo_url: form.logo_url,
        discord_url: form.discord_url,
        application_url: form.application_url,
        social_links: form.social_links,
        social_embeds: form.social_embeds,
        page_blocks: form.page_blocks,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || 'Failed to save changes. Please try again.';

    deleteIfReplaced(initial.logo_url, form.logo_url.trim() || null);
    router.push(backHref);
  }

  return (
    <DivisionForm
      heading="Edit Division"
      divisionId={divisionId}
      initial={initial}
      submitLabel="Save Changes"
      onSubmit={handleUpdate}
      backHref={backHref}
      canRename={canManageDirectory}
    />
  );
}
