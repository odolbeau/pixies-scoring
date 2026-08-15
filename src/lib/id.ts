/**
 * `crypto.randomUUID()` n'existe que dans un contexte sécurisé (HTTPS ou
 * localhost) — il lève "crypto.randomUUID is not a function" sur un site
 * servi en HTTP simple (ex. pendant qu'un certificat custom domain n'est
 * pas encore provisionné). `crypto.getRandomValues`, lui, est disponible
 * partout : on s'en sert comme repli pour fabriquer un UUID v4.
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    // Dernier recours (environnement sans Web Crypto du tout) : ces id ne
    // servent qu'à distinguer des entités en local, pas à de la sécurité.
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
