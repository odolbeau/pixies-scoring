import { cardById, GRID_SIZE, type PlayerGrid } from "../domain/gridScoring";
import type { ScoringOptions } from "../domain/scoring";
import { gridFromDetections, type RecognizedGrid } from "./gridFromDetections";
import { PHOTO_MAX_SIDE } from "./recognize";
import type { WorkerRequest, WorkerResponse } from "./worker";

/** Ne garde que ce que les options de la partie permettent de poser (dos : Flower Power, Géants : Little Giants). */
export function restrictToOptions(grid: PlayerGrid, options: ScoringOptions): PlayerGrid {
  const allowed = (id: string) => {
    const set = cardById(id)?.set;
    if (set === "flowerPower") return options.flowerPower;
    if (set === "littleGiants") return options.littleGiants;
    return true;
  };
  return {
    slots: grid.slots.map((s) => {
      if (s.kind === "facedown") return options.flowerPower ? s : { kind: "empty" };
      if (s.kind === "card" && !allowed(s.cardId)) return { kind: "empty" };
      return s;
    }),
    giants: options.littleGiants ? grid.giants.filter((g) => allowed(g.cardId)) : [],
  };
}

async function readPhoto(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return ctx.getImageData(0, 0, w, h);
}

export interface PhotoAnalysis extends RecognizedGrid {
  ms: number;
  /** Nombre d'emplacements remplis par la reconnaissance. */
  filled: number;
}

/** Analyse la photo d'une grille dans un worker et renvoie la grille reconnue (à relire par le joueur). */
export async function analyzeGridPhoto(
  file: File,
  options: ScoringOptions,
  onStatus: (message: string) => void,
): Promise<PhotoAnalysis> {
  const image = await readPhoto(file);
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  try {
    const response = await new Promise<Extract<WorkerResponse, { kind: "done" }>>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.kind === "status") onStatus(e.data.message);
        else if (e.data.kind === "error") reject(new Error(e.data.message));
        else resolve(e.data);
      };
      worker.onerror = (e) => reject(new Error(e.message || "Erreur du moteur de reconnaissance"));
      const request: WorkerRequest = { image, base: import.meta.env.BASE_URL + "vision/" };
      worker.postMessage(request, [image.data.buffer]);
    });
    const recognized = gridFromDetections(response.detections, response.size);
    if (!recognized) throw new Error("Aucune carte reconnue sur cette photo.");
    const grid = restrictToOptions(recognized.grid, options);
    const filled = grid.slots.filter((s) => s.kind !== "empty").length + grid.giants.length;
    return { grid, unplaced: recognized.unplaced, ms: response.ms, filled };
  } finally {
    worker.terminate();
  }
}

export { GRID_SIZE };
