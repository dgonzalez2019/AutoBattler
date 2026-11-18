import { COMMANDERS } from '../data/commanders';
import { CREATURES } from '../data/creatures';
import type { ArmySnapshot, SquadSpec } from './army';
import { emptyModules, MODULES, type ModuleLevels } from './mothership';
import { MAX_SQUADS } from './run';

/** Generous caps: anything above these can't be reached by normal play. */
const MAX_ATK = 2000;
const MAX_HP = 8000;

const int = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;

/**
 * Turn untrusted JSON (from the network or storage) into a safe ArmySnapshot,
 * or null if it can't be played. Anything another client sends goes through here.
 */
export function parseArmy(raw: unknown): ArmySnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const army = (r.army ?? r) as Record<string, unknown>;
  const squadsRaw = army.squads;
  if (!Array.isArray(squadsRaw) || squadsRaw.length < 1 || squadsRaw.length > MAX_SQUADS) return null;

  const squads: SquadSpec[] = [];
  for (const s of squadsRaw) {
    if (!s || typeof s !== 'object') return null;
    const q = s as Record<string, unknown>;
    const def = typeof q.defId === 'string' ? CREATURES[q.defId] : undefined;
    if (!def || def.token) return null;
    const atk = int(q.atk, 0, MAX_ATK);
    const hp = int(q.hp, 1, MAX_HP);
    const level = int(q.level, 1, 3);
    if (atk === null || hp === null || level === null) return null;
    squads.push({ defId: def.id, atk, hp, level });
  }

  const modules: ModuleLevels = emptyModules();
  const mods = (army.modules ?? {}) as Record<string, unknown>;
  for (const m of MODULES) modules[m.id] = int(mods[m.id], 0, m.maxLevel) ?? 0;

  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 24) : 'Unknown Commander';
  return {
    name,
    round: int(r.round, 1, 999) ?? 1,
    wins: int(r.wins, 0, 999) ?? 0,
    lives: int(r.lives, 0, 7) ?? 0,
    squads,
    modules,
    commander: typeof army.commander === 'string' && COMMANDERS[army.commander] ? army.commander : undefined,
  };
}
