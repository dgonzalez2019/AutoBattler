import { SHOP_POOL } from '../data/creatures';
import { Rng } from '../sim/rng';
import type { ArmySnapshot, SquadSpec } from './army';
import { emptyModules, MODULES } from './mothership';
import { MAX_SQUADS } from './run';

const PREFIX = ['Admiral', 'Captain', 'Commander', 'Warlord', 'Pilot', 'Overseer'];
const NAMES = ['Zyx', 'Nova', 'Kael', 'Vex', 'Orion', 'Lyra', 'Juno', 'Rook', 'Talon', 'Sable', 'Quill', 'Ember'];

export function botName(rng: Rng): string {
  return `${rng.pick(PREFIX)} ${rng.pick(NAMES)}-${1 + rng.int(99)}`;
}

/** An AI army roughly matched to what a player could have built by this round. */
export function generateOpponent(round: number, seed: number): ArmySnapshot {
  const rng = new Rng(seed);
  const maxTier = Math.min(4, Math.ceil(round / 2));
  const size = Math.min(MAX_SQUADS, round + 1);
  const pool = SHOP_POOL.filter((c) => c.tier <= maxTier);
  const squads: SquadSpec[] = [];
  for (let i = 0; i < size; i++) {
    const def = rng.pick(pool);
    const level = round >= 7 && rng.next() < 0.35 ? 3 : round >= 4 && rng.next() < 0.4 ? 2 : 1;
    const merges = level === 3 ? 5 : level === 2 ? 2 : 0;
    const extra = rng.int(Math.max(1, Math.floor(round / 2)));
    const extraAtk = rng.int(extra + 1);
    squads.push({ defId: def.id, atk: def.atk + merges + extraAtk, hp: def.hp + merges + (extra - extraAtk), level });
  }
  // Mothership: spend a round-based budget on random modules.
  const modules = emptyModules();
  let budget = Math.max(0, (round - 2) * 3);
  for (let tries = 0; tries < 10 && budget > 0; tries++) {
    const m = rng.pick(MODULES);
    const lvl = modules[m.id];
    if (m.id === 'reactor' || lvl >= m.maxLevel || m.costs[lvl] > budget) continue;
    budget -= m.costs[lvl];
    modules[m.id]++;
  }
  // Tanky squads in front, glass cannons and ranged in back.
  squads.sort((a, b) => b.hp - a.hp);
  return { name: botName(rng), round, wins: rng.int(round), lives: 5, squads, modules };
}
