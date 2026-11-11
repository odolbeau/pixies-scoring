/**
 * Départage des cartes de même illustration (elles ne diffèrent que par leurs symboles) : on compare la
 * photo aux miniatures de référence de chaque variante, redressées à la même place, sur les zones où
 * les variantes se distinguent. Port de `pick_variant` (ml/scripts/sift_match.py).
 */
import type { CV } from "./recognize";
import type { Pt } from "./geometry";
import type { RefCard } from "./refs";

export interface VariantCandidate {
  id: string;
  quad: Pt[];
  H: number[];
}

/** Zones de la carte (fractions x0, x1, y0, y1) où se trouvent les symboles. */
const SYMBOL_ZONES: [number, number, number, number][] = [
  [0.03, 0.4, 0.02, 0.2],
  [0.03, 0.22, 0.02, 0.5],
  [0.7, 0.97, 0.02, 0.45],
  [0.04, 0.55, 0.87, 0.98],
];

function tophat(cv: CV, src: CV): Uint8Array {
  const blur = new cv.Mat();
  cv.GaussianBlur(src, blur, new cv.Size(0, 0), 1.0);
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9));
  const out = new cv.Mat();
  cv.morphologyEx(blur, out, cv.MORPH_TOPHAT, kernel);
  const data = Uint8Array.from(out.data as Uint8Array);
  blur.delete();
  kernel.delete();
  out.delete();
  return data;
}

/** M = T · H · S : de la miniature vers le recadrage de la photo. */
function thumbToCrop(H: number[], ref: RefCard, thumbW: number, x0: number, y0: number): number[] {
  const s = ref.width / thumbW;
  const HS = [H[0] * s, H[1] * s, H[2], H[3] * s, H[4] * s, H[5], H[6] * s, H[7] * s, H[8]];
  return [
    HS[0] - x0 * HS[6], HS[1] - x0 * HS[7], HS[2] - x0 * HS[8],
    HS[3] - y0 * HS[6], HS[4] - y0 * HS[7], HS[5] - y0 * HS[8],
    HS[6], HS[7], HS[8],
  ];
}

function warpThumb(cv: CV, data: Uint8Array, w: number, h: number, M: number[], cw: number, ch: number, interpolation: number): Uint8Array {
  const src = cv.matFromArray(h, w, cv.CV_8UC1, Array.from(data));
  const m = cv.matFromArray(3, 3, cv.CV_64F, M);
  const dst = new cv.Mat();
  cv.warpPerspective(src, dst, m, new cv.Size(cw, ch), interpolation, cv.BORDER_CONSTANT, new cv.Scalar());
  const out = Uint8Array.from(dst.data as Uint8Array);
  src.delete();
  m.delete();
  dst.delete();
  return out;
}

function percentile(sorted: number[], q: number): number {
  const pos = (q / 100) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function bestCorrelation(tp: Uint8Array, ta: Uint8Array, mask: Uint8Array, cw: number, ch: number, shift = 3): number {
  let x0 = cw, x1 = -1, y0 = ch, y1 = -1, count = 0;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (!mask[y * cw + x]) continue;
      count++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (count < 30) return 0;
  const idx: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (mask[y * cw + x]) idx.push(y * cw + x);
  const a = idx.map((i) => tp[i]);
  const meanA = a.reduce((s, v) => s + v, 0) / a.length;
  const da = a.map((v) => v - meanA);
  const normA = Math.hypot(...da);
  let best = -1;
  for (let dy = -shift; dy <= shift; dy++) {
    for (let dx = -shift; dx <= shift; dx++) {
      const b = idx.map((i) => {
        const y = Math.floor(i / cw);
        const x = i % cw;
        return ta[((((y - dy) % ch) + ch) % ch) * cw + ((((x - dx) % cw) + cw) % cw)];
      });
      const meanB = b.reduce((s, v) => s + v, 0) / b.length;
      let dot = 0;
      let nb = 0;
      for (let i = 0; i < b.length; i++) {
        const db = b[i] - meanB;
        dot += da[i] * db;
        nb += db * db;
      }
      best = Math.max(best, dot / (normA * Math.sqrt(nb) + 1e-6));
    }
  }
  return best;
}

/** Renvoie la variante la mieux corrélée avec la photo (la première par défaut). */
export function pickVariant<T extends VariantCandidate>(cv: CV, gray: CV, first: T, alts: T[], refs: Map<string, RefCard>): T {
  const cands = [first, ...alts];
  const cardRefs = cands.map((c) => refs.get(c.id));
  if (cardRefs.some((r) => !r?.thumb)) return first;

  const W = gray.cols as number;
  const Hh = gray.rows as number;
  const xs = cands.flatMap((c) => c.quad.map((p) => p[0]));
  const ys = cands.flatMap((c) => c.quad.map((p) => p[1]));
  // Moyenne des quadrilatères (même ordre de coins pour toutes les variantes).
  const quad: Pt[] = [0, 1, 2, 3].map((i) => [
    cands.reduce((s, c) => s + c.quad[i][0], 0) / cands.length,
    cands.reduce((s, c) => s + c.quad[i][1], 0) / cands.length,
  ]);
  void xs;
  void ys;
  const qx = quad.map((p) => p[0]);
  const qy = quad.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...qx)) - 6);
  const y0 = Math.max(0, Math.floor(Math.min(...qy)) - 6);
  const x1 = Math.min(W, Math.ceil(Math.max(...qx)) + 6);
  const y1 = Math.min(Hh, Math.ceil(Math.max(...qy)) + 6);
  if (x1 - x0 < 40 || y1 - y0 < 40) return first;
  const cw = x1 - x0;
  const ch = y1 - y0;

  // Intérieur de la carte, à 4 px des bords.
  const area2 = quad.reduce((s, p, i) => s + (p[0] * quad[(i + 1) % 4][1] - quad[(i + 1) % 4][0] * p[1]), 0);
  const edges = (area2 >= 0 ? quad : [...quad].reverse()).map((p, i, o) => {
    const q = o[(i + 1) % 4];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return { p, dx: (q[0] - p[0]) / len, dy: (q[1] - p[1]) / len };
  });
  const inq = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const px = x + x0;
      const py = y + y0;
      inq[y * cw + x] = edges.every((e) => e.dx * (py - e.p[1]) - e.dy * (px - e.p[0]) >= 4) ? 1 : 0;
    }
  }

  const roi = gray.roi(new cv.Rect(x0, y0, cw, ch));
  const tp = tophat(cv, roi);
  roi.delete();

  const tops = cands.map((c, i) => {
    const t = (cardRefs[i] as RefCard).thumb as NonNullable<RefCard["thumb"]>;
    const warped = warpThumb(cv, t.data, t.width, t.height, thumbToCrop(c.H, cardRefs[i] as RefCard, t.width, x0, y0), cw, ch, cv.INTER_LINEAR);
    const m = cv.matFromArray(ch, cw, cv.CV_8UC1, Array.from(warped));
    const th = tophat(cv, m);
    m.delete();
    return th;
  });
  const diff = new Uint8Array(cw * ch);
  for (let i = 0; i < diff.length; i++) {
    let mx = 0;
    let mn = 255;
    for (const t of tops) {
      if (t[i] > mx) mx = t[i];
      if (t[i] < mn) mn = t[i];
    }
    diff[i] = mx - mn;
  }

  const inside: number[] = [];
  for (let i = 0; i < diff.length; i++) if (inq[i]) inside.push(diff[i]);
  if (inside.length === 0) return first;
  inside.sort((a, b) => a - b);
  const thr = Math.max(10, 0.5 * percentile(inside, 99));

  const firstThumb = (cardRefs[0] as RefCard).thumb as NonNullable<RefCard["thumb"]>;
  const zone = new Uint8Array(firstThumb.width * firstThumb.height);
  for (const [fx0, fx1, fy0, fy1] of SYMBOL_ZONES) {
    for (let y = Math.floor(fy0 * firstThumb.height); y < Math.floor(fy1 * firstThumb.height); y++) {
      for (let x = Math.floor(fx0 * firstThumb.width); x < Math.floor(fx1 * firstThumb.width); x++) zone[y * firstThumb.width + x] = 255;
    }
  }
  const zmask = warpThumb(cv, zone, firstThumb.width, firstThumb.height, thumbToCrop(first.H, cardRefs[0] as RefCard, firstThumb.width, x0, y0), cw, ch, cv.INTER_LINEAR);

  const D = new Uint8Array(cw * ch);
  for (let i = 0; i < D.length; i++) D[i] = diff[i] > thr && inq[i] && zmask[i] > 0 ? 1 : 0;
  // Dilatation 5×5 limitée à l'intérieur de la carte.
  const dil = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (!inq[y * cw + x]) continue;
      let hit = 0;
      for (let dy = -2; dy <= 2 && !hit; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < ch && xx >= 0 && xx < cw && D[yy * cw + xx]) {
            hit = 1;
            break;
          }
        }
      }
      dil[y * cw + x] = hit;
    }
  }

  const scores = tops.map((t) => bestCorrelation(tp, t, dil, cw, ch));
  return cands[scores.indexOf(Math.max(...scores))];
}
