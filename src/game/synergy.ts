import { getDef } from '../data/creatures';
import { ELEMENTS } from '../data/elements';
import { CLASSES, TRAITS, type TraitId, type TraitLevels } from '../data/traits';

export const ALL_TRAITS: TraitId[] = [...ELEMENTS, ...CLASSES];

export interface TraitState {
  /** Distinct species per trait. */
  counts: Record<TraitId, number>;
  /** Active tier per trait (0 = off). */
  levels: TraitLevels;
}

/** Count synergies for an army. Two squads of the same creature count once. */
export function computeTraits(squads: { defId: string }[]): TraitState {
  const counts = Object.fromEntries(ALL_TRAITS.map((t) => [t, 0])) as Record<TraitId, number>;
  const seen = new Set<string>();
  for (const s of squads) {
    if (seen.has(s.defId)) continue;
    seen.add(s.defId);
    const def = getDef(s.defId);
    counts[def.element]++;
    counts[def.class]++;
  }
  const levels = Object.fromEntries(
    ALL_TRAITS.map((t) => [t, TRAITS[t].thresholds.filter((n) => counts[t] >= n).length]),
  ) as TraitLevels;
  return { counts, levels };
}
