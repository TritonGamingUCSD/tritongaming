import type { QRCodeOptions } from '@/lib/qr/qrCodeStyling';

export interface QRBadgeOptions {
  qrSize: number;
  qrMargin: number;
  seed: number;
  eventLabel: string;
  dotsColor: string;
  dotsGradientEnabled: boolean;
  dotsGradientStartColor: string;
  dotsGradientEndColor: string;
  cornersDotColor: string;
}

// Cheap string hash — just needs to spread different ticket codes to
// different-looking decorative patterns, not to be cryptographically sound.
function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) >>> 0;
  return h;
}

export function qrBadgeOptionsFromQR(qr: QRCodeOptions, eventLabel: string): QRBadgeOptions {
  return {
    qrSize: qr.size,
    qrMargin: qr.margin,
    // The ticket's real QR data rotates on a short timer (see ROTATION_SECONDS
    // in rotatingCode.ts) — reseeding the
    // decorative pattern from it means the ring visibly reshuffles in lockstep
    // with each refresh, reading as "part of the same live code" rather than
    // a static frame sitting behind an animated one.
    seed: hashSeed(qr.data),
    eventLabel,
    dotsColor: qr.dotsColor,
    dotsGradientEnabled: qr.dotsGradientEnabled,
    dotsGradientStartColor: qr.dotsGradientStartColor,
    dotsGradientEndColor: qr.dotsGradientEndColor,
    cornersDotColor: qr.cornersDotColor,
  };
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = a.match(/\w\w/g)?.map((h) => parseInt(h, 16)) ?? [0, 0, 0];
  const pb = b.match(/\w\w/g)?.map((h) => parseInt(h, 16)) ?? [0, 0, 0];
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

// Deterministic "random" bit from a grid position plus a seed (no
// Math.random) — stable for the duration of one drawn frame (never flickers
// mid-render), but reshuffles whenever the seed changes, which is exactly
// once per rotating QR refresh (see qrBadgeOptionsFromQR).
function pseudoRandomBit(row: number, col: number, seed: number, threshold: number): boolean {
  const h = Math.sin(row * 12.9898 + col * 78.233 + seed * 0.010831) * 43758.5453;
  return h - Math.floor(h) > threshold;
}

// Curved text, one glyph at a time — each character is placed on the circle
// of the given radius and rotated to stay tangent to it, the standard
// canvas technique for "text following an arc." angle=0 is the top of the
// circle (12 o'clock), increasing clockwise — at angle=0 a character sits
// upright as normally read; going all the way around, the bottom half ends
// up inverted relative to the viewer, which is the expected look for text
// that wraps a full circle (a coin's rim, a wax seal), not a bug — every
// character stays tangent/upright *relative to the circle*, just not
// relative to gravity once you're on the far side of it.
function drawArcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  font: string,
  color: string,
  letterSpacing: number
) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const chars = text.split('');
  const charAngles = chars.map((c) => (ctx.measureText(c).width + letterSpacing) / radius);

  let angle = startAngle;
  chars.forEach((char, i) => {
    angle += charAngles[i] / 2;
    const x = centerX + radius * Math.sin(angle);
    const y = centerY - radius * Math.cos(angle);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillText(char, 0, 0);
    ctx.restore();
    angle += charAngles[i] / 2;
  });
  ctx.restore();
}

// Repeats `label` (joined by a separator) enough times to wrap all the way
// around a circle of the given radius, so the ring reads as a continuous
// band instead of one short arc sitting near the top.
function buildRingText(ctx: CanvasRenderingContext2D, label: string, radius: number, font: string, letterSpacing: number): string {
  ctx.save();
  ctx.font = font;
  const unit = `${label}  •  `;
  const unitWidth = unit.split('').reduce((sum, c) => sum + ctx.measureText(c).width + letterSpacing, 0);
  ctx.restore();
  const circumference = 2 * Math.PI * radius;
  const repeats = Math.max(1, Math.round(circumference / unitWidth));
  return unit.repeat(repeats);
}

// `repeats` above is rounded to a whole number of copies, so the text's
// actual raw width essentially never lands exactly on the circumference —
// there's always a small leftover or shortfall. Left alone, that shows up
// entirely as one gap where the ring wraps back to its own start (nothing
// separates the *drawn* end from the *drawn* start). Instead, solve for the
// exact letter-spacing that makes the text's width match the circumference
// precisely, then apply that spacing uniformly to every character — the
// same fix full text-justify makes on a straight line, applied around a
// circle: spread the slack evenly across every gap instead of dumping all
// of it into one seam.
function justifiedLetterSpacing(ctx: CanvasRenderingContext2D, text: string, radius: number, font: string): number {
  ctx.save();
  ctx.font = font;
  const rawWidth = text.split('').reduce((sum, c) => sum + ctx.measureText(c).width, 0);
  ctx.restore();
  const circumference = 2 * Math.PI * radius;
  return (circumference - rawWidth) / text.length;
}

// Fills the "lens" gaps between the real QR's module area and the
// circumscribing circle with small dots — purely decorative (not real data,
// never touched by a scanner's expectations), it just makes the circle look
// like the same dot pattern extends all the way to its edge instead of
// leaving that gap blank. Module size is a visual estimate (this ticket's
// real QR's exact module count varies with its data), not something that
// needs to line up pixel-for-pixel with the real grid — it just needs to
// look consistent. Kept blue-only (never the yellow/orange finder-pattern
// color) so that accent color reads unambiguously as "this is a finder
// corner" only where the real QR actually has one — sprinkling it into the
// decoration would make the ring look like it has finder patterns of its
// own and muddy the real ones.
function fillGapDecoration(ctx: CanvasRenderingContext2D, cx: number, cy: number, contentSize: number, circleRadius: number, badge: QRBadgeOptions) {
  const estimatedModules = 29; // typical version-3 QR, close enough for a decorative grid
  const moduleSize = contentSize / estimatedModules;
  const half = contentSize / 2;
  const cols = Math.ceil((circleRadius * 2) / moduleSize);

  for (let row = -cols; row <= cols; row++) {
    for (let col = -cols; col <= cols; col++) {
      const dx = col * moduleSize;
      const dy = row * moduleSize;
      // Skip anything over the real QR's module area — that's the actual
      // scannable content, drawn separately and never touched.
      if (Math.abs(dx) < half && Math.abs(dy) < half) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const outerEdge = circleRadius - moduleSize * 0.4;
      if (dist > outerEdge) continue;
      // Density tapers off the further out a dot sits, so the ring thins
      // toward the circle's edge like the real QR's own pattern trailing
      // off, instead of staying uniformly dense right up to a hard cutoff.
      const falloff = 1 - Math.pow(Math.max(0, dist - half) / (outerEdge - half), 1.6) * 0.75;
      if (!pseudoRandomBit(row, col, badge.seed, 0.5 / falloff)) continue;

      // Distance-from-center, not angle — the real QR's own gradient
      // (see getDotsGradient) is `type: 'radial'`, i.e. center-to-edge, so
      // matching that axis here means the decoration's color wash actually
      // continues the real QR's own gradient outward instead of running in
      // a different, angle-based direction that would read as a mismatched
      // second pattern layered next to it.
      const t = Math.min(1, dist / circleRadius);
      ctx.fillStyle = badge.dotsGradientEnabled
        ? lerpColor(badge.dotsGradientStartColor, badge.dotsGradientEndColor, t)
        : badge.dotsColor;
      // Plain circles — matches the real QR's own 'dots' module style (see
      // TICKET_QR_BASE) so the two patterns read as one continuous field
      // instead of two different rounding styles sitting next to each
      // other. Slightly oversized so neighboring "on" dots touch/overlap a
      // little rather than leaving visible pinholes of white between them.
      const r = moduleSize * 0.52;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Composites the ticket's circular QR badge: the real, fully intact QR
// (untouched — never cropped) centered on a larger white canvas, with the
// same dot style decoratively extended into the ring around it so the
// pattern reads as continuous out to the circle's edge, and the event name
// arced along the top.
//
// IMPORTANT — why the real QR itself is never cropped: an earlier version
// tried to get a *tight* circular crop by giving qr-code-styling a huge
// `margin` and clipping into that blank quiet-zone, on the theory that
// margin is pure padding around the real modules. Empirically (tested with
// this project's actual qr-code-styling + jsQR, the same decoder the
// check-in scanner uses) that broke decoding — a margin that large distorts
// the code itself in this library, not just the whitespace around it. This
// version never clips a single real QR pixel: it draws the QR at its normal
// working size, then adds ITS OWN extra blank canvas around that (plain
// fillRect, not the library's margin option), and only clips a circle
// through that self-added blank space — a circle that *circumscribes* the
// whole QR square (radius = half the square's diagonal, plus a safety
// buffer) so the crop boundary never gets anywhere near real data. Verified
// with an actual decode test before shipping, not just by the geometry.
// The decorative fill outside that square is exactly that — decorative —
// so it carries none of that risk.
export function drawQRBadge(canvas: HTMLCanvasElement, qrCanvas: HTMLCanvasElement, badge: QRBadgeOptions) {
  const { qrSize, qrMargin } = badge;

  // qr-code-styling bakes its own blank quiet-zone (the `margin` option)
  // into the QR canvas itself, inside the qrSize x qrSize image — it's not
  // extra space added around the image afterward. Left alone, that shows up
  // as a plain white ring between the real dark modules and this badge's
  // decorative fill (the fill can't paint "through" the real QR image, and
  // the real QR image includes that blank band). Crop most of it off when
  // compositing — pure blank canvas, no real modules — while keeping a
  // small strip so there's still *some* quiet zone for reliable scanning;
  // that's the same margin value ticket QR generation already uses (10px)
  // and is untouched here, only how much of the rendered blank band gets
  // drawn into the badge changes.
  const retainedQuietZone = 2;
  const cropMargin = Math.max(0, qrMargin - retainedQuietZone);
  const contentSize = qrSize - cropMargin * 2;

  // Tightened as far as is still safe — this can't go below the trimmed
  // square's own half-diagonal without clipping real modules (see the big
  // comment below), so this is close to the minimum buffer, not an
  // arbitrary gap.
  const circleRadius = (contentSize * Math.SQRT2) / 2 + 4;
  // Text sits close enough to overlap the rim slightly rather than floating
  // in a separate ring further out — no visible border/gap between "the QR"
  // and "the text around it," they read as one continuous badge.
  const textRadius = circleRadius + 6;
  // This margin has to clear the arced text's own outward reach, not just
  // its center radius — an 11px bold glyph's cap-height/descender extends
  // roughly +/-8px past its baseline, so shrinking this below that let
  // letter tips poke past the white backdrop into the transparent canvas
  // beyond it, rendering as a jagged, "cut off" edge against the page
  // background instead of a clean circle. 10 keeps a couple pixels of
  // breathing room past that.
  const size = Math.ceil((textRadius + 10) * 2);
  const cx = size / 2;
  const cy = size / 2;

  // Deliberately NOT scaled by devicePixelRatio, even though that would make
  // the decorative dots/text crisper on retina screens — devicePixelRatio is
  // 2-3 on essentially every phone, and scaling the backing store like that
  // forces the browser to resample the real QR image when it's drawn in
  // (still same on-screen size, but now more physical pixels backing it),
  // which is a real raster resize, not just a display-time one. Confirmed by
  // actually decoding the output with jsQR: at devicePixelRatio 1 it decodes
  // fine, but at 2 or 3 — or even a 1% scale mismatch — it silently fails to
  // decode. The real QR has to be copied at true 1:1, zero resampling, so
  // this canvas's backing store always matches its own logical size exactly.
  //
  // Also NOT setting canvas.style.width/height here — that outranks the
  // stylesheet's aspect-ratio/height:auto (TicketQRBadge .module.css) no
  // matter what it says, which is exactly what once squashed this into an
  // oval: CSS could shrink the *width* (max-width: 280px) but an inline style
  // here would pin the height to the full unscaled size regardless. Leave
  // the displayed size entirely to CSS.
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);

  // White backdrop — the badge is a standalone graphic, not dependent on
  // whatever's behind it. Drawn flush to the canvas's own edge (radius
  // exactly size/2, no inset) so it lines up exactly with the CSS wrapper's
  // border-radius:50% box outside it (same box, same radius) — an inset
  // here left a sliver of transparent canvas between the visible white
  // circle and the glow, which showed through as a thin, oddly-colored ring
  // right at the boundary instead of the glow sitting flush against the
  // white edge.
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Event name, wrapping the full ring — repeated with a separator so it
  // reads as a continuous band all the way around, not one short arc. Sits
  // right against the QR's own edge (see textRadius above) instead of a
  // separate rim/stroke sitting between them — a border there just read as
  // the text being "blocked off" from the code instead of surrounding it.
  if (badge.eventLabel) {
    const font = "700 11px 'Futura-Heavy','Arial Black',sans-serif";
    const ringText = buildRingText(ctx, badge.eventLabel.toUpperCase(), textRadius, font, 1);
    const spacing = justifiedLetterSpacing(ctx, ringText, textRadius, font);
    drawArcText(ctx, ringText, cx, cy, textRadius, 0, font, badge.cornersDotColor, spacing);
  }

  // Decorative fill between the real QR's module area and the circle —
  // drawn first so the real QR (next) paints on top of it, covering any
  // slight overlap at the seam.
  fillGapDecoration(ctx, cx, cy, contentSize, circleRadius, badge);

  // The QR itself — its real modules are completely untouched (only the
  // blank quiet-zone band around them is cropped out, see above), just
  // clipped to a circle that never reaches its actual content (see the big
  // comment above).
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    qrCanvas,
    cropMargin, cropMargin, contentSize, contentSize,
    cx - contentSize / 2, cy - contentSize / 2, contentSize, contentSize
  );
  ctx.restore();
}
