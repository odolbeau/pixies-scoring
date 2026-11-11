/**
 * Reconstruit la grille 3×3 d'un joueur à partir des cartes identifiées sur la photo.
 *
 * Entrée : pour chaque carte reconnue, son quadrilatère dans la photo, le nombre de points concordants
 * (« inliers ») et leur position. Une carte qui en recouvre une autre montre ses points dans la zone
 * d'intersection, l'autre non : c'est ce qui donne les cartes validées (« recouvre une autre carte »).
 * Les cartes recouvertes complètement (aucun bord visible) ne sont pas détectables ici : la relecture
 * humaine les corrige.
 */
import { cardById, GRID_SIZE, type GridGiant, type GridSlot, type PlayerGrid } from "../domain/gridScoring";
import { area, dist, insideConvex, intersectConvex, intersectionArea, median, type Pt } from "./geometry";

export interface Detection {
  /** Identifiant de carte, ou "back" pour un dos de carte. */
  id: string;
  inliers: number;
  quad: Pt[];
  /** Points de la photo concordant avec la carte. */
  pts: Pt[];
}

export interface RecognizedGrid {
  grid: PlayerGrid;
  /** Cartes reconnues mais non placées (hors grille, doublons…). */
  unplaced: string[];
}

const MIN_INLIERS = 8;

interface Det extends Detection {
  giant: boolean;
  back: boolean;
  center: Pt;
  w: number;
  h: number;
  up: Pt;
  area: number;
}

function prepare(raw: Detection[], size: [number, number]): Det[] {
  const box: Pt[] = [[0, 0], [size[0], 0], [size[0], size[1]], [0, size[1]]];
  const out: Det[] = [];
  for (const r of raw) {
    if (r.inliers < MIN_INLIERS || r.quad.length !== 4) continue;
    const back = r.id === "back";
    const def = back ? undefined : cardById(r.id);
    if (!back && !def) continue;
    const a = area(r.quad);
    if (intersectionArea(r.quad, box) < 0.6 * a) continue;
    const q = r.quad;
    out.push({
      ...r,
      giant: def?.set === "littleGiants",
      back,
      center: [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4],
      w: (dist(q[1], q[0]) + dist(q[2], q[3])) / 2,
      h: (dist(q[3], q[0]) + dist(q[2], q[1])) / 2,
      up: [q[0][0] - q[3][0] + q[1][0] - q[2][0], q[0][1] - q[3][1] + q[1][1] - q[2][1]],
      area: a,
    });
  }
  return out;
}

/** coveredBy[i] : cartes posées par-dessus la carte i. */
function stacking(dets: Det[]): Set<number>[] {
  const coveredBy = dets.map(() => new Set<number>());
  for (let i = 0; i < dets.length; i++) {
    for (let j = i + 1; j < dets.length; j++) {
      const a = dets[i];
      const b = dets[j];
      if (a.giant || b.giant) continue;
      if (intersectionArea(a.quad, b.quad) < 0.25 * Math.min(a.area, b.area)) continue;
      const poly = intersectConvex(a.quad, b.quad);
      const ca = a.pts.filter((p) => insideConvex(poly, p)).length;
      const cb = b.pts.filter((p) => insideConvex(poly, p)).length;
      const aOnTop = ca > cb || (ca === cb && a.inliers >= b.inliers);
      if (aOnTop) coveredBy[j].add(i);
      else coveredBy[i].add(j);
    }
  }
  return coveredBy;
}

/** Regroupe en au plus `kmax` lignes (ou colonnes) en coupant aux plus grands écarts relatifs à la taille des cartes. */
function cluster(vals: number[], sizes: number[], ratio: number, kmax = GRID_SIZE): number[][] {
  const order = vals.map((_, i) => i).sort((x, y) => vals[x] - vals[y]);
  const gaps: [number, number][] = [];
  for (let j = 0; j < order.length - 1; j++) {
    gaps.push([(vals[order[j + 1]] - vals[order[j]]) / ((sizes[order[j]] + sizes[order[j + 1]]) / 2), j]);
  }
  gaps.sort((x, y) => y[0] - x[0] || y[1] - x[1]);
  const cuts = gaps
    .slice(0, kmax - 1)
    .filter(([g]) => g > ratio)
    .map(([, j]) => j)
    .sort((x, y) => x - y);
  const groups: number[][] = [];
  let start = 0;
  for (const j of cuts) {
    groups.push(order.slice(start, j + 1));
    start = j + 1;
  }
  groups.push(order.slice(start));
  return groups;
}

const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;

export function gridFromDetections(raw: Detection[], size: [number, number]): RecognizedGrid | null {
  const dets = prepare(raw, size);
  const coveredBy = stacking(dets);
  const tops = dets.map((_, i) => i).filter((i) => coveredBy[i].size === 0);
  const std = tops.filter((i) => !dets[i].giant && !dets[i].back);
  if (std.length === 0) return null;

  let up: Pt = [0, 0];
  for (const i of std) up = [up[0] + dets[i].up[0], up[1] + dets[i].up[1]];
  const norm = Math.hypot(up[0], up[1]) || 1;
  up = [up[0] / norm, up[1] / norm];
  const right: Pt = [-up[1], up[0]];
  const down: Pt = [-up[0], -up[1]];
  const W = median(std.map((i) => dets[i].w));
  const H = median(std.map((i) => dets[i].h));
  const uv = new Map<number, Pt>(
    tops.map((i) => [i, [dets[i].center[0] * right[0] + dets[i].center[1] * right[1], dets[i].center[0] * down[0] + dets[i].center[1] * down[1]] as Pt]),
  );

  // Composantes connexes des cartes du dessus (proximité) : on garde la plus riche en cartes standard.
  const near = (i: number, j: number) => {
    const a = uv.get(i) as Pt;
    const b = uv.get(j) as Pt;
    return Math.abs(a[0] - b[0]) < 1.7 * W && Math.abs(a[1] - b[1]) < 1.7 * H;
  };
  const seen = new Set<number>();
  const comps: number[][] = [];
  for (const i of tops) {
    if (seen.has(i)) continue;
    const stack = [i];
    const comp: number[] = [];
    seen.add(i);
    while (stack.length) {
      const k = stack.pop() as number;
      comp.push(k);
      for (const j of tops) {
        if (!seen.has(j) && near(k, j)) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    comps.push(comp);
  }
  const score = (c: number[]) => c.filter((k) => !dets[k].giant && !dets[k].back).length;
  const best = comps.reduce((a, b) => (score(b) > score(a) || (score(b) === score(a) && b.length > a.length) ? b : a));

  const gridCards = best.filter((i) => !dets[i].giant);
  const giants = best.filter((i) => dets[i].giant);
  const rows = cluster(gridCards.map((i) => (uv.get(i) as Pt)[1]), gridCards.map((i) => dets[i].h), 0.4);
  const cols = cluster(gridCards.map((i) => (uv.get(i) as Pt)[0]), gridCards.map((i) => dets[i].w), 0.4);
  const rowPos = rows.map((g) => mean(g.map((k) => (uv.get(gridCards[k]) as Pt)[1])));
  const colPos = cols.map((g) => mean(g.map((k) => (uv.get(gridCards[k]) as Pt)[0])));

  const rowOf = new Map<number, number>();
  const colOf = new Map<number, number>();
  rows.forEach((g, ri) => g.forEach((k) => rowOf.set(gridCards[k], ri)));
  cols.forEach((g, ci) => g.forEach((k) => colOf.set(gridCards[k], ci)));

  const covers = (i: number) => coveredBy.some((set, j) => set.has(i) && !dets[j].giant);
  const slots: GridSlot[] = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => ({ kind: "empty" as const }));
  const placed = new Set<number>();
  for (const i of gridCards) {
    const r = rowOf.get(i) as number;
    const c = colOf.get(i) as number;
    if (r >= GRID_SIZE || c >= GRID_SIZE) continue;
    const idx = r * GRID_SIZE + c;
    if (slots[idx].kind !== "empty") continue;
    slots[idx] = dets[i].back ? { kind: "facedown" } : { kind: "card", cardId: dets[i].id, covers: covers(i) };
    placed.add(i);
  }

  const outGiants: GridGiant[] = [];
  const meanRow = mean(rowPos);
  const meanCol = mean(colPos);
  for (const i of giants) {
    const def = cardById(dets[i].id);
    if (def?.set !== "littleGiants") continue;
    const [u, v] = uv.get(i) as Pt;
    const nearest = (pos: number[], x: number) => pos.reduce((bi, p, k) => (Math.abs(p - x) < Math.abs(pos[bi] - x) ? k : bi), 0);
    const index = def.direction === "column" ? nearest(colPos, u) : nearest(rowPos, v);
    // Un Géant n'est valable qu'au bord de la grille (haut pour une colonne, gauche pour une ligne).
    const onEdge = def.direction === "column" ? v < meanRow : u < meanCol;
    if (!onEdge || index >= GRID_SIZE || outGiants.some((g) => cardById(g.cardId)?.set === "littleGiants" && (cardById(g.cardId) as { direction: string }).direction === def.direction && g.index === index)) continue;
    outGiants.push({ cardId: def.id, index });
    placed.add(i);
  }

  const unplaced = dets.map((d, i) => (placed.has(i) || d.back ? null : d.id)).filter((x): x is string => x !== null);
  return { grid: { slots, giants: outGiants }, unplaced };
}
