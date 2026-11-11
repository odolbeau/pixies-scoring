/** Géométrie 2D élémentaire pour les quadrilatères convexes détectés sur la photo. */
export type Pt = [number, number];

export function signedArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function area(poly: Pt[]): number {
  return Math.abs(signedArea(poly));
}

/** Même sens de parcours pour tous les polygones (aire signée positive). */
function oriented(poly: Pt[]): Pt[] {
  return signedArea(poly) >= 0 ? poly : [...poly].reverse();
}

/** Intersection de deux polygones convexes (Sutherland–Hodgman) ; vide si disjoints. */
export function intersectConvex(a: Pt[], b: Pt[]): Pt[] {
  let out = oriented(a);
  const clip = oriented(b);
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const [x1, y1] = clip[i];
    const [x2, y2] = clip[(i + 1) % clip.length];
    const side = (p: Pt) => (x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1);
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
  }
  return out;
}

export function intersectionArea(a: Pt[], b: Pt[]): number {
  const poly = intersectConvex(a, b);
  return poly.length < 3 ? 0 : area(poly);
}

/** Le point est-il dans le polygone convexe (bord compris) ? */
export function insideConvex(poly: Pt[], p: Pt): boolean {
  const o = oriented(poly);
  for (let i = 0; i < o.length; i++) {
    const [x1, y1] = o[i];
    const [x2, y2] = o[(i + 1) % o.length];
    if ((x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1) < 0) return false;
  }
  return true;
}

export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const median = (v: number[]) => {
  const s = [...v].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
