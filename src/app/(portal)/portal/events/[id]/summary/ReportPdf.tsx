// The sponsor report as a real PDF, drawn by us (no browser print dialog, so no web address or page title in the margins). It is loaded only when someone presses Save as PDF.
import { Document, Page, View, Text, Image, Svg, G, Path, Circle, Line, Rect, Font, StyleSheet } from '@react-pdf/renderer';
import type { Bucket } from '@/lib/events/eventSummary';
import type { ReportChoices, ReportData } from './reportTypes';
import { niceScale, twoLines } from './chartMath';

const NAVY = '#011941', GOLD = '#ffc72c', GOLD_DEEP = '#b8860b', ROYAL = '#275a8f', TRACK = '#e8ebf1', INK_SOFT = '#4a5a78', LINE = '#d5dbe6', PANEL = '#f4f6fa';

let fontsReady = false;
function registerFonts(origin: string) {
  if (fontsReady) return;
  Font.register({ family: 'FuturaM', src: `${origin}/fonts/futura-medium-bt.ttf` });
  Font.register({ family: 'FuturaH', src: `${origin}/fonts/futura-heavy-font.ttf` });
  Font.registerHyphenationCallback((w) => [w]);
  fontsReady = true;
}

// The brand fonts have no curly quotes or long dashes, so the text is made plain before it is drawn.
const tx = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/·/g, '|').replace(/…/g, '...');

const st = StyleSheet.create({
  panel: { borderWidth: 0.7, borderColor: LINE, padding: 6 },
  panelTitle: { fontFamily: 'FuturaH', fontSize: 8.6, marginBottom: 1.5 },
  panelNote: { fontSize: 6.6, color: INK_SOFT, marginBottom: 4, lineHeight: 1.3 },
  page: { paddingTop: 28, paddingBottom: 84, paddingHorizontal: 32, fontFamily: 'FuturaM', fontSize: 9.5, color: NAVY, lineHeight: 1.45 },
  masthead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 38, height: 38 },
  brandName: { fontFamily: 'FuturaH', fontSize: 15, letterSpacing: 2, textTransform: 'uppercase' },
  brandTag: { fontSize: 9, color: INK_SOFT, marginTop: 1 },
  docType: { fontFamily: 'FuturaH', fontSize: 8.5, letterSpacing: 2.4, textTransform: 'uppercase', color: GOLD_DEEP, textAlign: 'right' },
  docDate: { fontSize: 8.5, color: INK_SOFT, textAlign: 'right', marginTop: 2 },
  ruleRow: { flexDirection: 'row', height: 3, marginTop: 12 },
  ruleGold: { width: 54, backgroundColor: GOLD },
  ruleNavy: { flexGrow: 1, backgroundColor: NAVY },
  title: { fontFamily: 'FuturaH', fontSize: 24, lineHeight: 1.15, marginTop: 18 },
  when: { fontSize: 11, color: INK_SOFT, marginTop: 5 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 22, paddingBottom: 5, borderBottomWidth: 0.8, borderBottomColor: LINE },
  sectionNum: { fontFamily: 'FuturaH', fontSize: 9, letterSpacing: 1.2, color: GOLD_DEEP },
  sectionTitle: { fontFamily: 'FuturaH', fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase' },
  lead: { fontSize: 9, color: INK_SOFT, marginTop: 6, marginBottom: 2 },
  summaryRow: { flexDirection: 'row', gap: 18, marginTop: 10, alignItems: 'center' },
  gaugeBox: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  gaugeText: { position: 'absolute', top: 0, left: 0, width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  gaugeValue: { fontFamily: 'FuturaH', fontSize: 19, lineHeight: 1.1 },
  gaugeLabel: { fontSize: 6.5, lineHeight: 1.2, letterSpacing: 1, textTransform: 'uppercase', color: INK_SOFT },
  summaryPara: { fontSize: 10.5, lineHeight: 1.55 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  kpi: { paddingTop: 6, paddingBottom: 7, paddingHorizontal: 9, borderTopWidth: 2.5, borderTopColor: GOLD, backgroundColor: PANEL },
  kpiValue: { fontFamily: 'FuturaH', fontSize: 17, lineHeight: 1.1, marginBottom: 3 },
  kpiLabel: { fontSize: 7.5, lineHeight: 1.25, color: INK_SOFT },
  grid: { flexDirection: 'column', gap: 10, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  half: { flex: 1, flexBasis: 0 },
  stack: { flexDirection: 'column', gap: 10 },
  card: { borderWidth: 0.8, borderColor: LINE, padding: 10 },
  wide: { width: '100%' },
  cardTitle: { fontFamily: 'FuturaH', fontSize: 10, marginBottom: 2 },
  note: { fontSize: 7.5, color: INK_SOFT, marginBottom: 6, lineHeight: 1.4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  swatch: { width: 7, height: 7 },
  legendLabel: { flexGrow: 1, flexShrink: 1, fontSize: 8, marginRight: 8 },
  legendVal: { fontSize: 8, color: INK_SOFT, flexShrink: 0 },
  rankRow: { marginBottom: 5 },
  rankTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rankLabel: { fontSize: 8.5, flexShrink: 1 },
  rankTrack: { height: 5, backgroundColor: TRACK, marginTop: 2 },
  colsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 118 },
  colWrap: { flexGrow: 1, flexBasis: 0, alignItems: 'center' },
  colTrack: { width: '100%', maxWidth: 30, height: 80, backgroundColor: '#eef1f6', justifyContent: 'flex-end' },
  colLabel: { fontSize: 5.8, color: INK_SOFT, textAlign: 'center', marginTop: 3 },
  colVal: { fontSize: 7, marginBottom: 2 },
  funnelBar: { paddingVertical: 5, paddingHorizontal: 8, marginTop: 2 },
  funnelValue: { fontFamily: 'FuturaH', fontSize: 10 },
  funnelLabel: { fontSize: 7.5, color: INK_SOFT, marginBottom: 6 },
  splitBar: { flexDirection: 'row', height: 14, backgroundColor: '#eef1f6' },
  ratingValue: { fontFamily: 'FuturaH', fontSize: 28 },
  method: { marginTop: 22, paddingTop: 8, borderTopWidth: 0.8, borderTopColor: LINE, fontSize: 7.5, color: INK_SOFT, lineHeight: 1.5 },
  footText: { fontSize: 7.5, color: INK_SOFT },
});

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function polar(cx: number, cy: number, r: number, a: number) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const [x1, y1] = polar(cx, cy, r, from), [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function Ring({ size, r, width, parts }: { size: number; r: number; width: number; parts: { frac: number; color: string }[] }) {
  const c = size / 2;
  let a = -Math.PI / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={r} stroke={TRACK} strokeWidth={width} fill="none" />
      {parts.filter((p) => p.frac > 0).map((p, i) => {
        const from = a, to = a + Math.min(p.frac, 0.9995) * Math.PI * 2;
        a += p.frac * Math.PI * 2;
        return <Path key={i} d={arc(c, c, r, from, to)} stroke={p.color} strokeWidth={width} fill="none" />;
      })}
    </Svg>
  );
}

// Bars with a value axis and light gridlines, the number above each bar and the label under it on two lines.
function BarChart({ data, color, height = 130, width = 250, xTitle, yTitle }: { data: Bucket[]; color: string; height?: number; width?: number; xTitle?: string; yTitle?: string }) {
  if (!data.length || data.every((d) => d.count === 0)) return <Text style={st.note}>Nothing recorded yet.</Text>;
  const W = width, H = height, L = 24, R = 4, T = yTitle ? 24 : 14, B = xTitle ? 48 : 32;
  const { top, ticks } = niceScale(Math.max(...data.map((d) => d.count)), 3);
  const plotW = W - L - R, plotH = H - T - B, slot = plotW / data.length, bw = Math.min(width > 300 ? 34 : 22, slot * 0.62);
  const y = (v: number) => T + plotH - (v / top) * plotH;
  const font = { fontFamily: 'FuturaM' };
  return (
    <Svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {yTitle ? <Text x={2} y={9} style={{ ...font, fontSize: 7.2, fill: NAVY }}>{tx(yTitle)}</Text> : null}
      {ticks.map((t) => (
        <G key={t}>
          <Line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#9aa6bd' : '#e3e7ee'} strokeWidth={t === 0 ? 0.7 : 0.5} />
          <Text x={L - 4} y={y(t) + 2.5} textAnchor="end" style={{ ...font, fontSize: 7, fill: INK_SOFT }}>{String(t)}</Text>
        </G>
      ))}
      {data.map((d, i) => {
        const cx = L + slot * i + slot / 2;
        const [l1, l2] = twoLines(tx(d.label));
        return (
          <G key={d.label}>
            <Rect x={cx - bw / 2} y={y(d.count)} width={bw} height={Math.max(T + plotH - y(d.count), d.count ? 1 : 0)} fill={color} />
            <Text x={cx} y={y(d.count) - 3} textAnchor="middle" style={{ ...font, fontSize: 7.5, fill: NAVY }}>{String(d.count)}</Text>
            <Text x={cx} y={H - B + 11} textAnchor="middle" style={{ ...font, fontSize: 6.8, fill: INK_SOFT }}>{l1}</Text>
            {l2 ? <Text x={cx} y={H - B + 20} textAnchor="middle" style={{ ...font, fontSize: 6.8, fill: INK_SOFT }}>{l2}</Text> : null}
          </G>
        );
      })}
      {xTitle ? <Text x={L + (W - L - R) / 2} y={H - 2} textAnchor="middle" style={{ ...font, fontSize: 7.2, fill: NAVY }}>{tx(xTitle)}</Text> : null}
    </Svg>
  );
}


// Compact pieces for the one-page layout.
function MiniRank({ data, color, base, n = 5 }: { data: Bucket[]; color: string; base: number; n?: number }) {
  const rows = data.filter((b) => b.label !== 'Other').slice(0, n);
  if (!rows.length) return <Text style={st.note}>No data yet.</Text>;
  return (
    <View>
      {rows.map((b) => (
        <View key={b.label} style={{ marginBottom: 2.6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}><Text style={{ fontSize: 7.5, flexShrink: 1 }}>{tx(b.label)}</Text><Text style={{ fontSize: 7.5, color: INK_SOFT }}>{pct(b.count, base)}%</Text></View>
          <View style={{ height: 3.5, backgroundColor: TRACK, marginTop: 1.5 }}><View style={{ width: `${Math.min(pct(b.count, base), 100)}%`, minWidth: 2, height: 3.5, backgroundColor: color }} /></View>
        </View>
      ))}
    </View>
  );
}

function Panel({ title, note, children, style }: { title: string; note?: string; children: React.ReactNode; style?: React.ComponentProps<typeof View>['style'] }) {
  return (
    <View style={[st.panel, style ?? {}]} wrap={false}>
      <Text style={st.panelTitle}>{tx(title)}</Text>
      {note ? <Text style={st.panelNote}>{tx(note)}</Text> : null}
      {children}
    </View>
  );
}

function Footer({ title }: { title: string }) {
  return (
    <View fixed style={{ position: 'absolute', left: 42, right: 42, bottom: 22, height: 16 }}>
      <View style={{ height: 0.6, backgroundColor: LINE, marginBottom: 5 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={st.footText}>Triton Gaming | Gaming Org at UC San Diego</Text>
        <Text style={st.footText}>{tx(title)}</Text>
        <Text style={st.footText}>tritongaming.org</Text>
      </View>
    </View>
  );
}

export default function ReportPdf({ r, c, origin }: { r: ReportData; c: ReportChoices; origin: string }) {
  registerFonts(origin);
  const s = r.s;
  const hasAudience = s.checkedIn > 0;
  const kpis = [
    { value: s.checkedIn.toLocaleString(), label: 'Attendees' },
    { value: `${s.attendanceRate}%`, label: 'Of registrations attended' },
    { value: s.registered.toLocaleString(), label: 'Registrations' },
    { value: `${r.firstRate}%`, label: 'First-time attendees' },
    ...(s.feedback.average !== null ? [{ value: `${s.feedback.average} / 5`, label: `Average rating (${s.feedback.count})` }] : []),
    ...(s.allDays !== null ? [{ value: s.allDays.toLocaleString(), label: 'Attended every day' }] : []),
  ];
  const social = c.social;
  const rot = [-6, 5, -3, 7, -5, 4];
  const kpiW = Math.floor((548 - 6 * (Math.min(kpis.length, 6) - 1)) / Math.min(kpis.length, 6));
  // The charts take whatever height page 1 has left, so a long title, a long summary, more findings or a second row of social tiles shrink them instead of spilling onto a new page.
  const titleLines = Math.ceil(r.title.length / 42), summaryLines = Math.ceil(r.summary.length / 105);
  const socialPerRow = social.length > 6 ? Math.ceil(social.length / 2) : Math.max(social.length, 1);
  const chartH = Math.max(150, Math.min(300, 226 - (titleLines - 1) * 24 - Math.max(0, summaryLines - 2) * 13 - Math.max(0, r.highlights.length - 3) * 13 - (c.preparedFor?.logo ? 0 : -8) - (social.length > 6 ? 46 : 0) + (social.length ? 0 : 76)));
  const hasPage2 = hasAudience || c.photos.length > 0 || c.thanks.length > 0;
  return (
    <Document title={`${r.title} - Event Impact Report`} author="Triton Gaming" subject="Event Impact Report" creator="Triton Gaming">
      <Page size="LETTER" style={st.page}>
        <Footer title={r.title} />
        <Text fixed style={{ position: 'absolute', left: 32, right: 32, bottom: 40, borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 4, fontSize: 6.3, lineHeight: 1.35, color: INK_SOFT }}>About these figures: registration and attendance come from Triton Gaming's ticketing and on-site check-in at tritongaming.org and have been collected since the 2026-2027 school year (September 2026). Audience and interest details (gender, pronouns, college, major, platforms, games) are optional in the member portal, so those figures cover only attendees who chose to share them; "Not provided" counts those who did not. Shown as totals only; no individual's answers appear.</Text>
        <View style={st.masthead}>
          <View style={st.brand}>
            <Image src={`${origin}/logos/tg_logo.png`} style={{ width: 30, height: 30 }} />
            <View><Text style={[st.brandName, { fontSize: 12 }]}>Triton Gaming</Text><Text style={[st.brandTag, { fontSize: 7.8 }]}>Gaming Org at UC San Diego</Text></View>
          </View>
          <View><Text style={st.docType}>Event Impact Report</Text><Text style={st.docDate}>Prepared {tx(r.prepared)}</Text></View>
        </View>
        <View style={[st.ruleRow, { marginTop: 8 }]}><View style={st.ruleGold} /><View style={st.ruleNavy} /></View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 14, marginTop: 10 }} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={[st.title, { marginTop: 0, fontSize: 19 }]}>{tx(r.title)}</Text>
            <Text style={[st.when, { fontSize: 9.5, marginTop: 3 }]}>{tx(r.when)}</Text>
            {c.preparedFor && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <Text style={{ fontFamily: 'FuturaH', fontSize: 6.8, letterSpacing: 1.4, textTransform: 'uppercase', color: GOLD_DEEP }}>Prepared for</Text>
                {c.preparedFor.logo ? <Image src={c.preparedFor.logo} style={{ height: 30, maxWidth: 120, objectFit: 'contain' }} /> : null}
                <Text style={{ fontFamily: 'FuturaH', fontSize: 11 }}>{tx(c.preparedFor.name)}</Text>
              </View>
            )}
          </View>
          {c.poster ? <Image src={c.poster} style={{ width: 44, objectFit: 'contain', borderWidth: 2, borderColor: '#ffffff', transform: 'rotate(2deg)' }} /> : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 7 }} wrap={false}>
          <View style={{ width: 62, height: 62, alignItems: 'center', justifyContent: 'center' }}>
            <Ring size={62} r={26} width={5} parts={[{ frac: s.attendanceRate / 100, color: NAVY }]} />
            <View style={{ position: 'absolute', top: 0, left: 0, width: 62, height: 62, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'FuturaH', fontSize: 12, lineHeight: 1.1 }}>{s.attendanceRate}%</Text></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, lineHeight: 1.5 }}>{tx(r.summary)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }} wrap={false}>
          {kpis.map((k) => (<View key={k.label} style={[st.kpi, { width: kpiW, paddingTop: 4, paddingBottom: 5 }]}><Text style={[st.kpiValue, { fontSize: 14 }]}>{k.value}</Text><Text style={[st.kpiLabel, { fontSize: 6.8 }]}>{tx(k.label)}</Text></View>))}
        </View>

        {r.highlights.length > 0 && (
          <View style={{ marginTop: 7 }} wrap={false}>
            <Text style={[st.sectionTitle, { fontSize: 9.5, marginBottom: 4 }]}>Key findings</Text>
            <View style={{ gap: 2.5 }}>
              {r.highlights.map((h) => (
                <View key={h.label} style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={{ width: 4, height: 4, backgroundColor: GOLD, marginTop: 3.5, transform: 'rotate(45deg)' }} />
                  <Text style={{ flex: 1, fontSize: 8.3, lineHeight: 1.4 }}><Text style={{ fontFamily: 'FuturaH' }}>{tx(h.label)}  </Text>{tx(h.text)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Panel title={r.multiDay ? 'Attendance by day' : 'Arrival times'} note={r.peakNote ?? undefined} style={{ flex: 1, flexBasis: 0 }}><BarChart data={s.arrivals} color={ROYAL} height={chartH} width={262} xTitle={r.multiDay ? 'Day' : 'Time of arrival (Pacific time)'} yTitle="People checked in" /></Panel>
          <Panel title="When tickets were claimed" note="How far ahead of the event people registered." style={{ flex: 1, flexBasis: 0 }}><BarChart data={s.claimTiming} color={ROYAL} height={chartH} width={262} xTitle="How far ahead of the event" yTitle="Tickets claimed" /></Panel>
        </View>
        {social.length > 0 && (
          <Panel title="Social media reach" note="Reported by Triton Gaming from its own accounts." style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {social.map((m, i) => (<View key={i} style={[st.kpi, { width: `${Math.floor(96 / socialPerRow) - 1}%`, paddingTop: 4, paddingBottom: 5 }]}><Text style={[st.kpiValue, { fontSize: 13 }]}>{tx(m.value)}</Text><Text style={[st.kpiLabel, { fontSize: 6.8 }]}>{tx(m.label)}</Text></View>))}
            </View>
          </Panel>
        )}
      </Page>

      {hasPage2 && (
        <Page size="LETTER" style={st.page}>
          <Footer title={r.title} />
          {hasAudience && (
            <View>
              <View style={[st.sectionHead, { marginTop: 0 }]}><Text style={st.sectionTitle}>Who attended</Text></View>
              <Text style={st.lead}>Shares of the {s.checkedIn.toLocaleString()} people who checked in. Optional profile details cover only attendees who chose to share them.</Text>
              <View style={{ gap: 8, marginTop: 6 }}>
                {([
                  [['Class year', s.year, NAVY], ['Colleges', s.college, ROYAL]],
                  [['Fields of study', s.field, NAVY], ['Top majors', s.major, ROYAL]],
                  [['Gender', s.gender, NAVY], ['Pronouns', s.pronouns, ROYAL]],
                  [['Platforms', s.platforms, GOLD_DEEP], ['Favorite games', s.games, GOLD_DEEP]],
                ] as [string, Bucket[], string][][]).map((pair) => (
                  <View key={pair[0][0]} style={{ flexDirection: 'row', gap: 10 }}>
                    {pair.map(([t, d, col]) => (
                      <Panel key={t} title={t} style={{ flex: 1, flexBasis: 0 }}><MiniRank data={d} color={col} base={s.checkedIn} n={4} /></Panel>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}
          {c.photos.length > 0 && (
            <View break={hasAudience} style={{ marginTop: 0 }}>
              <View style={[st.sectionHead, { marginTop: 0 }]}><Text style={st.sectionTitle}>Event photos</Text></View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {c.photos.map((p, i) => (
                  <View key={i} style={{ width: c.photos.length === 1 ? '100%' : '48.8%' }} wrap={false}>
                    <Image src={p.src} style={{ width: '100%', height: c.photos.length === 1 ? 240 : 110, objectFit: 'cover' }} />
                    {(p.caption || p.credit) ? <Text style={{ fontSize: 7.5, color: INK_SOFT, marginTop: 3 }}>{tx(p.caption)}{p.caption && p.credit ? ' | ' : ''}{p.credit ? `Photo: ${tx(p.credit)}` : ''}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          )}
          {c.thanks.length > 0 && (
            <View style={{ marginTop: 14 }} wrap={false}>
              <View style={[st.sectionHead, { marginTop: 0 }]}><Text style={st.sectionTitle}>{c.preparedFor ? `Thank you, ${tx(c.preparedFor.name)}` : 'With thanks to our sponsors'}</Text></View>
              <Text style={st.lead}>{c.preparedFor ? 'Thank you for supporting this event.' : 'This event was supported by:'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 22, marginTop: 8, alignItems: 'center' }}>
                {c.thanks.map((sp) => (
                  <View key={sp.name} style={{ alignItems: 'center', gap: 4 }}>
                    {sp.logo ? <Image src={sp.logo} style={{ height: 48, maxWidth: 140, objectFit: 'contain' }} /> : null}
                    <Text style={{ fontSize: 8.5 }}>{tx(sp.name)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {c.stickers.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 24, marginTop: 26 }} wrap={false}>
              {c.stickers.map((u, i) => <Image key={i} src={u} style={{ height: 50, maxWidth: 86, objectFit: 'contain', transform: `rotate(${rot[i % rot.length]}deg)` }} />)}
            </View>
          )}
        </Page>
      )}
    </Document>
  );
}
