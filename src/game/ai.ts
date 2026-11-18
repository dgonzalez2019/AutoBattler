import { COMMANDER_LIST } from '../data/commanders';
import { Rng } from '../sim/rng';
import type { ArmySnapshot } from './army';
import { botTurn, type BotMemory } from './bot';
import { Run } from './run';

const PREFIX = ['Admiral', 'Captain', 'Major', 'Ranger', 'Pilot', 'Agent'];
const NAMES = ['Orion', 'Lyra', 'Juno', 'Talon', 'Sable', 'Quill', 'Ember', 'Astra', 'Cobalt', 'Draco', 'Halo', 'Pike'];

export function botName(rng: Rng): string {
  return `${rng.pick(PREFIX)} ${rng.pick(NAMES)}-${1 + rng.int(99)}`;
}

/**
 * How well AI commanders play their shop at each round (0..1). Every AI army
 * is built through the real shop with the same gold a player has, so it is
 * always a team a player could have at that round; early on the AI plays
 * loosely (rounds 1-3 are meant to be easier), reaching full skill by round 7.
 */
const EARLY_SKILL = [0.15, 0.3, 0.5];
/**
 * Rounds 1-3: chance an AI opponent is a "thrifty" player who only spends
 * THRIFTY_SPEND of their gold (fewer squads), the rest carrying over.
 */
const EARLY_THRIFT = [0.5, 0.4, 0.3];
const THRIFTY_SPEND = 0.7;
export function aiSkill(round: number): number {
  if (round <= EARLY_SKILL.length) return EARLY_SKILL[round - 1];
  return Math.min(1, 0.3 + round * 0.1);
}

/** First round where enemies start gaining Endless power. Normal runs end before this. */
export const ENDLESS_SCALING_FROM = 14;
const ENDLESS_STEP = 0.08;

/** Stat multiplier for AI armies at a round (1 = none). +8% per round from round 14. */
export function endlessPower(round: number): number {
  return 1 + ENDLESS_STEP * Math.max(0, round - ENDLESS_SCALING_FROM + 1);
}

/**
 * An AI army for this round, built the way a player builds one: same starting
 * gold, same shop and odds, same rules. A bot plays every shop turn from round 1
 * up to `round`, so the army has exactly what a real player could have by then.
 */
export function generateOpponent(round: number, seed: number): ArmySnapshot {
  const rng = new Rng(seed);
  const commander = rng.pick(COMMANDER_LIST).id;
  const run = new Run({ seed: rng.int(2 ** 31), commander });
  const mem: BotMemory = {};
  for (let r = 1; r <= round; r++) {
    // Early rounds are meant to be easier: the AI spends only part of its gold,
    // like a real player who bought fewer squads. Unspent gold carries over.
    const spend = rng.next() < (EARLY_THRIFT[r - 1] ?? 0) ? THRIFTY_SPEND : 1;
    const held = Math.ceil(run.gold * (1 - spend));
    run.gold -= held;
    botTurn(run, rng, mem, aiSkill(r));
    run.gold += held;
    run.endTurn();
    if (r < round) run.finishBattle('draw'); // advance the turn without touching lives
  }
  const snap = run.snapshot(botName(rng));
  // Endless: past the point where armies max out, enemies keep getting stronger.
  const power = endlessPower(round);
  if (power > 1) {
    snap.squads = snap.squads.map((q) => ({ ...q, atk: Math.round(q.atk * power), hp: Math.round(q.hp * power) }));
  }
  // A plausible record for an opponent still in the run at this round.
  snap.wins = rng.int(Math.min(10, round));
  snap.lives = Math.max(1, run.maxLives - rng.int(Math.min(run.maxLives, round)));
  return snap;
}
