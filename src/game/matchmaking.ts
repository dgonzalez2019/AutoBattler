import { Rng } from '../sim/rng';
import { generateOpponent } from './ai';
import type { ArmySnapshot } from './army';

/**
 * Where opponents come from. Matchmaking works like Super Auto Pets:
 * at round N you fight an army someone else saved at round N.
 *
 * Today the pool is local (your own past armies + AI-built ones).
 * An online version only needs to implement this interface against a backend.
 */
export interface OpponentSource {
  findOpponent(round: number, seed: number): Promise<ArmySnapshot>;
  submit(snapshot: ArmySnapshot): Promise<void>;
}

const STORAGE_KEY = 'autobattler.ghosts.v1';
const PER_ROUND = 25;
const GHOST_CHANCE = 0.5;

type Pool = Record<string, ArmySnapshot[]>;

function load(): Pool {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Pool;
  } catch {
    return {};
  }
}

function save(pool: Pool) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pool));
  } catch {
    // Storage blocked or full: matchmaking still works with AI armies.
  }
}

export class LocalOpponentSource implements OpponentSource {
  async findOpponent(round: number, seed: number): Promise<ArmySnapshot> {
    const rng = new Rng(seed);
    const ghosts = load()[round] ?? [];
    if (ghosts.length && rng.next() < GHOST_CHANCE) {
      const g = rng.pick(ghosts);
      return { ...g, name: `${g.name} (ghost)` };
    }
    return generateOpponent(round, seed);
  }

  async submit(snapshot: ArmySnapshot): Promise<void> {
    const pool = load();
    const list = (pool[snapshot.round] ??= []);
    list.push(snapshot);
    if (list.length > PER_ROUND) list.splice(0, list.length - PER_ROUND);
    save(pool);
  }
}

export const opponents: OpponentSource = new LocalOpponentSource();
