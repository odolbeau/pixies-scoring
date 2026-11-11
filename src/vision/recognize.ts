/**
 * Identification des cartes d'une photo : points SIFT appariés avec ceux des cartes de référence, puis
 * homographie robuste (RANSAC) qui donne la position de chaque carte dans la photo. Port de
 * ml/scripts/sift_match.py, exécuté par OpenCV.js (compilé avec SIFT, voir ml/opencv-js/).
 */
import { area, dist, insideConvex, intersectionArea, median, type Pt } from "./geometry";
import type { Detection } from "./gridFromDetections";
import type { RefCard } from "./refs";
import { pickVariant } from "./variants";

// OpenCV.js n'a pas de types fiables : on le manipule comme un objet dynamique.
// biome-ignore lint/suspicious/noExplicitAny: API OpenCV.js non typée
export type CV = any;

const RATIO = 0.82;
const MIN_INLIERS = 12;
const MIN_INLIERS_BACK = 8;
const MAX_INSTANCES = 3;
export const PHOTO_MAX_SIDE = 1600;
const PHOTO_FEATURES = 9000;

interface Candidate {
  id: string;
  inliers: number;
  quad: Pt[];
  pts: Pt[];
  /** Homographie carte de référence → photo (3×3, ligne par ligne). */
  H: number[];
  /** Cartes de même illustration reconnues au même endroit. */
  alts?: Candidate[];
}

/** Dans le quadrilatère réduit de 8 % autour de son centre. */
function inShrunk(quad: Pt[], p: Pt, shrink = 0.92): boolean {
  const c: Pt = [(quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4, (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4];
  const q = quad.map((v) => [(v[0] - c[0]) * shrink + c[0], (v[1] - c[1]) * shrink + c[1]] as Pt);
  return insideConvex(q, p);
}

function iou(a: Pt[], b: Pt[]): number {
  const i = intersectionArea(a, b);
  return i <= 0 ? 0 : i / (area(a) + area(b) - i + 1e-6);
}

function isConvex(q: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross !== 0) {
      if (sign !== 0 && Math.sign(cross) !== sign) return false;
      sign = Math.sign(cross);
    }
  }
  return true;
}

/** Plusieurs exemplaires d'une même carte : RANSAC répété en retirant les points déjà expliqués. */
function instances(cv: CV, ref: RefCard, matches: [number, number][], photoPts: Float32Array, minInliers: number): Candidate[] {
  const out: Candidate[] = [];
  let alive = matches;
  for (let k = 0; k < MAX_INSTANCES; k++) {
    if (alive.length < minInliers) break;
    const src = cv.matFromArray(alive.length, 1, cv.CV_32FC2, alive.flatMap(([q]) => [ref.points[2 * q], ref.points[2 * q + 1]]));
    const dst = cv.matFromArray(alive.length, 1, cv.CV_32FC2, alive.flatMap(([, t]) => [photoPts[2 * t], photoPts[2 * t + 1]]));
    const mask = new cv.Mat();
    const H = cv.findHomography(src, dst, cv.RANSAC, 6.0, mask);
    src.delete();
    dst.delete();
    if (H.empty()) {
      H.delete();
      mask.delete();
      break;
    }
    const inl = Array.from(mask.data as Uint8Array, (v) => v !== 0);
    const count = inl.filter(Boolean).length;
    if (count < minInliers) {
      H.delete();
      mask.delete();
      break;
    }
    const corners = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, ref.width, 0, ref.width, ref.height, 0, ref.height]);
    const proj = new cv.Mat();
    cv.perspectiveTransform(corners, proj, H);
    const d = proj.data32F as Float32Array;
    const hData = Array.from(H.data64F as Float64Array);
    const quad: Pt[] = [0, 1, 2, 3].map((i) => [d[2 * i], d[2 * i + 1]] as Pt);
    corners.delete();
    proj.delete();
    H.delete();
    mask.delete();
    if (quad.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) && isConvex(quad)) {
      const pts = alive.filter((_, i) => inl[i]).map(([, t]) => [photoPts[2 * t], photoPts[2 * t + 1]] as Pt);
      out.push({ id: ref.id, inliers: count, quad, pts, H: hData });
    }
    alive = alive.filter((_, i) => !inl[i]);
  }
  return out;
}

/** Garde les cartes plausibles (taille, forme) et écarte les doublons et les fausses détections. */
function selectCandidates(cands: Candidate[]): Candidate[] {
  cands.sort((a, b) => b.inliers - a.inliers);
  const sideH = (c: Candidate) => dist(c.quad[3], c.quad[0]);
  const strong = cands.filter((c) => c.inliers >= 60);
  const H0 = median((strong.length ? strong : cands.slice(0, 1)).map(sideH));
  const keep: Candidate[] = [];
  for (const c of cands) {
    const q = c.quad;
    const hq = (dist(q[3], q[0]) + dist(q[2], q[1])) / 2;
    if (!(0.55 * H0 < hq && hq < 1.8 * H0)) continue;
    const wq = (dist(q[1], q[0]) + dist(q[2], q[3])) / 2;
    if (!(0.4 < wq / hq && wq / hq < 2.0)) continue;
    const twin = keep.find((k) => iou(c.quad, k.quad) > 0.85);
    if (twin) {
      if (c.id !== "back" && twin.id !== "back" && c.inliers >= 0.2 * twin.inliers) (twin.alts ??= []).push(c);
      continue;
    }
    // Carte partiellement cachée : ses points ne doivent pas être sous une carte déjà acceptée,
    // sauf si c'est elle qui est dessus.
    let inside = c.pts.map(() => false);
    let dup = false;
    let over = false;
    for (const k of keep) {
      const ic = c.pts.map((p) => inShrunk(k.quad, p));
      inside = inside.map((v, i) => v || ic[i]);
      if (ic.filter(Boolean).length / ic.length > 0.4) {
        const back = k.pts.filter((p) => inShrunk(c.quad, p)).length / k.pts.length;
        if (back > 0.4) dup = true;
        else over = true;
      }
    }
    if (dup) continue;
    const insideShare = inside.filter(Boolean).length / inside.length;
    if (over && c.inliers < 25) continue;
    if (insideShare > 0.4 && !over) continue;
    if (c.inliers < 25 && !(c.id === "back" || insideShare === 0)) continue;
    keep.push(c);
  }
  return keep;
}

export interface RecognizeResult {
  detections: Detection[];
  size: [number, number];
}

export function recognize(cv: CV, image: ImageData, refs: RefCard[]): RecognizeResult {
  const rgba = cv.matFromImageData(image);
  const gray = new cv.Mat();
  cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
  rgba.delete();

  const sift = new cv.SIFT(PHOTO_FEATURES, 3, 0.015, 10, 1.6);
  const keypoints = new cv.KeyPointVector();
  const descriptors = new cv.Mat();
  sift.detectAndCompute(gray, new cv.Mat(), keypoints, descriptors);
  sift.delete();

  const n = keypoints.size();
  const photoPts = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) {
    const p = keypoints.get(i).pt;
    photoPts[2 * i] = p.x;
    photoPts[2 * i + 1] = p.y;
  }
  keypoints.delete();

  const matcher = new cv.FlannBasedMatcher();
  const train = new cv.MatVector();
  const noMasks = new cv.MatVector();
  train.push_back(descriptors);
  matcher.add(train);
  matcher.train();

  const cands: Candidate[] = [];
  for (const ref of refs) {
    const minInliers = ref.id === "back" ? MIN_INLIERS_BACK : MIN_INLIERS;
    const count = ref.points.length / 2;
    const query = cv.matFromArray(count, 128, cv.CV_32F, Array.from(ref.descriptors));
    const knn = new cv.DMatchVectorVector();
    matcher.knnMatch1(query, knn, 2, noMasks, false);
    const good: [number, number][] = [];
    for (let i = 0; i < knn.size(); i++) {
      const pair = knn.get(i);
      if (pair.size() === 2 && pair.get(0).distance < RATIO * pair.get(1).distance) {
        good.push([pair.get(0).queryIdx, pair.get(0).trainIdx]);
      }
      pair.delete();
    }
    knn.delete();
    query.delete();
    if (good.length < minInliers) continue;
    cands.push(...instances(cv, ref, good, photoPts, minInliers));
  }
  matcher.delete();
  train.delete();
  noMasks.delete();
  descriptors.delete();

  const size: [number, number] = [image.width, image.height];
  if (cands.length === 0) {
    gray.delete();
    return { detections: [], size };
  }
  const byId = new Map(refs.map((r) => [r.id, r]));
  const kept = selectCandidates(cands).map((c) => (c.alts?.length ? pickVariant(cv, gray, c, c.alts, byId) : c));
  gray.delete();
  return { detections: kept.map(({ id, inliers, quad, pts }) => ({ id, inliers, quad, pts })), size };
}
