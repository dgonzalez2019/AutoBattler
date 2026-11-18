import { getDef, scaled, type Ability, type Effect, type Target, type Trigger } from '../data/creatures';
import { typeMultiplier, type Element } from '../data/elements';
import type { CreatureClass, TraitLevels } from '../data/traits';
import { squadCount, type ArmySnapshot } from '../game/army';
import { computeTraits } from '../game/synergy';
import { getCommander, type CommanderEffects } from '../data/commanders';
import { Rng } from './rng';

export type Side = 0 | 1;
export type BattleResult = 'win' | 'lose' | 'draw';

// ── Tuning ────────────────────────────────────────────────
export const DT = 0.05; // seconds per tick (20 ticks/s)
export const FIELD_W = 1200;
export const FIELD_H = 440;
export const TIME_LIMIT = 75; // seconds before a draw is called
const MELEE_RANGE = 8;
const RANGED_RANGE = 200;
const SPEED_MELEE = 90;
const SPEED_RANGED = 60;
const COOLDOWN_MELEE = 1.0;
const COOLDOWN_RANGED = 1.6;
const PROJ_SPEED = 480;
const RETARGET_EVERY = 0.4;
const SEPARATION = 20;
/** Targeting: vertical distance counts this much more than horizontal, so units fight in their own row. */
const LANE_WEIGHT = 2.5;
/** Melee attackers already on a target beyond which others look elsewhere. */
const MAX_ENGAGE = 3;
/** Extra "distance" (squared px) per melee attacker already engaging a target. */
const CROWD_PENALTY = 60 ** 2;
const AROUND_RADIUS = 70;
const MAX_ALIVE_PER_SIDE = 160;
const COL_GAP = 26;
const ROW_GAP = 52;
const MAX_ROWS = 8;
const BURN_TICK = 1;
/** Max battle-growth events per squad per battle. */
export const GROW_CAP = 2;

// ── Synergy numbers (player-facing text lives in data/traits.ts) ──
const CHILL_SLOW = [0.3, 0.4, 0.55];
const BIO_REGEN = [0, 1, 2];
const VOID_LIFESTEAL = [0, 0.35, 0.6];
const VANGUARD_REDUCTION = [0, 0.15, 0.3];
const STRIKER_HASTE = [0, 0.3, 0.6];
const STRIKER_SPEED = [0, 0.3, 0.5];
const MYSTIC_POWER = [1, 1.5, 2];
const MECH_SHIELD = [0, 0.25, 0.5];
const SWARM_SUMMON = [
  [0, 0],
  [1, 3],
  [2, 6],
];

export interface FieldUnit {
  id: number;
  side: Side;
  defId: string;
  element: Element;
  cls: CreatureClass;
  token: boolean;
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
  range: number;
  radius: number;
  cd: number;
  retarget: number;
  targetId: number;
  alive: boolean;
  // Status effects and synergy stats
  shield: number;
  burn: number;
  burnTimer: number;
  burnFade: boolean;
  chill: number;
  chillSlow: number;
  chillWeaken: boolean;
  regen: number;
  lifesteal: number;
  damageTaken: number;
  haste: number;
  crit: number;
  splash: boolean;
  moveSpeed: number;
  shieldBreakAtk: number;
  timers: number[];
  /** Already used its once-per-battle rebirth. */
  reborn: boolean;
}

export interface Projectile {
  id: number;
  side: Side;
  x: number;
  y: number;
  targetId: number;
  sourceId: number;
  sourceElement: Element;
}

export type FieldEvent =
  | { t: 'spawn'; id: number }
  | { t: 'attack'; id: number; targetId: number }
  | { t: 'hit'; id: number; dmg: number; eff?: 'super' | 'weak'; ability?: boolean; crit?: boolean; burn?: boolean }
  | { t: 'death'; id: number }
  | { t: 'ability'; id: number }
  | { t: 'buff'; id: number; dAtk: number; dHp: number }
  | { t: 'heal'; id: number; amount: number }
  | { t: 'shield'; id: number; amount: number }
  | { t: 'shieldBreak'; id: number }
  | { t: 'status'; id: number; kind: 'burn' | 'chill' }
  /** A squad permanently grew (kept after the battle). */
  | { t: 'grow'; id: number; atk: number; hp: number };

interface PendingHit {
  targetId: number;
  sourceId: number;
  atk: number;
  element: Element;
  side: Side;
  splash: boolean;
}

export class FieldBattle {
  readonly units: FieldUnit[] = [];
  readonly projectiles: Projectile[] = [];
  readonly traits: [TraitLevels, TraitLevels];
  /** Each side's commander passive. */
  readonly cmd: [CommanderEffects, CommanderEffects];
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
  private pending: PendingHit[] = [];
  /**
   * Battle growth per side and squad index: permanent stats the squad keeps
   * after this battle (applied to the team by the run), with how many times it grew.
   */
  readonly growth: [Map<number, { atk: number; hp: number; times: number }>, Map<number, { atk: number; hp: number; times: number }>] = [
    new Map(),
    new Map(),
  ];
  /** Melee attackers per target, counted at the start of each tick (order-independent). */
  private engaged = new Map<number, number>();

  constructor(
    readonly armies: [ArmySnapshot, ArmySnapshot],
    seed: number,
  ) {
    this.rng = new Rng(seed);
    this.traits = [computeTraits(armies[0].squads).levels, computeTraits(armies[1].squads).levels];
    this.cmd = [getCommander(armies[0].commander).effects, getCommander(armies[1].commander).effects];
    armies.forEach((army, side) => this.deploy(army, side as Side));
    // Commander openers
    ([0, 1] as Side[]).forEach((side) => {
      const secs = this.cmd[side].chillAllSeconds;
      if (secs) for (const u of this.units) if (u.alive && u.side !== side) this.applyChill(u, secs, side);
    });
    // Start of battle abilities: strongest first, player side wins ties.
    const order = [...this.units].sort((a, b) => b.atk - a.atk || a.side - b.side || a.id - b.id);
    for (const u of order) if (u.alive) this.trigger(u, 'startOfBattle');
    this.checkEnd();
  }

  // ── Setup ───────────────────────────────────────────────

  private deploy(army: ArmySnapshot, side: Side) {
    // Permanent upgrades from Command HQ (validated and capped for online armies).
    const atkPct = army.boost?.atkPct ?? 0;
    const hpPct = army.boost?.hpPct ?? 0;
    const tr = this.traits[side];
    let cursor = FIELD_W / 2 - 110; // front edge, moving backward
    army.squads.forEach((sq, squadIdx) => {
      const def = getDef(sq.defId);
      const fx = this.cmd[side];
      const count =
        squadCount(sq.defId, sq.level, tr.swarm) + (def.class === 'swarm' ? (fx.swarmExtraUnits ?? 0) : 0);
      const frontHp = squadIdx === 0 ? (fx.frontSquadHp ?? 0) : 0;
      const rows = Math.min(MAX_ROWS, count);
      const cols = Math.ceil(count / rows);
      for (let i = 0; i < count; i++) {
        const col = Math.floor(i / rows);
        const row = i % rows;
        const inCol = Math.min(rows, count - col * rows);
        const x = Math.max(20, cursor - col * COL_GAP);
        const y = FIELD_H / 2 + (row - (inCol - 1) / 2) * ROW_GAP + (col % 2) * 10;
        this.spawn(
          side,
          sq.defId,
          sq.level,
          squadIdx,
          side === 0 ? x : FIELD_W - x,
          y,
          Math.round(sq.atk * (1 + atkPct)),
          Math.round(sq.hp * (1 + hpPct)) + frontHp,
        );
      }
      cursor -= cols * COL_GAP + 22;
    });
  }

  private spawn(side: Side, defId: string, level: number, squad: number, x: number, y: number, atk: number, hp: number) {
    const def = getDef(defId);
    const tr = this.traits[side];
    const u: FieldUnit = {
      id: this.nextId++,
      side,
      defId,
      element: def.element,
      cls: def.class,
      token: !!def.token,
      level,
      squad,
      x,
      y,
      px: x,
      py: y,
      hp,
      maxHp: hp,
      atk,
      ranged: !!def.ranged,
      range: def.ranged ? RANGED_RANGE : MELEE_RANGE,
      radius: def.token ? 10 : 12 + def.rarity * 2,
      cd: 0.3 + this.rng.next() * 0.5, // stagger the first swing
      retarget: 0,
      targetId: 0,
      alive: true,
      shield: 0,
      burn: 0,
      burnTimer: BURN_TICK,
      burnFade: true,
      chill: 0,
      chillSlow: 0,
      chillWeaken: false,
      regen: 0,
      lifesteal: 0,
      damageTaken: 1,
      haste: 0,
      crit: 0,
      splash: false,
      moveSpeed: 1,
      shieldBreakAtk: 0,
      timers: def.abilities.map((a) => (a.every ?? 0) * (this.cmd[side].timerPrecharge ?? 0)),
      reborn: false,
    };
    // Synergy bonuses
    if (u.element === 'mech' && tr.mech) {
      u.shield += Math.round(u.maxHp * MECH_SHIELD[tr.mech]);
      if (tr.mech >= 2) u.shieldBreakAtk = 2;
    }
    if (tr.bio) u.regen = u.element === 'bio' ? BIO_REGEN[tr.bio] : tr.bio >= 2 ? 1 : 0;
    if (u.element === 'void') u.lifesteal = VOID_LIFESTEAL[tr.void];
    if (u.cls === 'vanguard') u.damageTaken = 1 - VANGUARD_REDUCTION[tr.vanguard];
    if (tr.vanguard >= 2) u.shield += 4;
    if (u.cls === 'striker') {
      u.haste = STRIKER_HASTE[tr.striker];
      u.moveSpeed = 1 + STRIKER_SPEED[tr.striker];
      if (tr.striker >= 2) u.crit = 0.25;
    }
    const fx = this.cmd[side];
    if (u.element === 'mech' && fx.mechShield) u.shield += fx.mechShield;
    if (fx.classAtk && u.cls === fx.classAtk.cls) u.atk += fx.classAtk.atk;
    if (u.cls === 'gunner' && tr.gunner) {
      u.atk += 1;
      if (tr.gunner >= 2) u.splash = true;
    }
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
    this.engaged.clear();
    for (const u of list) {
      u.px = u.x;
      u.py = u.y;
      if (u.alive && !u.ranged && u.targetId) this.engaged.set(u.targetId, (this.engaged.get(u.targetId) ?? 0) + 1);
    }
    for (const u of list) if (u.alive) this.think(u);
    this.moveProjectiles();
    const hits = this.pending;
    this.pending = [];
    // Seeded shuffle: on-kill / on-hurt effects can't favor whichever side happens to be processed first.
    for (let i = hits.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1);
      [hits[i], hits[j]] = [hits[j], hits[i]];
    }
    for (const h of hits) this.resolveHit(h);
    this.checkEnd();
  }

  runToEnd(): BattleResult {
    while (!this.result) this.step();
    return this.result!;
  }

  private think(u: FieldUnit) {
    this.tickStatus(u);
    if (!u.alive) return;
    this.tickTimers(u);
    if (!u.alive) return;

    const slow = u.chill > 0 ? 1 - u.chillSlow : 1;
    u.cd -= DT * slow * (1 + u.haste);
    u.retarget -= DT;
    let target = this.byId.get(u.targetId);
    const inReach = (t: FieldUnit) => Math.hypot(t.px - u.px, t.py - u.py) <= u.range + u.radius + t.radius + 2;
    // Stick with a target already in reach; otherwise look for the best one periodically.
    if (!target?.alive || (u.retarget <= 0 && !inReach(target))) {
      target = this.chooseTarget(u);
      u.targetId = target?.id ?? 0;
      u.retarget = RETARGET_EVERY;
    }
    if (!target) return;

    // Decisions read start-of-tick positions (px/py) so processing order never matters.
    const dx = target.px - u.px;
    const dy = target.py - u.py;
    const dist = Math.hypot(dx, dy) || 0.001;
    const reach = u.range + u.radius + target.radius;

    if (dist > reach) {
      const speed = (u.ranged ? SPEED_RANGED : SPEED_MELEE) * DT * slow * u.moveSpeed;
      u.x += (dx / dist) * speed;
      u.y += (dy / dist) * speed;
    } else if (u.cd <= 0) {
      u.cd = u.ranged ? COOLDOWN_RANGED : COOLDOWN_MELEE;
      this.events.push({ t: 'attack', id: u.id, targetId: target.id });
      this.trigger(u, 'beforeAttack', target);
      if (!u.alive || !target.alive) return;
      if (u.ranged) {
        this.projectiles.push({ id: this.nextId++, side: u.side, x: u.x, y: u.y, targetId: target.id, sourceId: u.id, sourceElement: u.element });
      } else {
        this.pending.push({ targetId: target.id, sourceId: u.id, atk: u.atk, element: u.element, side: u.side, splash: false });
      }
    }
    this.separate(u);
  }

  private tickStatus(u: FieldUnit) {
    if (u.chill > 0) u.chill = Math.max(0, u.chill - DT);
    if (u.regen && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.regen * DT);
    if (u.burn > 0) {
      u.burnTimer -= DT;
      if (u.burnTimer <= 0) {
        u.burnTimer = BURN_TICK;
        const dmg = u.burn;
        // Burns fade one stack every other tick, so each stack lasts ~2 ticks.
        u.burnFade = !u.burnFade;
        if (u.burnFade) u.burn--;
        this.damage(u, dmg, { ability: true, burn: true });
      }
    }
  }

  private tickTimers(u: FieldUnit) {
    const abilities = getDef(u.defId).abilities;
    const speed = this.traits[u.side].mystic >= 2 ? 1.25 : 1;
    abilities.forEach((ab, i) => {
      if (ab.trigger !== 'timer' || !ab.every) return;
      u.timers[i] += DT * speed;
      if (u.timers[i] >= ab.every && u.alive) {
        u.timers[i] = 0;
        this.fire(u, ab);
      }
    });
  }

  /**
   * Pick a target: close, in the same row, and not already swarmed.
   * Ranged units only care about distance and row; melee also avoid crowded targets.
   */
  private chooseTarget(u: FieldUnit): FieldUnit | undefined {
    let best: FieldUnit | undefined;
    let bestCost = Infinity;
    for (const o of this.units) {
      if (!o.alive || o.side === u.side) continue;
      const dx = o.px - u.px;
      const dy = o.py - u.py;
      let cost = dx * dx + LANE_WEIGHT * dy * dy;
      if (!u.ranged) {
        const n = (this.engaged.get(o.id) ?? 0) - (u.targetId === o.id ? 1 : 0);
        cost += n * CROWD_PENALTY + (n >= MAX_ENGAGE ? CROWD_PENALTY * 4 : 0);
      }
      if (cost < bestCost || (cost === bestCost && best && o.id < best.id)) {
        bestCost = cost;
        best = o;
      }
    }
    return best;
  }

  /** Bodies don't overlap: push apart from allies, and harder from enemies (no walking through). */
  private separate(u: FieldUnit) {
    for (const o of this.units) {
      if (o === u || !o.alive) continue;
      const min = o.side === u.side ? SEPARATION : (u.radius + o.radius) * 0.8;
      const dx = u.px - o.px;
      const dy = u.py - o.py;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      const push = (min - d) * (o.side === u.side ? 0.25 : 0.4);
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
        const src = this.byId.get(p.sourceId)!;
        this.pending.push({ targetId: t.id, sourceId: p.sourceId, atk: src.atk, element: p.sourceElement, side: p.side, splash: src.splash });
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
    if (!a || !b) {
      this.result = a ? 'win' : b ? 'lose' : 'draw';
      // Survivors of the winning army trigger their "Battle won" abilities.
      const winner: Side | null = this.result === 'win' ? 0 : this.result === 'lose' ? 1 : null;
      if (winner !== null) for (const u of this.units) if (u.alive && u.side === winner) this.trigger(u, 'battleWon');
    }
    else if (this.time >= TIME_LIMIT) this.result = 'draw';
  }

  // ── Damage ──────────────────────────────────────────────

  /** A normal attack landing: type advantage, crits, synergy on-hit effects. */
  private resolveHit(h: PendingHit) {
    const target = this.byId.get(h.targetId);
    const src = this.byId.get(h.sourceId);
    if (!target?.alive || h.atk <= 0) return;
    const mult = typeMultiplier(h.element, target.element);
    let atk = h.atk * mult;
    // Attackers Chilled by a Cryo (tier 2) army hit softer.
    if (src && src.chill > 0 && src.chillWeaken) atk *= 0.75;
    const crit = !!src && src.crit > 0 && this.rng.next() < src.crit;
    if (crit) atk *= 2;
    const dmg = Math.max(1, Math.round(atk));
    const tr = this.traits[h.side];
    this.damage(target, dmg, { eff: mult > 1 ? 'super' : mult < 1 ? 'weak' : undefined, crit, source: src });
    // Element on-hit synergies
    if (h.element === 'plasma' && tr.plasma) this.applyBurn(target, tr.plasma, h.side);
    if (h.element === 'cryo' && tr.cryo) this.applyChill(target, 2, h.side);
    // Gunner splash
    if (h.splash) {
      for (const o of this.around(target, h.side)) this.damage(o, Math.max(1, Math.round(dmg * 0.35)), { source: src });
    }
  }

  private damage(
    target: FieldUnit,
    raw: number,
    opts: { eff?: 'super' | 'weak'; ability?: boolean; crit?: boolean; burn?: boolean; source?: FieldUnit } = {},
  ) {
    if (!target.alive || raw <= 0) return;
    let dmg = raw * target.damageTaken;
    const enemyTraits = this.traits[target.side === 0 ? 1 : 0];
    if (target.burn > 0 && enemyTraits.plasma >= 2) dmg *= 1.25;
    dmg = Math.max(1, Math.round(dmg));
    let toHp = dmg;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, toHp);
      target.shield -= absorbed;
      toHp -= absorbed;
      if (target.shield <= 0) {
        this.events.push({ t: 'shieldBreak', id: target.id });
        if (target.shieldBreakAtk) {
          target.atk += target.shieldBreakAtk;
          target.shieldBreakAtk = 0;
        }
      }
    }
    target.hp -= toHp;
    this.events.push({ t: 'hit', id: target.id, dmg, eff: opts.eff, ability: opts.ability, crit: opts.crit, burn: opts.burn });
    const src = opts.source;
    if (src?.alive && src.lifesteal && toHp > 0) this.heal(src, toHp * src.lifesteal, false);
    if (target.hp <= 0) {
      this.kill(target);
      if (src?.alive) this.trigger(src, 'kill', target);
    } else {
      this.trigger(target, 'hurt', src);
    }
  }

  private kill(u: FieldUnit) {
    u.alive = false;
    u.hp = 0;
    this.events.push({ t: 'death', id: u.id });
    this.trigger(u, 'faint');
    // Allies that feed on deaths. Summoned tokens don't count, to avoid runaway chains.
    if (!u.token) {
      for (const o of this.units) if (o.alive && o.side === u.side && o !== u) this.trigger(o, 'allyFaint', u);
    }
    // Void tier 2: fallen Void creatures rise again as Voidspawn.
    if (u.element === 'void' && !u.token && this.traits[u.side].void >= 2) {
      this.summon(u, 'voidspawn', 2, 3, 1);
    }
    // Commander (Hollow King): fallen creatures may rise again.
    const rise = this.cmd[u.side].voidRiseChance;
    if (rise && !u.token && this.rng.next() < rise) this.summon(u, 'voidspawn', 2, 4, 1);
  }

  private heal(u: FieldUnit, amount: number, show = true) {
    if (!u.alive || amount <= 0) return;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amount);
    if (show && u.hp > before) this.events.push({ t: 'heal', id: u.id, amount: Math.round(u.hp - before) });
  }

  private applyBurn(u: FieldUnit, stacks: number, bySide: Side) {
    if (!u.alive || stacks <= 0) return;
    stacks += this.cmd[bySide].burnBonus ?? 0;
    if (u.burn === 0) {
      u.burnTimer = BURN_TICK;
      u.burnFade = true;
    }
    u.burn = Math.min(12, u.burn + stacks);
    this.events.push({ t: 'status', id: u.id, kind: 'burn' });
  }

  private applyChill(u: FieldUnit, seconds: number, bySide: Side) {
    if (!u.alive) return;
    const cryo = this.traits[bySide].cryo;
    u.chill = Math.max(u.chill, seconds);
    u.chillSlow = Math.max(u.chillSlow, CHILL_SLOW[cryo]);
    if (cryo >= 2) u.chillWeaken = true;
    this.events.push({ t: 'status', id: u.id, kind: 'chill' });
  }

  private summon(src: FieldUnit, token: string, atk: number, hp: number, count: number) {
    const [bAtk, bHp] = SWARM_SUMMON[this.traits[src.side].swarm];
    for (let i = 0; i < count; i++) {
      if (this.aliveCount(src.side) >= MAX_ALIVE_PER_SIDE) return;
      const jx = (this.rng.next() - 0.5) * 24;
      const jy = (this.rng.next() - 0.5) * 24;
      const t = this.spawn(src.side, token, 1, src.squad, src.x + jx, src.y + jy, atk + bAtk, hp + bHp);
      this.events.push({ t: 'spawn', id: t.id });
    }
  }

  // ── Abilities ───────────────────────────────────────────

  private trigger(u: FieldUnit, kind: Trigger, other?: FieldUnit) {
    for (const ab of getDef(u.defId).abilities) if (ab.trigger === kind) this.fire(u, ab, other);
  }

  private fire(u: FieldUnit, ab: Ability, other?: FieldUnit) {
    if (this.depth > 6) return; // guard against long hurt -> hurt chains
    // A rebirth ability (and everything bundled with it) only ever fires once.
    if (u.reborn && ab.effects.some((e) => e.kind === 'rebirth')) return;
    this.depth++;
    this.events.push({ t: 'ability', id: u.id });
    for (const e of ab.effects) this.apply(u, e, other);
    this.depth--;
  }

  private around(center: FieldUnit, attackerSide: Side): FieldUnit[] {
    return this.units.filter(
      (o) => o.alive && o.side !== attackerSide && o !== center && (o.x - center.x) ** 2 + (o.y - center.y) ** 2 <= AROUND_RADIUS ** 2,
    );
  }

  private pickRandom<T>(arr: T[], n: number): T[] {
    const pool = [...arr];
    const out: T[] = [];
    while (pool.length && out.length < n) out.push(pool.splice(this.rng.int(pool.length), 1)[0]);
    return out;
  }

  private targets(src: FieldUnit, to: Target, other: FieldUnit | undefined, count = 1): FieldUnit[] {
    const enemies = () => this.units.filter((o) => o.alive && o.side !== src.side);
    const allies = () => this.units.filter((o) => o.alive && o.side === src.side);
    switch (to) {
      case 'self':
        return src.alive ? [src] : [];
      case 'target':
        return other?.alive ? [other] : [];
      case 'aroundTarget':
        return other ? this.around(other, src.side) : [];
      case 'aroundSelf':
        return this.around(src, src.side);
      case 'nearestEnemy': {
        const e = this.nearestEnemy(src);
        return e ? [e] : [];
      }
      case 'randomEnemy':
        return this.pickRandom(enemies(), count);
      case 'lowestEnemy':
        return enemies()
          .sort((a, b) => a.hp - b.hp || a.id - b.id)
          .slice(0, count);
      case 'allEnemies':
        return enemies();
      case 'randomAlly':
        return this.pickRandom(
          allies().filter((o) => o !== src),
          count,
        );
      case 'lowestAlly':
        return allies()
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)
          .slice(0, count);
      case 'allAllies':
        return allies();
      case 'squad':
        return allies().filter((o) => o !== src && o.squad === src.squad && !o.token);
      case 'adjacent':
        return allies().filter((o) => !o.token && Math.abs(o.squad - src.squad) === 1);
      case 'frontAlly':
        return allies().filter((o) => !o.token && o.squad === 0);
    }
  }

  private apply(src: FieldUnit, effect: Effect, other?: FieldUnit) {
    const lv = src.level;
    const power = MYSTIC_POWER[this.traits[src.side].mystic];
    const amt = (n: number) => Math.round(scaled(n, lv) * power);
    switch (effect.kind) {
      case 'damage':
        for (const t of this.targets(src, effect.to, other, effect.count)) this.damage(t, amt(effect.amount), { ability: true, source: src });
        break;
      case 'burn':
        for (const t of this.targets(src, effect.to, other, effect.count)) this.applyBurn(t, amt(effect.stacks), src.side);
        break;
      case 'chill':
        for (const t of this.targets(src, effect.to, other, effect.count)) this.applyChill(t, effect.seconds, src.side);
        break;
      case 'shield':
        for (const t of this.targets(src, effect.to, other, effect.count)) {
          if (effect.element && t.element !== effect.element) continue;
          t.shield += amt(effect.amount);
          this.events.push({ t: 'shield', id: t.id, amount: amt(effect.amount) });
        }
        break;
      case 'heal':
        for (const t of this.targets(src, effect.to, other, effect.count)) this.heal(t, amt(effect.amount));
        break;
      case 'buff':
        for (const t of this.targets(src, effect.to, other, effect.count)) {
          if (effect.element && t.element !== effect.element) continue;
          // Debuffs (negative numbers) aren't amplified by Mystic power.
          const a = effect.atk < 0 ? scaled(effect.atk, lv) : amt(effect.atk);
          const h = amt(effect.hp);
          const before = t.atk;
          t.atk = Math.max(0, t.atk + a);
          t.hp += h;
          t.maxHp += h;
          this.events.push({ t: 'buff', id: t.id, dAtk: t.atk - before, dHp: h });
        }
        break;
      case 'summon':
        this.summon(src, effect.token, scaled(effect.atk, lv), scaled(effect.hp, lv), effect.count ?? 1);
        break;
      case 'rebirth': {
        if (src.reborn || src.alive) break;
        const r = this.spawn(src.side, src.defId, src.level, src.squad, src.x, src.y, src.atk, Math.max(1, Math.round(src.maxHp * effect.hpPct)));
        r.reborn = true;
        this.events.push({ t: 'spawn', id: r.id });
        break;
      }
      case 'grow': {
        // Permanent growth for this creature's squad, capped per battle.
        if (src.token) break;
        const g = this.growth[src.side].get(src.squad) ?? { atk: 0, hp: 0, times: 0 };
        if (g.times >= GROW_CAP) break;
        g.times++;
        g.atk += scaled(effect.atk, lv);
        g.hp += scaled(effect.hp, lv);
        this.growth[src.side].set(src.squad, g);
        this.events.push({ t: 'grow', id: src.id, atk: scaled(effect.atk, lv), hp: scaled(effect.hp, lv) });
        break;
      }
      case 'gold':
        break; // shop-only
    }
  }
}
