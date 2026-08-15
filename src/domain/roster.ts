/**
 * Liste des joueurs connus ("roster"), indépendante des parties : permet de
 * sélectionner rapidement les habitué·es plutôt que de retaper leur nom à
 * chaque partie.
 */
export interface RosterPlayer {
  id: string;
  name: string;
}

export function normalizePlayerName(name: string): string {
  return name.trim();
}

/** Recherche insensible à la casse/aux espaces, pour éviter les doublons. */
export function findByName(
  roster: RosterPlayer[],
  name: string,
): RosterPlayer | undefined {
  const normalized = normalizePlayerName(name).toLowerCase();
  return roster.find((p) => p.name.toLowerCase() === normalized);
}

export function sortRosterByName(roster: RosterPlayer[]): RosterPlayer[] {
  return [...roster].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
