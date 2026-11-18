import { getDef, scaled, type Effect, type Trigger } from '../data/creatures';
import { typeMultiplier, type Element } from '../data/elements';
import { squadCount, type ArmySnapshot } from '../game/army';
import { moduleBonus } from '../game/mothership';
import { Rng } from './rng';

export type Side = 0 | 1;
export type BattleResult = 'win' | 'lose' | 'draw';

// ── Tuning ────────────────────────────────────────────────
export const DT = 0.05; // seconds per tick (20 ticks/s)
export const FIELD_W = 1200;
export const FIELD_H = 400;
export const TIME_LIMIT = 75; // seconds before a draw is called
const HP_X = 3; // creature health is multiplied so fights last a few hits
const ABILITY_DMG_X = 2;
const MELEE_RANGE = 8;
const RANGED_RANGE = 200;
const SPEED_MELEE = 75;
const SPEED_RANGED = 60;
const COOLDOWN_MELEE = 1.0;
const COOLDOWN_RANGED = 1.4;
const PROJ_SPEED = 480;
const RETARGET_EVERY = 0.4;
const SEPARATION = 20;
const MAX_ALIVE_PER_SIDE = 160;
const COL_GAP = 26;
const ROW_GAP = 48;
const MAX_ROWS = 7;

export interface FieldUnit {
  id: number;
  side: Side;
  defId: string;
  element: Element;
  level: number;
  squad: number;
  x: number;
  y: number;
  px: number; // position last tick, for render interpolation
  py: number;
  hp: number;
  maxHp: number;
  atk: number;
  ranged: boolean;
  radius: number;
  cd: number;
  retarget: number;
  targetId: number;
  alive: boolean;
}

export interface Projectile {
  id: number;
  side: Side;
  x: number;
  y: number;
  targetId: number;
  dmg: number;
  sourceElement: Element;
  sourceId: number;
}

export type FieldEvent =
  | { t: 'spawn'; id: number }
  | { t: 'attack'; id: number; targetId: number }
  | { t: 'hit'; id: number; dmg: number; eff?: 'super' | 'weak'; ability?: boolean }
  | { t: 'death'; id: number }
  | { t: 'ability'; id: number }
  | { t: 'buff'; id: number; dAtk: number; dHp: number };

export class FieldBattle {
  readonly units: FieldUnit[] = [];
  readonly projectiles: Projectile[] = [];
  /** Events since the last drain; the renderer consumes these. */
  events: FieldEvent[] = [];
  time = 0;
  result: BattleResult | null = null;
  private byId = new Map<number, FieldUnit>();
  private rng: Rng;
  private nextId = 1;
  private tick = 0;
  private depth = 0;
  /** Hits landing this tick. Resolved together so simultaneous blows both connect. */
  private pending: { element: Element; atk: number; targetId: number; sourceId: number }[] = [];

  constructor(
    readonly armies: [ArmySnapshot, ArmySnapshot],
    seed: number,
  ) {
    this.rng = new Rng(seed);
    armies.forEach((army, side) => this.deploy(army, side as Side));
    // Start of battle abilities: strongest first, player side wins ties.
    const order = [...this.units].sort((a, b) => b.atk - a.atk || a.side - b.side || a.id - b.id);
    for (const u of order) if (u.alive) this.trigger(u, 'startOfBattle');
    this.checkEnd();
  }

  // ── Setup ───────────────────────────────────────────────

  private deploy(army: ArmySnapshot, side: Side) {
    const bonusAtk = moduleBonus('armory', army.modules.armory);
    const bonusHp = moduleBonus('shields', army.modules.shields);
    let cursor = FIELD_W / 2 - 110; // front edge, moving backward
    army.squads.forEach((sq, squadIdx) => {
      const count = squadCount(sq.defId, sq.level, army.modules.barracks);
      const rows = Math.min(MAX_ROWS, count);
      const cols = Math.ceil(count / rows);
      for (let i = 0; i < count; i++) {
        const col = Math.floor(i / rows);
        const row = i % rows;
        const inCol = Math.min(rows, count - col * rows);
        const x = Math.max(20, cursor - col * COL_GAP);
        const y = FIELD_H / 2 + (row - (inCol - 1) / 2) * ROW_GAP + (col % 2) * 10;
        this.spawn(side, sq.defId, sq.level, squadIdx, side === 0 ? x : FIELD_W - x, y, sq.atk + bonusAtk, sq.hp + bonusHp);
      }
      cursor -= cols * COL_GAP + 22;
    });
  }

  private spawn(side: Side, defId: string, level: number, squad: number, x: number, y: number, atk: number, hp: number) {
    const def = getDef(defId);
    const u: FieldUnit = {
      id: this.nextId++,
      side,
      defId,
      element: def.element,
      level,
      squad,
      x,
      y,
      px: x,
      py: y,
      hp: hp * HP_X,
      maxHp: hp * HP_X,
      atk,
      ranged: !!def.ranged,
      radius: def.token ? 10 : 12 + def.tier * 2,
      cd: 0.3 + this.rng.next() * 0.5, // stagger the first swing
      retarget: 0,
      targetId: 0,
      alive: true,
    };
    this.units.push(u);
    this.byId.set(u.id, u);
    return u;
  }

  unit(id: number): FieldUnit | undefined {
    return this.byId.get(id);
  }

  aliveCount(side: Side): number {
    let n = 0;
    for (const u of this.units) if (u.alive && u.side === side) n++;
    return n;
  }

  // ── Simulation ──────────────────────────────────────────

  step() {
    if (this.result) return;
    this.tick++;
    this.time += DT;
    const list = this.tick % 2 ? this.units : [...this.units].reverse();
    for (const u of list) {
      u.px = u.x;
      u.py = u.y;
    }
    for (const u of list) if (u.alive) this.think(u);
    this.moveProjectiles();
    const hits = this.pending;
    this.pending = [];
    for (const h of hits) {
      const target = this.byId.get(h.targetId);
      if (target) this.strike(h.element, h.atk, target, this.byId.get(h.sourceId));
    }
    this.checkEnd();
  }

  runToEnd(): BattleResult {
    while (!this.result) this.step();
    return this.result!;
  }

  private think(u: FieldUnit) {
    u.cd -= DT;
    u.retarget -= DT;
    let target = this.byId.get(u.targetId);
    if (!target?.alive || u.retarget <= 0) {
      target = this.nearestEnemy(u);
      u.targetId = target?.id ?? 0;
      u.retarget = RETARGET_EVERY;
    }
    if (!target) return;

    // Decisions read start-of-tick positions (px/py) so processing order never matters.
    const dx = target.px - u.px;
    const dy = target.py - u.py;
    const dist = Math.hypot(dx, dy) || 0.001;
    const reach = (u.ranged ? RANGED_RANGE : MELEE_RANGE) + u.radius + target.radius;

    if (dist > reach) {
      const speed = (u.ranged ? SPEED_RANGED : SPEED_MELEE) * DT;
      u.x += (dx / dist) * speed;
      u.y += (dy / dist) * speed;
    } else if (u.cd <= 0) {
      u.cd = u.ranged ? COOLDOWN_RANGED : COOLDOWN_MELEE;
      this.events.push({ t: 'attack', id: u.id, targetId: target.id });
      this.trigger(u, 'beforeAttack', target);
      if (!u.alive || !target.alive) return;
      if (u.ranged) {
        this.projectiles.push({
          id: this.nextId++,
          side: u.side,
          x: u.x,
          y: u.y,
          targetId: target.id,
          dmg: u.atk,
          sourceElement: u.element,
          sourceId: u.id,
        });
      } else {
        this.pending.push({ element: u.element, atk: u.atk, targetId: target.id, sourceId: u.id });
      }
    }
    this.separate(u);
  }

  /** Push away from overlapping allies so armies spread out instead of stacking. */
  private separate(u: FieldUnit) {
    for (const o of this.units) {
      if (o === u || !o.alive || o.side !== u.side) continue;
      const dx = u.px - o.px;
      const dy = u.py - o.py;
      if (Math.abs(dx) > SEPARATION || Math.abs(dy) > SEPARATION) continue;
      const d = Math.hypot(dx, dy);
      if (d >= SEPARATION) continue;
      const push = (SEPARATION - d) * 0.25;
      const nx = d > 0.01 ? dx / d : u.id < o.id ? -0.7 : 0.7;
      const ny = d > 0.01 ? dy / d : u.id < o.id ? -0.7 : 0.7;
      u.x += nx * push;
      u.y += ny * push;
    }
    u.x = Math.min(FIELD_W - 10, Math.max(10, u.x));
    u.y = Math.min(FIELD_H - 10, Math.max(10, u.y));
  }

  private nearestEnemy(u: FieldUnit): FieldUnit | undefined {
    let best: FieldUnit | undefined;
    let bestD = Infinity;
    for (const o of this.units) {
      if (!o.alive || o.side === u.side) continue;
      const d = (o.px - u.px) ** 2 + (o.py - u.py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private moveProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const t = this.byId.get(p.targetId);
      if (!t?.alive) {
        this.projectiles.splice(i, 1);
        continue;
      }
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const d = Math.hypot(dx, dy);
      const step = PROJ_SPEED * DT;
      if (d <= step + t.radius) {
        this.projectiles.splice(i, 1);
        this.pending.push({ element: p.sourceElement, atk: p.dmg, targetId: t.id, sourceId: p.sourceId });
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
  }

  private checkEnd() {
    if (this.result) return;
    const a = this.aliveCount(0);
    const b = this.aliveCount(1);
    if (!a || !b) this.result = a ? 'win' : b ? 'lose' : 'draw';
    else if (this.time >= TIME_LIMIT) this.result = 'draw';
  }

  // ── Damage & abilities ──────────────────────────────────

  /** A normal attack hit: type advantage applies. */
  private strike(element: Element, atk: number, target: FieldUnit, source?: FieldUnit) {
    if (!target.alive || atk <= 0) return;
    const mult = typeMultiplier(element, target.element);
    const dmg = Math.max(1, Math.round(atk * mult));
    this.damage(target, dmg, mult > 1 ? 'super' : mult < 1 ? 'weak' : undefined, false, source);
  }

  private damage(target: FieldUnit, dmg: number, eff: 'super' | 'weak' | undefined, ability: boolean, source?: FieldUnit) {
    if (!target.alive || dmg <= 0) return;
    target.hp -= dmg;
    this.events.push({ t: 'hit', id: target.id, dmg, eff, ability });
    if (target.hp <= 0) this.kill(target);
    else this.trigger(target, 'hurt', source);
  }

  private kill(u: FieldUnit) {
    u.alive = false;
    u.hp = 0;
    this.events.push({ t: 'death', id: u.id });
    this.trigger(u, 'faint');
  }

  private buff(u: FieldUnit, atk: number, hp: number) {
    if (!u.alive) return;
    const before = u.atk;
    u.atk = Math.max(0, u.atk + atk);
    u.hp += hp * HP_X;
    u.maxHp += hp * HP_X;
    this.events.push({ t: 'buff', id: u.id, dAtk: u.atk - before, dHp: hp });
  }

  private trigger(u: FieldUnit, kind: Trigger, other?: FieldUnit) {
    const ab = getDef(u.defId).ability;
    if (!ab || ab.trigger !== kind) return;
    // Guard against long hurt -> hurt chains.
    if (this.depth > 6) return;
    this.depth++;
    this.events.push({ t: 'ability', id: u.id });
    this.apply(u, ab.effect, other);
    this.depth--;
  }

  private enemiesOf(u: FieldUnit) {
    return this.units.filter((o) => o.alive && o.side !== u.side);
  }

  private apply(src: FieldUnit, effect: Effect, other?: FieldUnit) {
    const lv = src.level;
    const dmg = (n: number) => scaled(n, lv) * ABILITY_DMG_X;
    switch (effect.kind) {
      case 'damageRandomEnemy': {
        const es = this.enemiesOf(src);
        if (es.length) this.damage(this.rng.pick(es), dmg(effect.amount), undefined, true);
        break;
      }
      case 'damageLowestEnemy': {
        const es = this.enemiesOf(src);
        if (es.length) this.damage(es.reduce((m, o) => (o.hp < m.hp ? o : m)), dmg(effect.amount), undefined, true);
        break;
      }
      case 'damageAllEnemies':
        for (const e of this.enemiesOf(src)) this.damage(e, dmg(effect.amount), undefined, true);
        break;
      case 'damageFrontEnemy': {
        const e = other?.alive && other.side !== src.side ? other : this.nearestEnemy(src);
        if (e) this.damage(e, dmg(effect.amount), undefined, true);
        break;
      }
      case 'damageNearTarget': {
        if (!other) break;
        let best: FieldUnit | undefined;
        let bestD = Infinity;
        for (const o of this.units) {
          if (!o.alive || o.side === src.side || o === other) continue;
          const d = (o.x - other.x) ** 2 + (o.y - other.y) ** 2;
          if (d < bestD) [best, bestD] = [o, d];
        }
        if (best) this.damage(best, dmg(effect.amount), undefined, true);
        break;
      }
      case 'debuffFrontEnemyAtk': {
        const e = this.nearestEnemy(src);
        if (e) this.buff(e, -scaled(effect.amount, lv), 0);
        break;
      }
      case 'buffSelf':
        this.buff(src, scaled(effect.atk, lv), scaled(effect.hp, lv));
        break;
      case 'buffRandomAlly': {
        const allies = this.units.filter((o) => o.alive && o.side === src.side && o !== src);
        if (allies.length) this.buff(this.rng.pick(allies), scaled(effect.atk, lv), scaled(effect.hp, lv));
        break;
      }
      case 'buffAllAllies':
        for (const o of this.units) {
          if (o.alive && o.side === src.side && o !== src) this.buff(o, scaled(effect.atk, lv), scaled(effect.hp, lv));
        }
        break;
      case 'summon': {
        if (this.aliveCount(src.side) >= MAX_ALIVE_PER_SIDE) break;
        const t = this.spawn(src.side, effect.token, 1, src.squad, src.x, src.y, scaled(effect.atk, lv), scaled(effect.hp, lv));
        this.events.push({ t: 'spawn', id: t.id });
        break;
      }
    }
  }
}
