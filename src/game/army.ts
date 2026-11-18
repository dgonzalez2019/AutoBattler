import { getDef } from '../data/creatures';
import type { ModuleLevels } from './mothership';
import { moduleBonus } from './mothership';

/** One squad as stored on a team: stats are per individual creature. */
export interface SquadSpec {
  defId: string;
  atk: number;
  hp: number;
  level: number;
}

/**
 * A full army snapshot. This is exactly what gets saved for matchmaking:
 * players at the same round fight each other's saved snapshots.
 */
export interface ArmySnapshot {
  name: string;
  round: number;
  wins: number;
  lives: number;
  /** Index 0 is the front squad. */
  squads: SquadSpec[];
  modules: ModuleLevels;
}

const LEVEL_SIZE = [1, 1.5, 2];

/** How many creatures a squad fields in battle. */
export function squadCount(defId: string, level: number, barracksLevel = 0): number {
  const base = getDef(defId).squad;
  const mult = LEVEL_SIZE[level - 1] * (1 + moduleBonus('barracks', barracksLevel) / 100);
  return Math.max(1, Math.round(base * mult));
}
