'use client';

import { useEffect, useState } from 'react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import type { DivisionHat } from '@/components/portal/hubTypes';
import { deleteIfReplaced } from '@/lib/storage/imageUpload';
import DivisionForm, { type DivisionFormValues } from '../divisions/DivisionForm';

// The division's Page screen: everything on its public page (banner, tagline, color, description, links, blocks, posts) edited right inside the division's own portal, with the live preview beside it.
export default function DivisionPageEditor({ hat }: { hat: DivisionHat }) {
  const [data, setData] = useState<{ initial: DivisionFormValues; canRename: boolean; creditPeople: import('@/lib/members/creditPeople').CreditPerson[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    fetch(`/api/divisions/${hat.id}/page-data`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) setError(j.error || 'Could not load the page.');
        else setData(j);
      })
      .catch(() => live && setError('Network error loading the page.'));
    return () => {
      live = false;
    };
  }, [hat.id]);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <Loading variant="inline" label="Loading the page…" />;

  async function save(form: DivisionFormValues): Promise<string | void> {
    const res = await fetch('/api/divisions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: hat.id,
        ...(data!.canRename ? { name: form.name, slug: form.slug } : {}),
        description: form.description,
        logo_url: form.logo_url,
        discord_url: form.discord_url,
        application_url: form.application_url,
        social_links: form.social_links,
        social_embeds: form.social_embeds,
        page_blocks: form.page_blocks,
        accent: form.accent,
        tagline: form.tagline,
        banner_url: form.banner_url,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return j.error || 'Failed to save changes. Please try again.';
    deleteIfReplaced(data!.initial.logo_url, form.logo_url.trim() || null);
    deleteIfReplaced(data!.initial.banner_url, form.banner_url.trim() || null);
  }

  return (
    <DivisionForm
      embedded
      heading="Page"
      divisionId={hat.id}
      initial={data.initial}
      submitLabel="Save Changes"
      onSubmit={save}
      backHref={`/portal/${hat.slug}`}
      canRename={data.canRename}
      creditPeople={data.creditPeople}
    />
  );
}
