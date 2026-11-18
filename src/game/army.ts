import { getDef } from '../data/creatures';

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
  /** Permanent upgrades (Command HQ): +% attack / health for every creature. */
  boost?: { atkPct: number; hpPct: number };
  /** Commander id; their battle passive applies to this army. */
  commander?: string;
}

const LEVEL_SIZE = [1, 1.5, 2];

/** Extra units per Swarm squad at each Swarm synergy tier. */
export const SWARM_EXTRA = [0, 2, 4];

/** How many creatures a squad fields in battle. */
export function squadCount(defId: string, level: number, swarmTier = 0): number {
  const def = getDef(defId);
  const extra = def.class === 'swarm' ? SWARM_EXTRA[swarmTier] : 0;
  return Math.max(1, Math.round(def.squad * LEVEL_SIZE[level - 1]) + extra);
}
