import { getDef, scaled, SHOP_POOL, type Effect } from '../data/creatures';
import type { BattleResult } from '../sim/field';
import { Rng, randomSeed } from '../sim/rng';
import type { ArmySnapshot, SquadSpec } from './army';
import { emptyModules, MODULES, moduleBonus, type ModuleId, type ModuleLevels } from './mothership';

export const MAX_SQUADS = 5;
/** Health gained per merge (attack gains 1). */
export const MERGE_HP = 2;

export interface TeamUnit extends SquadSpec {
  /** Merge experience: level 2 at 2 xp, level 3 at 5 xp. */
  xp: number;
}

export interface ShopSlot {
  unit: TeamUnit;
  frozen: boolean;
}

export const START_GOLD = 10;
export const UNIT_COST = 3;
export const REROLL_COST = 1;
export const START_LIVES = 5;
export const WINS_TO_VICTORY = 10;

export function levelForXp(xp: number): number {
  return xp >= 5 ? 3 : xp >= 2 ? 2 : 1;
}

/** XP still needed for the next level, or null at max level. */
export function xpProgress(xp: number): { have: number; need: number } | null {
  if (xp >= 5) return null;
  return xp >= 2 ? { have: xp - 2, need: 3 } : { have: xp, need: 2 };
}

export type RunStatus = 'playing' | 'won' | 'lost';

/** One full playthrough: shop state, team, lives and wins. Pure logic, no rendering. */
export class Run {
  round = 1;
  lives = START_LIVES;
  wins = 0;
  gold = START_GOLD;
  /** Index 0 is the front of the team. */
  team: (TeamUnit | null)[] = Array(MAX_SQUADS).fill(null);
  modules: ModuleLevels = emptyModules();
  shop: (ShopSlot | null)[] = [];
  lastResult: BattleResult | null = null;
  private rng: Rng;

  constructor(seed = randomSeed()) {
    this.rng = new Rng(seed);
    this.refillShop(true);
  }

  get status(): RunStatus {
    if (this.wins >= WINS_TO_VICTORY) return 'won';
    if (this.lives <= 0) return 'lost';
    return 'playing';
  }

  get maxTier(): number {
    return Math.min(4, Math.ceil(this.round / 2));
  }

  get shopSize(): number {
    return this.round >= 5 ? 4 : 3;
  }

  private rollUnit(): TeamUnit {
    const pool = SHOP_POOL.filter((c) => c.tier <= this.maxTier);
    const def = this.rng.pick(pool);
    return { defId: def.id, atk: def.atk, hp: def.hp, level: 1, xp: 0 };
  }

  private refillShop(all: boolean) {
    const next: (ShopSlot | null)[] = [];
    const frozen = all ? [] : this.shop.filter((s): s is ShopSlot => !!s && s.frozen);
    next.push(...frozen);
    while (next.length < this.shopSize) next.push({ unit: this.rollUnit(), frozen: false });
    this.shop = next;
  }

  reroll(): boolean {
    if (this.gold < REROLL_COST) return false;
    this.gold -= REROLL_COST;
    this.refillShop(false);
    return true;
  }

  toggleFreeze(shopIndex: number) {
    const slot = this.shop[shopIndex];
    if (slot) slot.frozen = !slot.frozen;
  }

  canPlace(shopIndex: number, teamIndex: number): boolean {
    const slot = this.shop[shopIndex];
    const target = this.team[teamIndex];
    if (!slot || this.gold < UNIT_COST) return false;
    return !target || (target.defId === slot.unit.defId && target.level < 3);
  }

  /** Buy into an empty team slot, or merge onto a matching creature. */
  buy(shopIndex: number, teamIndex: number): boolean {
    if (!this.canPlace(shopIndex, teamIndex)) return false;
    const slot = this.shop[shopIndex]!;
    this.gold -= UNIT_COST;
    this.shop[shopIndex] = null;
    const target = this.team[teamIndex];
    let placed: TeamUnit;
    if (target) {
      this.mergeInto(target, slot.unit);
      placed = target;
    } else {
      placed = { ...slot.unit };
      this.team[teamIndex] = placed;
    }
    this.fireShopTrigger(placed, 'buy');
    return true;
  }

  sell(teamIndex: number): boolean {
    const unit = this.team[teamIndex];
    if (!unit) return false;
    this.team[teamIndex] = null;
    this.gold += unit.level;
    this.fireShopTrigger(unit, 'sell');
    return true;
  }

  /** Move a creature to another slot: swap, or merge if it's the same species. */
  move(from: number, to: number): boolean {
    if (from === to) return false;
    const a = this.team[from];
    const b = this.team[to];
    if (!a) return false;
    if (b && b.defId === a.defId && b.level < 3 && a.level < 3) {
      this.mergeInto(b, a);
      this.team[from] = null;
      return true;
    }
    this.team[from] = b;
    this.team[to] = a;
    return true;
  }

  private mergeInto(target: TeamUnit, source: TeamUnit) {
    target.atk = Math.max(target.atk, source.atk) + 1;
    target.hp = Math.max(target.hp, source.hp) + MERGE_HP;
    target.xp = Math.min(5, target.xp + source.xp + 1);
    target.level = levelForXp(target.xp);
  }

  private fireShopTrigger(unit: TeamUnit, trigger: 'buy' | 'sell' | 'endTurn') {
    for (const ab of getDef(unit.defId).abilities) {
      if (ab.trigger !== trigger) continue;
      for (const e of ab.effects) this.applyShopEffect(unit, e);
    }
  }

  /** Shop abilities: buffs between squads and gold. Battle-only effects do nothing here. */
  private applyShopEffect(src: TeamUnit, effect: Effect) {
    const lv = src.level;
    if (effect.kind === 'gold') {
      this.gold += scaled(effect.amount, lv);
      return;
    }
    if (effect.kind !== 'buff') return;
    const others = this.team.filter((u): u is TeamUnit => !!u && u !== src);
    const pool =
      effect.to === 'self'
        ? [src]
        : effect.to === 'randomAlly'
          ? others.length
            ? [this.rng.pick(others)]
            : []
          : effect.to === 'allAllies'
            ? others
            : [];
    for (const u of pool) {
      if (effect.element && getDef(u.defId).element !== effect.element) continue;
      u.atk = Math.max(0, u.atk + scaled(effect.atk, lv));
      u.hp += scaled(effect.hp, lv);
    }
  }

  get turnGold(): number {
    return START_GOLD + moduleBonus('reactor', this.modules.reactor);
  }

  moduleCost(id: ModuleId): number | null {
    const def = MODULES.find((m) => m.id === id)!;
    const lvl = this.modules[id];
    return lvl >= def.maxLevel ? null : def.costs[lvl];
  }

  buyModule(id: ModuleId): boolean {
    const cost = this.moduleCost(id);
    if (cost === null || this.gold < cost) return false;
    this.gold -= cost;
    this.modules[id]++;
    return true;
  }

  /** End the shop phase: fire end-turn abilities. */
  endTurn() {
    for (const u of this.team) if (u) this.fireShopTrigger(u, 'endTurn');
  }

  /** The army as it stands now, front squad first. Used for battle and matchmaking. */
  snapshot(name: string): ArmySnapshot {
    return {
      name,
      round: this.round,
      wins: this.wins,
      lives: this.lives,
      squads: this.team.filter((u): u is TeamUnit => !!u).map(({ defId, atk, hp, level }) => ({ defId, atk, hp, level })),
      modules: { ...this.modules },
    };
  }

  /** Apply the battle outcome and start the next shop turn. */
  finishBattle(result: BattleResult) {
    this.lastResult = result;
    if (result === 'win') this.wins++;
    if (result === 'lose') this.lives = Math.max(0, this.lives - (this.round <= 2 ? 1 : 2));
    this.round++;
    this.gold = this.turnGold;
    this.refillShop(false);
  }

  battleSeed(): number {
    return this.rng.int(2 ** 31);
  }
}
