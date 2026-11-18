import { getCommander, type CommanderDef } from '../data/commanders';
import { CREATURES, getDef, scaled, SHOP_POOL, type CreatureDef, type Effect } from '../data/creatures';
import { EVOLVE_BONUS } from '../data/evolutions';
import { NO_BONUSES, type MetaBonuses } from '../data/upgrades';
import { RARITY, rollRarity, sellValue } from '../data/rarity';
import type { BattleResult } from '../sim/field';
import { Rng, randomSeed } from '../sim/rng';
import type { ArmySnapshot, SquadSpec } from './army';

export const MAX_SQUADS = 5;
/** Chance each shop slot offers another copy of a creature already in your army. */
export const DUPLICATE_CHANCE = 0.25;
/** Health gained per merge (attack gains 1). */
export const MERGE_HP = 2;

type ShopTrigger = 'buy' | 'sell' | 'endTurn' | 'startTurn' | 'allyBought' | 'evolve';

export interface TeamUnit extends SquadSpec {
  /** Permanent stats this squad has earned this run (shown on its card). */
  grownAtk?: number;
  grownHp?: number;
  /** Merge experience: level 2 at 2 xp, level 3 at 5 xp. */
  xp: number;
}

export interface ShopSlot {
  unit: TeamUnit;
  frozen: boolean;
}

export const START_GOLD = 10;
/** Gold can be saved between turns, up to this much. */
export const MAX_GOLD = 99;
/** Interest: +1 gold per this much saved, up to MAX_INTEREST. */
export const INTEREST_PER = 5;
export const MAX_INTEREST = 3;
/** Extra gold after winning a battle. */
export const WIN_BONUS = 1;

/** Base income: 10 gold every round (interest and the win bonus come on top). */
export function baseIncome(_round: number): number {
  return START_GOLD;
}

export function interestOn(saved: number, cap = MAX_INTEREST): number {
  return Math.min(cap, Math.floor(Math.max(0, saved) / INTEREST_PER));
}

export interface Income {
  base: number;
  interest: number;
  win: number;
  /** Commander perks and banked gold. */
  bonus: number;
  total: number;
}
export const REROLL_COST = 1;
export const START_LIVES = 15;

/** Lives lost per defeat: 1 early, rising to 3. */
export function livesLost(round: number): number {
  return round <= 4 ? 1 : round <= 8 ? 2 : 3;
}
export const WINS_TO_VICTORY = 10;

export function levelForXp(xp: number): number {
  return xp >= 5 ? 3 : xp >= 2 ? 2 : 1;
}

/** XP still needed for the next level, or null at max level. */
export function xpProgress(xp: number): { have: number; need: number } | null {
  if (xp >= 5) return null;
  return xp >= 2 ? { have: xp - 2, need: 3 } : { have: xp, need: 2 };
}

export function unitCost(defId: string): number {
  return RARITY[getDef(defId).rarity].cost;
}

/**
 * Roll a shop creature: pick a rarity with the round's odds, then a creature of that rarity
 * from `pool` (defaults to every creature; players roll only what they've unlocked).
 */
export function rollCreature(rng: Rng, round: number, pool: readonly CreatureDef[] = SHOP_POOL): CreatureDef {
  const rarity = rollRarity(round, rng.next());
  const ofRarity = pool.filter((c) => c.rarity === rarity);
  // Fall back to the closest rarity the pool has.
  if (ofRarity.length) return rng.pick(ofRarity);
  for (let d = 1; d < 5; d++) {
    const near = pool.filter((c) => c.rarity === rarity - d || c.rarity === rarity + d);
    if (near.length) return rng.pick(near);
  }
  return rng.pick(SHOP_POOL);
}

export interface RunOptions {
  seed?: number;
  commander?: string;
  /** Creature ids the shop may roll (the player's unlocked collection). */
  pool?: string[];
  /** Permanent upgrades from Command HQ. */
  meta?: MetaBonuses;
}

/**
 * playing: in progress. won: just reached 10 wins (champion). lost: out of lives.
 * conquered: survived Endless Mode to the final round.
 */
export type RunStatus = 'playing' | 'won' | 'lost' | 'conquered';

/**
 * Hard cap on Endless Mode. It's a ceiling, not a goal: enemies scale so hard
 * that runs are expected to end well before it (see the playtest).
 */
export const ENDLESS_FINAL_ROUND = 50;
/** Lives lost per defeat in Endless Mode (same as late normal rounds). */
export const ENDLESS_LOSS_LIVES = 3;

/** One full playthrough: shop state, team, lives and wins. Pure logic, no rendering. */
export class Run {
  round = 1;
  lives = START_LIVES;
  wins = 0;
  gold = 0;
  /** Index 0 is the front of the team. */
  team: (TeamUnit | null)[] = Array(MAX_SQUADS).fill(null);
  shop: (ShopSlot | null)[] = [];
  lastResult: BattleResult | null = null;
  readonly commander: CommanderDef;
  /** Gold banked by economy abilities, added at the start of next turn. */
  bankedGold = 0;
  private freeRerolls = 0;
  private readonly pool: CreatureDef[];
  private rng: Rng;

  constructor(opts: RunOptions | number = {}) {
    const o = typeof opts === 'number' ? { seed: opts } : opts;
    this.endless = false;
    this.rng = new Rng(o.seed ?? randomSeed());
    this.commander = getCommander(o.commander);
    this.meta = o.meta ?? NO_BONUSES;
    const pool = (o.pool ?? SHOP_POOL.map((c) => c.id)).map((id) => CREATURES[id]).filter((c) => c && !c.token);
    this.pool = pool.length ? pool : SHOP_POOL;
    this.lives = this.maxLives;
    this.gold = this.meta.startGold;
    this.startTurn();
    this.refillShop(true);
  }

  /** Whether this run's shop can roll the creature (i.e. the player has it unlocked). */
  inPool(defId: string): boolean {
    return this.pool.some((c) => c.id === defId);
  }

  private get fx() {
    return this.commander.effects;
  }

  /** Permanent upgrades (Command HQ) for this run. */
  readonly meta: MetaBonuses;

  get maxLives(): number {
    return (this.fx.startLives ?? START_LIVES) + this.meta.extraLives;
  }

  get interestCap(): number {
    return MAX_INTEREST + this.meta.interestCap;
  }

  /** Free rerolls left this turn (commander perk). */
  get rerollCost(): number {
    return this.freeRerolls > 0 ? 0 : REROLL_COST;
  }

  /** What the coming turn pays, given the gold you hold now. */
  incomeFor(round: number, saved: number, won: boolean): Income {
    const income: Income = {
      base: baseIncome(round),
      interest: round > 1 ? interestOn(saved, this.interestCap) : 0,
      win: won ? WIN_BONUS : 0,
      bonus:
        (this.fx.goldEveryOtherRound && round % 2 === 0 ? this.fx.goldEveryOtherRound : 0) +
        this.bankedGold,
      total: 0,
    };
    income.total = income.base + income.interest + income.win + income.bonus;
    return income;
  }

  /** Income you'd get next turn if you stopped spending now (for the shop UI). */
  get projectedIncome(): Income {
    return this.incomeFor(this.round + 1, this.gold, false);
  }

  /** Start a shop turn: unspent gold carries over, plus income and interest. */
  private startTurn(lastResult?: BattleResult) {
    this.lastIncome = this.incomeFor(this.round, this.gold, lastResult === 'win');
    this.gold = Math.min(MAX_GOLD, this.gold + this.lastIncome.total);
    this.bankedGold = 0;
    this.freeRerolls = (this.fx.freeRerollsPerTurn ?? 0) + this.meta.freeRerolls;
    for (const u of this.team) if (u) this.fireShopTrigger(u, 'startTurn');
  }

  /** Breakdown of the gold received at the start of this turn. */
  lastIncome: Income | null = null;

  /** Continued past 10 wins: the run only ends when lives run out. */
  endless = false;
  /** Wins at the moment Endless Mode started (always WINS_TO_VICTORY). */
  get endlessWins(): number {
    return this.endless ? Math.max(0, this.wins - WINS_TO_VICTORY) : 0;
  }

  /** Round Endless Mode began on. */
  endlessFrom = 0;

  /** Rounds played in Endless Mode so far. */
  get endlessRounds(): number {
    return this.endless ? Math.max(0, Math.min(this.round - 1, ENDLESS_FINAL_ROUND) - this.endlessFrom + 1) : 0;
  }

  /** Keep playing after becoming champion. */
  continueEndless() {
    if (this.wins >= WINS_TO_VICTORY && !this.endless) {
      this.endless = true;
      this.endlessFrom = this.round;
    }
  }

  get status(): RunStatus {
    if (this.endless) {
      if (this.lives <= 0) return 'lost';
      return this.round > ENDLESS_FINAL_ROUND ? 'conquered' : 'playing';
    }
    if (this.wins >= WINS_TO_VICTORY) return 'won';
    if (this.lives <= 0) return 'lost';
    return 'playing';
  }

  get shopSize(): number {
    return (this.round >= 7 ? 5 : this.round >= 3 ? 4 : 3) + (this.fx.extraShopSlot ?? 0) + this.meta.shopSlots;
  }

  private rollUnit(): TeamUnit {
    // Sometimes offer another copy of a creature you already field, so merging and
    // evolving stay reachable no matter how many creatures you've unlocked.
    const owned = this.team.filter((u): u is TeamUnit => !!u && u.level < 3);
    if (owned.length && this.rng.next() < DUPLICATE_CHANCE) {
      const d = getDef(this.rng.pick(owned).defId);
      return { defId: d.id, atk: d.atk, hp: d.hp, level: 1, xp: 0 };
    }
    const def = rollCreature(this.rng, this.round, this.pool);
    return { defId: def.id, atk: def.atk, hp: def.hp, level: 1, xp: 0 };
  }

  /** Gold price of a shop slot. */
  cost(shopIndex: number): number {
    const slot = this.shop[shopIndex];
    return slot ? this.priceOf(slot.unit.defId) : 0;
  }

  private refillShop(all: boolean) {
    const next: (ShopSlot | null)[] = [];
    const frozen = all ? [] : this.shop.filter((s): s is ShopSlot => !!s && s.frozen);
    next.push(...frozen);
    while (next.length < this.shopSize) next.push({ unit: this.rollUnit(), frozen: false });
    this.shop = next;
  }

  reroll(): boolean {
    if (this.freeRerolls > 0) this.freeRerolls--;
    else if (this.gold < REROLL_COST) return false;
    else this.gold -= REROLL_COST;
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
    if (!slot || this.gold < this.priceOf(slot.unit.defId)) return false;
    return !target || (target.defId === slot.unit.defId && target.level < 3);
  }

  /** Buy into an empty team slot, or merge onto a matching creature. */
  buy(shopIndex: number, teamIndex: number): boolean {
    if (!this.canPlace(shopIndex, teamIndex)) return false;
    const slot = this.shop[shopIndex]!;
    this.gold -= this.priceOf(slot.unit.defId);
    this.shop[shopIndex] = null;
    const target = this.team[teamIndex];
    let placed: TeamUnit;
    const bonus = this.fx.buyBonus;
    const bought = { ...slot.unit };
    if (bonus && getDef(bought.defId).element === bonus.element) {
      bought.atk += bonus.atk;
      bought.hp += bonus.hp;
    }
    if (target) {
      this.mergeInto(target, bought);
      placed = target;
    } else {
      placed = bought;
      this.team[teamIndex] = placed;
    }
    this.fireShopTrigger(placed, 'buy');
    // Other squads that react to new recruits.
    for (const u of this.team) if (u && u !== placed) this.fireShopTrigger(u, 'allyBought');
    return true;
  }

  sell(teamIndex: number): boolean {
    const unit = this.team[teamIndex];
    if (!unit) return false;
    this.gold += this.sellPrice(unit);
    // Sell abilities fire while the squad is still in place (so 'next to it' works), then it leaves.
    this.fireShopTrigger(unit, 'sell');
    this.team[teamIndex] = null;
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
    // Keep the bigger "grown" record so earned upgrades aren't lost by merging.
    target.grownAtk = Math.max(target.grownAtk ?? 0, source.grownAtk ?? 0);
    target.grownHp = Math.max(target.grownHp ?? 0, source.grownHp ?? 0);
    target.xp = Math.min(5, target.xp + source.xp + 1);
    const before = target.level;
    target.level = levelForXp(target.xp);
    // Each evolution (level 2, level 3) adds a one-time stat jump, then fires Evolve abilities.
    for (let lv = before + 1; lv <= target.level; lv++) {
      target.atk += EVOLVE_BONUS[lv].atk;
      target.hp += EVOLVE_BONUS[lv].hp;
      this.fireShopTrigger(target, 'evolve');
    }
  }

  private fireShopTrigger(unit: TeamUnit, trigger: ShopTrigger) {
    for (const ab of getDef(unit.defId).abilities) {
      if (ab.trigger !== trigger) continue;
      for (const e of ab.effects) this.applyShopEffect(unit, e, trigger);
    }
  }

  /** Permanently raise a squad's stats, remembering how much it has grown this run. */
  private grow(u: TeamUnit, atk: number, hp: number) {
    const before = u.atk;
    u.atk = Math.max(0, u.atk + atk);
    u.hp = Math.max(1, u.hp + hp);
    u.grownAtk = (u.grownAtk ?? 0) + (u.atk - before);
    u.grownHp = (u.grownHp ?? 0) + hp;
  }

  /** Shop abilities: permanent buffs between squads, and gold. Battle-only effects do nothing here. */
  private applyShopEffect(src: TeamUnit, effect: Effect, trigger: ShopTrigger) {
    const lv = src.level;
    if (effect.kind === 'gold') {
      // End-of-turn gold is banked for the next turn's income.
      if (trigger === 'endTurn') this.bankedGold += scaled(effect.amount, lv);
      else this.gold += scaled(effect.amount, lv);
      return;
    }
    if (effect.kind !== 'buff' && effect.kind !== 'grow') return;
    const idx = this.team.indexOf(src);
    const others = this.team.filter((u): u is TeamUnit => !!u && u !== src);
    let pool: TeamUnit[];
    switch (effect.kind === 'grow' ? 'self' : effect.to) {
      case 'self':
        pool = [src];
        break;
      case 'randomAlly':
        pool = this.rng.shuffled(others).slice(0, effect.kind === 'buff' ? (effect.count ?? 1) : 1);
        break;
      case 'allAllies':
        pool = others;
        break;
      case 'adjacent':
        pool = [this.team[idx - 1], this.team[idx + 1]].filter((u): u is TeamUnit => !!u);
        break;
      case 'frontAlly':
        pool = this.team.filter((u): u is TeamUnit => !!u).slice(0, 1);
        break;
      default:
        pool = [];
    }
    for (const u of pool) {
      if (effect.kind === 'buff' && effect.element && getDef(u.defId).element !== effect.element) continue;
      this.grow(u, scaled(effect.atk, lv), scaled(effect.hp, lv));
    }
  }

  /** Apply what squads earned in battle (growth abilities), mapped back to army slots. */
  applyBattleGrowth(growth: Map<number, { atk: number; hp: number }>): { defId: string; level: number; atk: number; hp: number }[] {
    const lineup = this.team.filter((u): u is TeamUnit => !!u);
    const report: { defId: string; level: number; atk: number; hp: number }[] = [];
    for (const [squad, g] of growth) {
      const u = lineup[squad];
      if (!u || (!g.atk && !g.hp)) continue;
      this.grow(u, g.atk, g.hp);
      report.push({ defId: u.defId, level: u.level, atk: g.atk, hp: g.hp });
    }
    return report;
  }

  /** Gold you get for selling a squad (incl. commander and upgrade bonuses). */
  sellPrice(u: TeamUnit): number {
    return sellValue(getDef(u.defId).rarity, u.xp) + (this.fx.sellBonus ?? 0) + this.meta.sellBonus;
  }

  /** Price of a creature for this run (commander discounts applied). */
  priceOf(defId: string): number {
    const d = this.fx.elementDiscount;
    const base = unitCost(defId);
    return d && getDef(defId).element === d.element ? Math.max(1, base - d.amount) : base;
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
      commander: this.commander.id,
      boost: { atkPct: this.meta.atkPct, hpPct: this.meta.hpPct },
    };
  }

  /** Apply the battle outcome and start the next shop turn. */
  finishBattle(result: BattleResult) {
    this.lastResult = result;
    if (result === 'win') this.wins++;
    if (this.endless) {
      if (result === 'lose') this.lives = Math.max(0, this.lives - ENDLESS_LOSS_LIVES);
    } else if (result === 'lose') {
      this.lives = Math.max(0, this.lives - livesLost(this.round));
    }
    this.round++;
    this.startTurn(result);
    this.refillShop(false);
  }

  battleSeed(): number {
    return this.rng.int(2 ** 31);
  }
}
