import { getDef, scaled, type Effect } from '../data/creatures';
import { typeMultiplier } from '../data/elements';
import { Rng } from './rng';

export const MAX_TEAM = 5;

/** A creature as stored on a team (shop phase). */
export interface UnitSpec {
  defId: string;
  atk: number;
  hp: number;
  level: number;
}

export type Side = 0 | 1;

export interface BattleUnit extends UnitSpec {
  uid: number;
  side: Side;
}

export type BattleEvent =
  | { t: 'ability'; uid: number }
  | { t: 'attack'; a: number; b: number }
  | { t: 'damage'; uid: number; amount: number; hp: number; eff?: 'super' | 'weak' }
  | { t: 'stats'; uid: number; atk: number; hp: number; dAtk: number; dHp: number }
  | { t: 'faint'; uid: number }
  | { t: 'summon'; unit: BattleUnit; index: number }
  | { t: 'end'; result: BattleResult };

export type BattleResult = 'win' | 'lose' | 'draw';

export interface BattleLog {
  /** Units as they stand at the very start, front first. */
  initial: [BattleUnit[], BattleUnit[]];
  events: BattleEvent[];
  result: BattleResult;
}

const MAX_TURNS = 200;

/**
 * Run a full battle. Side 0 is the player. Index 0 of each team is the front unit.
 * Pure function of (teams, seed): same input always gives the same log.
 */
export function simulateBattle(player: UnitSpec[], enemy: UnitSpec[], seed: number): BattleLog {
  const rng = new Rng(seed);
  let nextUid = 1;
  const make = (u: UnitSpec, side: Side): BattleUnit => ({ ...u, uid: nextUid++, side });
  const teams: [BattleUnit[], BattleUnit[]] = [player.map((u) => make(u, 0)), enemy.map((u) => make(u, 1))];
  const initial: [BattleUnit[], BattleUnit[]] = [teams[0].map((u) => ({ ...u })), teams[1].map((u) => ({ ...u }))];
  const events: BattleEvent[] = [];
  const emit = (e: BattleEvent) => events.push(e);

  const alive = (side: Side) => teams[side].filter((u) => u.hp > 0);
  const other = (side: Side): Side => (side === 0 ? 1 : 0);

  function damage(target: BattleUnit, amount: number, eff?: 'super' | 'weak') {
    if (target.hp <= 0 || amount <= 0) return;
    target.hp -= amount;
    emit({ t: 'damage', uid: target.uid, amount, hp: target.hp, eff });
    if (target.hp > 0) trigger(target, 'hurt');
  }

  function buff(target: BattleUnit, atk: number, hp: number) {
    if (target.hp <= 0) return;
    const before = { atk: target.atk, hp: target.hp };
    target.atk = Math.max(0, target.atk + atk);
    target.hp += hp;
    emit({ t: 'stats', uid: target.uid, atk: target.atk, hp: target.hp, dAtk: target.atk - before.atk, dHp: target.hp - before.hp });
  }

  function apply(src: BattleUnit, effect: Effect, faintIndex?: number) {
    const lv = src.level;
    const enemies = alive(other(src.side));
    const allies = alive(src.side).filter((u) => u !== src);
    switch (effect.kind) {
      case 'damageRandomEnemy':
        if (enemies.length) damage(rng.pick(enemies), scaled(effect.amount, lv));
        break;
      case 'damageLowestEnemy': {
        if (!enemies.length) break;
        const low = enemies.reduce((m, u) => (u.hp < m.hp ? u : m));
        damage(low, scaled(effect.amount, lv));
        break;
      }
      case 'damageAllEnemies':
        for (const e of enemies) damage(e, scaled(effect.amount, lv));
        break;
      case 'damageFrontEnemy':
        if (enemies[0]) damage(enemies[0], scaled(effect.amount, lv));
        break;
      case 'damageSecondEnemy':
        if (enemies[1]) damage(enemies[1], scaled(effect.amount, lv));
        break;
      case 'debuffFrontEnemyAtk':
        if (enemies[0]) buff(enemies[0], -scaled(effect.amount, lv), 0);
        break;
      case 'buffSelf':
        buff(src, scaled(effect.atk, lv), scaled(effect.hp, lv));
        break;
      case 'buffRandomAlly':
        if (allies.length) buff(rng.pick(allies), scaled(effect.atk, lv), scaled(effect.hp, lv));
        break;
      case 'buffAllAllies':
        for (const a of allies) buff(a, scaled(effect.atk, lv), scaled(effect.hp, lv));
        break;
      case 'summon': {
        const team = teams[src.side];
        if (team.filter((u) => u.hp > 0).length >= MAX_TEAM) break;
        const unit = make(
          { defId: effect.token, atk: scaled(effect.atk, lv), hp: scaled(effect.hp, lv), level: 1 },
          src.side,
        );
        const index = Math.min(faintIndex ?? team.length, team.length);
        team.splice(index, 0, unit);
        emit({ t: 'summon', unit: { ...unit }, index });
        break;
      }
    }
  }

  function trigger(unit: BattleUnit, kind: 'startOfBattle' | 'beforeAttack' | 'hurt' | 'faint', faintIndex?: number) {
    const ab = getDef(unit.defId).ability;
    if (!ab || ab.trigger !== kind) return;
    emit({ t: 'ability', uid: unit.uid });
    apply(unit, ab.effect, faintIndex);
  }

  /** Remove fainted units (front first) and fire their faint abilities, until stable. */
  function processFaints() {
    for (;;) {
      let found = false;
      for (const side of [0, 1] as Side[]) {
        const team = teams[side];
        const idx = team.findIndex((u) => u.hp <= 0);
        if (idx === -1) continue;
        found = true;
        const [dead] = team.splice(idx, 1);
        emit({ t: 'faint', uid: dead.uid });
        // Faint abilities still fire after removal; summons go into the vacated slot.
        const ab = getDef(dead.defId).ability;
        if (ab?.trigger === 'faint') {
          emit({ t: 'ability', uid: dead.uid });
          apply(dead, ab.effect, idx);
        }
      }
      if (!found) return;
    }
  }

  // Start of battle: highest attack goes first, player wins ties.
  const starters = [...teams[0], ...teams[1]].sort((a, b) => b.atk - a.atk || a.side - b.side);
  for (const u of starters) if (u.hp > 0) trigger(u, 'startOfBattle');
  processFaints();

  let turns = 0;
  while (teams[0].length && teams[1].length && turns++ < MAX_TURNS) {
    const a = teams[0][0];
    const b = teams[1][0];
    trigger(a, 'beforeAttack');
    if (b.hp > 0) trigger(b, 'beforeAttack');
    processFaints();
    if (teams[0][0] !== a || teams[1][0] !== b) continue;

    emit({ t: 'attack', a: a.uid, b: b.uid });
    const multA = typeMultiplier(getDef(a.defId).element, getDef(b.defId).element);
    const multB = typeMultiplier(getDef(b.defId).element, getDef(a.defId).element);
    const dmgToB = a.atk > 0 ? Math.max(1, Math.round(a.atk * multA)) : 0;
    const dmgToA = b.atk > 0 ? Math.max(1, Math.round(b.atk * multB)) : 0;
    // Simultaneous hits: apply both before either hurt trigger can change the outcome.
    const effOf = (m: number) => (m > 1 ? 'super' : m < 1 ? 'weak' : undefined);
    a.hp -= dmgToA;
    b.hp -= dmgToB;
    if (dmgToB) emit({ t: 'damage', uid: b.uid, amount: dmgToB, hp: b.hp, eff: effOf(multA) });
    if (dmgToA) emit({ t: 'damage', uid: a.uid, amount: dmgToA, hp: a.hp, eff: effOf(multB) });
    if (dmgToA && a.hp > 0) trigger(a, 'hurt');
    if (dmgToB && b.hp > 0) trigger(b, 'hurt');
    processFaints();
  }

  const p = teams[0].length;
  const e = teams[1].length;
  const result: BattleResult = p && !e ? 'win' : e && !p ? 'lose' : 'draw';
  emit({ t: 'end', result });
  return { initial, events, result };
}
