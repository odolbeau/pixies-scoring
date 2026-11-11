/** Lecture du fichier de points SIFT de référence (voir ml/scripts/export_refs.py pour le format). */
export interface RefCard {
  id: string;
  width: number;
  height: number;
  /** x, y de chaque point, à plat. */
  points: Float32Array;
  /** 128 valeurs par point, à plat. */
  descriptors: Uint8Array;
  /** Miniature en niveaux de gris, pour départager les cartes à illustration identique. */
  thumb?: { width: number; height: number; data: Uint8Array };
}

export function parseRefs(buf: ArrayBuffer): RefCard[] {
  const view = new DataView(buf);
  let o = 0;
  const count = view.getUint32(o, true);
  o += 4;
  const refs: RefCard[] = [];
  for (let k = 0; k < count; k++) {
    const idLen = view.getUint8(o++);
    let id = "";
    for (let i = 0; i < idLen; i++) id += String.fromCharCode(view.getUint8(o++));
    const width = view.getUint16(o, true);
    const height = view.getUint16(o + 2, true);
    const n = view.getUint16(o + 4, true);
    o += 6;
    // Copie : les tableaux typés exigent un décalage aligné.
    const points = new Float32Array(buf.slice(o, o + n * 8));
    o += n * 8;
    const descriptors = new Uint8Array(buf.slice(o, o + n * 128));
    o += n * 128;
    const tw = view.getUint16(o, true);
    const th = view.getUint16(o + 2, true);
    o += 4;
    let thumb: RefCard["thumb"];
    if (tw > 0) {
      thumb = { width: tw, height: th, data: new Uint8Array(buf.slice(o, o + tw * th)) };
      o += tw * th;
    }
    refs.push({ id, width, height, points, descriptors, thumb });
  }
  return refs;
}
