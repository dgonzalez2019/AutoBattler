import { COMMANDER_LIST } from '../data/commanders';
import { getDef } from '../data/creatures';
import { Rng } from '../sim/rng';
import type { ArmySnapshot, SquadSpec } from './army';
import { emptyModules, MODULES } from './mothership';
import { MAX_SQUADS, MERGE_HP, rollCreature } from './run';
import { ELEMENTS } from '../data/elements';
import { CLASSES, type TraitId } from '../data/traits';

const PREFIX = ['Admiral', 'Captain', 'Major', 'Ranger', 'Pilot', 'Agent'];
const NAMES = ['Orion', 'Lyra', 'Juno', 'Talon', 'Sable', 'Quill', 'Ember', 'Astra', 'Cobalt', 'Draco', 'Halo', 'Pike'];

export function botName(rng: Rng): string {
  return `${rng.pick(PREFIX)} ${rng.pick(NAMES)}-${1 + rng.int(99)}`;
}

/** An AI army roughly matched to what a player could have built by this round. */
export function generateOpponent(round: number, seed: number): ArmySnapshot {
  const rng = new Rng(seed);
  const size = Math.min(MAX_SQUADS, round + 1);
  // Same odds as the player's shop, rolled a few times to mimic rerolling.
  const pool = [...Array(18)].map(() => rollCreature(rng, round));
  // Like a real player, the AI commits to a synergy: an element or a class to stack.
  const focus = rng.pick<TraitId>([...ELEMENTS, ...CLASSES]);
  const fits = pool.filter((c) => c.element === focus || c.class === focus);
  const squads: SquadSpec[] = [];
  for (let i = 0; i < size; i++) {
    const def = fits.length && rng.next() < 0.65 ? rng.pick(fits) : rng.pick(pool);
    const level = round >= 7 && rng.next() < 0.35 ? 3 : round >= 4 && rng.next() < 0.4 ? 2 : 1;
    const merges = level === 3 ? 5 : level === 2 ? 2 : 0;
    const extra = rng.int(Math.max(1, Math.floor(round / 2)));
    const extraAtk = rng.int(extra + 1);
    squads.push({
      defId: def.id,
      atk: def.atk + merges + extraAtk,
      hp: def.hp + merges * MERGE_HP + (extra - extraAtk) * 2,
      level,
    });
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
  // Melee tanks in front, ranged squads in back.
  squads.sort((a, b) => Number(!!getDef(a.defId).ranged) - Number(!!getDef(b.defId).ranged) || b.hp - a.hp);
  return { name: botName(rng), round, wins: rng.int(round), lives: 5, squads, modules, commander: rng.pick(COMMANDER_LIST).id };
}
