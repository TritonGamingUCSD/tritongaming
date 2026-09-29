import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Next's file-convention OG image — automatically wired up as
// openGraph.images (and, absent a sibling twitter-image.tsx, as the
// Twitter card image too) for this route AND every nested route that
// doesn't define its own opengraph-image.tsx. Replaces the old fallback of
// pointing openGraph.images at /icon.png (a 500x500 favicon-shaped app
// icon, not a real social-preview image) with something actually sized
// and composed for a link preview card.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const logoData = await readFile(join(process.cwd(), 'public/logos/tg_logo.png'));
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a1628 0%, #011941 60%, #0d2a50 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={220} height={220} alt="" />
        <div
          style={{
            marginTop: 36,
            fontSize: 64,
            fontWeight: 700,
            color: '#f2f1f0',
            letterSpacing: '-0.02em',
          }}
        >
          Triton Gaming
        </div>
        <div style={{ marginTop: 12, fontSize: 28, color: '#ffc72c', letterSpacing: '0.08em' }}>
          UC SAN DIEGO&apos;S GAMING ORG
        </div>
      </div>
    ),
    { ...size }
  );
}
