/// <reference lib="webworker" />
/**
 * Worker de reconnaissance : charge OpenCV.js (avec SIFT) et les points de référence à la première
 * utilisation, puis analyse les photos sans bloquer l'interface.
 */
import { recognize, type CV } from "./recognize";
import { parseRefs, type RefCard } from "./refs";

export interface WorkerRequest {
  image: ImageData;
  /** Dossier public contenant opencv.js, opencv_js.wasm et refs.bin (avec / final). */
  base: string;
}

export type WorkerResponse =
  | { kind: "status"; message: string }
  | { kind: "done"; detections: ReturnType<typeof recognize>["detections"]; size: [number, number]; ms: number }
  | { kind: "error"; message: string };

let cvPromise: Promise<CV> | undefined;
let refsPromise: Promise<RefCard[]> | undefined;

function loadOpenCv(base: string): Promise<CV> {
  cvPromise ??= (async () => {
    const response = await fetch(`${base}opencv.js`);
    if (!response.ok) throw new Error("Moteur de reconnaissance introuvable.");
    const source = await response.text();
    // Le script lit l'objet global `Module` : on y indique où trouver le fichier WebAssembly.
    (self as unknown as { Module: unknown }).Module = { locateFile: (file: string) => `${base}${file}` };
    (0, eval)(source);
    // `cv` devient un objet « thenable » qui se résout quand le module WebAssembly est prêt.
    return await (self as unknown as { cv: Promise<CV> }).cv;
  })();
  return cvPromise;
}

function loadRefs(base: string): Promise<RefCard[]> {
  refsPromise ??= fetch(`${base}refs.bin`).then(async (r) => parseRefs(await r.arrayBuffer()));
  return refsPromise;
}

const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const { image, base } = event.data;
    post({ kind: "status", message: "Chargement du moteur de reconnaissance…" });
    const [cv, refs] = await Promise.all([loadOpenCv(base), loadRefs(base)]);
    post({ kind: "status", message: "Analyse de la photo…" });
    const t = performance.now();
    const result = recognize(cv, image, refs);
    post({ kind: "done", detections: result.detections, size: result.size, ms: Math.round(performance.now() - t) });
  } catch (e) {
    post({ kind: "error", message: e instanceof Error ? e.message : String(e) });
  }
};
