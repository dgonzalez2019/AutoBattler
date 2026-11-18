import { SHOP_POOL } from '../data/creatures';
import { MAX_TEAM, type UnitSpec } from '../sim/battle';
import { Rng } from '../sim/rng';

/**
 * Build an AI opponent roughly matched to what a player could have by this round.
 * Placeholder until async PvP: later rounds pull real teams from other players.
 */
export function generateOpponent(round: number, seed: number): UnitSpec[] {
  const rng = new Rng(seed);
  const maxTier = Math.min(4, Math.ceil(round / 2));
  const size = Math.min(MAX_TEAM, round + 2);
  const pool = SHOP_POOL.filter((c) => c.tier <= maxTier);
  const team: UnitSpec[] = [];
  for (let i = 0; i < size; i++) {
    const def = rng.pick(pool);
    const level = round >= 7 && rng.next() < 0.4 ? 3 : round >= 4 && rng.next() < 0.4 ? 2 : 1;
    // Merges give +1/+1 each, plus a few random shop buffs per round survived.
    const merges = level === 3 ? 5 : level === 2 ? 2 : 0;
    const extra = rng.int(Math.max(1, round));
    const extraAtk = rng.int(extra + 1);
    team.push({
      defId: def.id,
      atk: def.atk + merges + extraAtk,
      hp: def.hp + merges + (extra - extraAtk),
      level,
    });
  }
  // Tanky creatures in front, glass cannons in back.
  return team.sort((a, b) => b.hp - a.hp);
}
