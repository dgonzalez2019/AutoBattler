/**
 * Automated playtest: bots play full runs against the real AI opponents,
 * through the real shop (Run), battle sim (FieldBattle) and opponent
 * generator. Prints win rates per round so we can see if enemy teams scale fairly.
 *
 *   npm run playtest            (RUNS=300 npm run playtest for more games)
 * Skipped in the normal test suite unless PLAYTEST=1 is set.
 */
import { it } from 'vitest';
import { COMMANDER_LIST } from '../src/data/commanders';
import { BASE_POOL, getDef, SHOP_POOL } from '../src/data/creatures';
import { ELEMENTS } from '../src/data/elements';
import { CLASSES, type TraitId } from '../src/data/traits';
import { generateOpponent } from '../src/game/ai';
import { botTurn } from '../src/game/bot';
import { MODULES } from '../src/game/mothership';
import { REROLL_COST, Run, unitCost } from '../src/game/run';
import { FieldBattle, type BattleResult } from '../src/sim/field';
import { Rng } from '../src/sim/rng';

type Bot = (run: Run, rng: Rng, mem: { focus?: TraitId }) => void;

const RUNS = Number(process.env.RUNS ?? 120);

/** Casual: buy anything affordable into the first open slot (or merge onto a twin). */
const casual: Bot = (run, rng) => {
  for (let guard = 0; guard < 20; guard++) {
    const options = run.shop.map((s, i) => ({ s, i })).filter(({ s, i }) => s && run.gold >= run.cost(i));
    if (!options.length) break;
    const { s, i } = rng.pick(options);
    let slot = run.team.findIndex((u) => u && u.defId === s!.unit.defId && u.level < 3);
    if (slot < 0) slot = run.team.findIndex((u) => !u);
    if (slot < 0) break;
    run.buy(i, slot);
  }
};

/** Smart: the same bot the AI opponents use, at full skill. */
const smart: Bot = (run, rng, mem) => botTurn(run, rng, mem, 1);

interface Tally {
  w: number;
  l: number;
  d: number;
}

function playRuns(bot: Bot, pool: string[], label: string, seed0: number) {
  const byRound = new Map<number, Tally>();
  const finals: { wins: number; rounds: number; champion: boolean; endless: number }[] = [];
  let battles = 0;
  for (let r = 0; r < RUNS; r++) {
    const rng = new Rng(seed0 + r * 7919);
    const commander = rng.pick(COMMANDER_LIST).id;
    const run = new Run({ seed: seed0 + r, commander, pool });
    const mem: { focus?: TraitId } = {};
    while (run.round <= 60) {
      if (run.status === 'won' && process.env.ENDLESS) run.continueEndless();
      if (run.status !== 'playing') break;
      bot(run, rng, mem);
      run.endTurn();
      if (!run.team.some(Boolean)) {
        run.finishBattle('lose');
        continue;
      }
      const me = run.snapshot('bot');
      const enemy = generateOpponent(run.round, rng.int(2 ** 31));
      const result: BattleResult = new FieldBattle([me, enemy], rng.int(2 ** 31)).runToEnd();
      battles++;
      const t = byRound.get(run.round) ?? { w: 0, l: 0, d: 0 };
      if (result === 'win') t.w++;
      else if (result === 'lose') t.l++;
      else t.d++;
      byRound.set(run.round, t);
      run.finishBattle(result);
    }
    finals.push({ wins: run.wins, rounds: run.round - 1, champion: run.wins >= 10, endless: run.endlessWins });
  }
  const pct = (t: Tally) => Math.round((100 * (t.w + t.d / 2)) / Math.max(1, t.w + t.l + t.d));
  const rows = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, t]) => t.w + t.l + t.d >= 8)
    .map(([round, t]) => `R${String(round).padStart(2)}: ${String(pct(t)).padStart(3)}%  (n=${t.w + t.l + t.d})`);
  const avgWins = finals.reduce((a, f) => a + f.wins, 0) / finals.length;
  const champs = finals.filter((f) => f.champion).length;
  const avgRounds = finals.reduce((a, f) => a + f.rounds, 0) / finals.length;
  const endlessRuns = finals.filter((f) => f.champion).map((f) => f.endless).sort((a, b) => a - b);
  const endlessLine = endlessRuns.length
    ? `   endless (champions continuing): median ${endlessRuns[Math.floor(endlessRuns.length / 2)]} extra wins, best ${endlessRuns[endlessRuns.length - 1]}, worst ${endlessRuns[0]}; reached round 30: ${finals.filter((f) => f.rounds >= 30).length}, 40: ${finals.filter((f) => f.rounds >= 40).length}, conquered (50): ${finals.filter((f) => f.rounds >= 50).length} of ${endlessRuns.length}`
    : '   endless: no champions';
  return [
    `== ${label}: ${RUNS} runs, ${battles} battles`,
    ...(process.env.ENDLESS ? [endlessLine] : []),
    `   avg wins ${avgWins.toFixed(1)}/10, champions ${Math.round((100 * champs) / RUNS)}%, avg run length ${avgRounds.toFixed(1)} rounds`,
    ...rows.map((r) => '   ' + r),
  ].join('\n');
}

it.skipIf(!process.env.PLAYTEST)('playtest', () => {
  const all = SHOP_POOL.map((c) => c.id);
  const base = BASE_POOL.map((c) => c.id);
  const out = [
    playRuns(casual, base, 'CASUAL bot, new player (base 45)', 1000),
    playRuns(smart, base, 'SMART bot, new player (base 45)', 2000),
    playRuns(smart, all, 'SMART bot, veteran (all 75)', 3000),
  ];
  // Print via an error so the output survives vitest's reporter.
  throw new Error('\n' + out.join('\n\n'));
}, 3_600_000);

void unitCost;
