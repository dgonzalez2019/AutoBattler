import { getDef } from '../data/creatures';
import { ELEMENTS } from '../data/elements';
import { CLASSES, type TraitId } from '../data/traits';
import { Rng } from '../sim/rng';
import { MODULES } from './mothership';
import { REROLL_COST, type Run } from './run';

/**
 * A shop-playing bot. Used to build AI opponents (so they get exactly the
 * gold, shop and rules a player gets) and by the automated playtest.
 *
 * skill 0..1: how often it makes the good choice instead of a random one.
 */
export interface BotMemory {
  focus?: TraitId;
}

const fits = (defId: string, focus?: TraitId) => {
  const d = getDef(defId);
  return !!focus && (d.element === focus || d.class === focus);
};

function value(run: Run, defId: string, focus?: TraitId): number {
  const d = getDef(defId);
  let v = d.rarity * 2;
  if (fits(defId, focus)) v += 4;
  if (run.team.some((u) => u && u.defId === defId && u.level < 3)) v += 5;
  return v;
}

export function botTurn(run: Run, rng: Rng, mem: BotMemory, skill = 1) {
  const smart = () => rng.next() < skill;

  if (!mem.focus) {
    const counts = new Map<TraitId, number>();
    for (const s of run.shop) {
      if (!s) continue;
      const d = getDef(s.unit.defId);
      for (const t of [d.element, d.class] as TraitId[]) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    mem.focus = top && smart() ? top : rng.pick<TraitId>([...ELEMENTS, ...CLASSES]);
  }

  // Mid-game Mothership upgrade when gold is spare.
  if (run.round >= 4 && run.gold >= 9 && smart()) {
    const m = rng.pick(MODULES.filter((x) => x.id !== 'reactor'));
    run.buyModule(m.id);
  }

  // Economy: from round 3 a good player banks gold for interest, and only dips
  // into the reserve for strong buys (merges, on-plan creatures).
  const reserve = run.round >= 3 && smart() ? 10 : 0;
  const STRONG = 9;

  for (let guard = 0; guard < 30; guard++) {
    const affordable = run.shop
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => s && run.gold >= run.cost(i))
      .filter(({ s, i }) => run.gold - run.cost(i) >= reserve || value(run, s!.unit.defId, mem.focus) >= STRONG);
    const ranked = affordable.map((o) => ({ ...o, v: value(run, o.s!.unit.defId, mem.focus) })).sort((a, b) => b.v - a.v);
    const best = smart() ? ranked[0] : affordable.length ? { ...rng.pick(affordable), v: 0 } : undefined;
    if (best) {
      const twin = run.team.findIndex((u) => u && u.defId === best.s!.unit.defId && u.level < 3);
      let slot = twin >= 0 ? twin : run.team.findIndex((u) => !u);
      if (slot < 0 && smart()) {
        // Army full: replace the weakest squad if this one is clearly better.
        const score = (u: NonNullable<Run['team'][number]>) => value(run, u.defId, mem.focus) + u.level * 3;
        const weakest = run.team
          .map((u, k) => ({ u: u!, k }))
          .sort((a, b) => score(a.u) - score(b.u))[0];
        if (best.v > score(weakest.u) + 2) {
          run.sell(weakest.k);
          slot = weakest.k;
        }
      }
      if (slot >= 0 && run.buy(best.i, slot)) continue;
    }
    if ((run.gold - REROLL_COST >= reserve + 3 && smart()) || run.rerollCost === 0) {
      run.reroll();
      continue;
    }
    break;
  }

  // Tanky melee in front, ranged at the back.
  if (smart()) {
    const units = run.team.filter(Boolean) as NonNullable<Run['team'][number]>[];
    units.sort((a, b) => Number(!!getDef(a.defId).ranged) - Number(!!getDef(b.defId).ranged) || b.hp - a.hp);
    run.team = [...units, ...Array(5 - units.length).fill(null)];
  }
}
