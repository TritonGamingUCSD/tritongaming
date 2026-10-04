// The three link-preview card designs as plain React elements (no Next.js dependencies), so the routes and a stand-alone render script share them.
import { titleSize } from './ogCard';

export function RootCard({ logo }: { logo: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#060c1a' }}>
      <div style={{ display: 'flex', height: 26, background: '#ffc72c' }} />
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '0 80px', gap: 56 }}>
        <div style={{ display: 'flex', padding: 24, background: '#f2efe6', border: '6px solid #0a1630', boxShadow: '12px 12px 0 #000', transform: 'rotate(-4deg)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={230} height={230} alt="" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', fontFamily: 'Futura-Heavy', fontSize: 74, lineHeight: 1, color: '#f2f1f0', textTransform: 'uppercase' }}>Triton Gaming</div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', padding: '10px 22px', background: '#ffc72c', color: '#0a1630', fontFamily: 'Futura-Heavy', fontSize: 34, textTransform: 'uppercase', transform: 'rotate(-1.5deg)', boxShadow: '6px 6px 0 #000' }}>
            Gaming Org at UC San Diego
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', height: 26, background: '#ffc72c' }} />
    </div>
  );
}

export function EventCard({ p }: { p: { title: string; past: boolean; poster: string; bg: string; accent: string; text: string; date: string; time: string; location: string; logo: string } }) {
  const { title, past, poster, bg, accent, text, date, time, location, logo } = p;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: bg }}>
      <div style={{ display: 'flex', height: 22, background: accent }} />
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '0 70px', gap: 60 }}>
        {poster && (
          <div style={{ display: 'flex', padding: 14, background: '#f2efe6', border: '5px solid #0a1630', boxShadow: '12px 12px 0 rgba(0,0,0,0.6)', transform: 'rotate(-2.5deg)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster} height={440} alt="" style={{ height: 440, maxWidth: 420, objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 20 }}>
          <div style={{ display: 'flex', alignSelf: 'flex-start', padding: '8px 20px', background: accent, color: '#0a1630', fontFamily: 'Futura-Heavy', fontSize: 28, textTransform: 'uppercase', boxShadow: '5px 5px 0 #000' }}>
            {past ? 'Past event' : 'Event'}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Futura-Heavy', fontSize: titleSize(title), lineHeight: 1.05, color: text, textTransform: 'uppercase' }}>{title}</div>
          {true && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'Futura-Medium', fontSize: 34, color: text }}>
              <div style={{ display: 'flex' }}>{date}</div>
              <div style={{ display: 'flex', opacity: 0.8 }}>{time}</div>
              {location && <div style={{ display: 'flex', color: accent }}>{location}</div>}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, fontFamily: 'Futura-Heavy', fontSize: 24, color: text, opacity: 0.85, textTransform: 'uppercase' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={44} height={44} alt="" />
            <span>Triton Gaming</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', height: 22, background: accent }} />
    </div>
  );
}

export function DivisionCard({ p }: { p: { name: string; pitch: string; logoUrl: string } }) {
  const { name, pitch, logoUrl } = p;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#060c1a' }}>
      <div style={{ display: 'flex', height: 22, background: '#ffc72c' }} />
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '0 80px', gap: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 330, height: 330, background: '#f2efe6', border: '6px solid #0a1630', borderRadius: 56, boxShadow: '12px 12px 0 rgba(0,0,0,0.6)', transform: 'rotate(-4deg)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} width={250} height={250} alt="" style={{ objectFit: 'contain' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 22 }}>
          <div style={{ display: 'flex', alignSelf: 'flex-start', padding: '8px 20px', background: '#ffc72c', color: '#0a1630', fontFamily: 'Futura-Heavy', fontSize: 28, textTransform: 'uppercase', boxShadow: '5px 5px 0 #000' }}>Division</div>
          <div style={{ display: 'flex', fontFamily: 'Futura-Heavy', fontSize: titleSize(name, 84), lineHeight: 1.05, color: '#f2f1f0', textTransform: 'uppercase' }}>{name}</div>
          {pitch && <div style={{ display: 'flex', fontFamily: 'Futura-Medium', fontSize: 32, lineHeight: 1.3, color: '#ffd966' }}>{pitch}</div>}
          <div style={{ display: 'flex', fontFamily: 'Futura-Heavy', fontSize: 24, color: '#f2f1f0', opacity: 0.85, textTransform: 'uppercase', marginTop: 8 }}>Triton Gaming · Gaming Org at UC San Diego</div>
        </div>
      </div>
      <div style={{ display: 'flex', height: 22, background: '#ffc72c' }} />
    </div>
  );
}
