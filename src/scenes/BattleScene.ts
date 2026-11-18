import Phaser from 'phaser';
import { BLEED, fitCamera } from '../ui/viewport';
import { artScale, creatureKey } from '../art/creatureArt';
import { getDef } from '../data/creatures';
import { ELEMENT_INFO } from '../data/elements';
import { TRAITS } from '../data/traits';
import { ALL_TRAITS } from '../game/synergy';
import type { ArmySnapshot } from '../game/army';
import type { OpponentKind } from '../game/matchmaking';
import type { Run } from '../game/run';
import { DT, FIELD_H, FIELD_W, FieldBattle, type BattleResult, type FieldEvent, type FieldUnit } from '../sim/field';
import { COLORS, FONT_BODY, FONT_DISPLAY, H, W } from '../ui/theme';
import { button, drawBackground, floatText, type Button } from '../ui/widgets';

interface BattleInit {
  player: ArmySnapshot;
  enemy: ArmySnapshot;
  kind?: OpponentKind;
  seed: number;
}

const KIND_LABEL: Record<OpponentKind, string> = {
  online: 'ONLINE PLAYER',
  ghost: 'YOUR PAST ARMY',
  ai: 'AI COMMANDER',
};

const OX = (W - FIELD_W) / 2;
const OY = 168;
/** Pseudo-3D: units lower on the field (closer to the camera) draw bigger. */
const persp = (y: number) => 0.84 + 0.32 * (y / FIELD_H);
const SPEEDS = [1, 2, 4];
const SIDE_COLOR = [0x4cc9f0, 0xef476f];

interface UnitSprite {
  img: Phaser.GameObjects.Image;
  baseScale: number;
  lunge: number;
  lungeX: number;
  lungeY: number;
  /** Game time (ms) until which the hit tint shows. */
  hitUntil: number;
  tint: number | null;
}

/** Renders a FieldBattle in real time. All rules live in the simulator. */
export class BattleScene extends Phaser.Scene {
  private battle!: FieldBattle;
  private sprites = new Map<number, UnitSprite>();
  private shots = new Map<number, Phaser.GameObjects.Arc>();
  private overlay!: Phaser.GameObjects.Graphics;
  /** Shadows and team rings, drawn under the creatures. */
  private ground!: Phaser.GameObjects.Graphics;
  private counts!: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private bars!: Phaser.GameObjects.Graphics;
  private startCounts: [number, number] = [1, 1];
  private acc = 0;
  private speedIdx = 0;
  private skipping = false;
  private running = false;
  private finished = false;
  private speedBtn!: Button;

  constructor() {
    super('Battle');
  }

  create(data: BattleInit) {
    this.sprites.clear();
    this.shots.clear();
    this.acc = 0;
    this.skipping = false;
    this.running = false;
    this.finished = false;
    this.speedIdx = Number(this.registry.get('battleSpeed') ?? 0);

    const run: Run = this.registry.get('run');
    drawBackground(this, run.round * 7 + 3);
    fitCamera(this);
    this.cameras.main.fadeIn(250);
    this.drawArena();

    this.battle = new FieldBattle([data.player, data.enemy], data.seed);
    this.startCounts = [Math.max(1, this.battle.aliveCount(0)), Math.max(1, this.battle.aliveCount(1))];
    for (const u of this.battle.units) this.addSprite(u, false);

    this.overlay = this.add.graphics().setDepth(900);
    this.ground = this.add.graphics().setDepth(-1);
    this.drawHeader(data, run.round);

    this.speedBtn = button(this, W - 210, H - 42, 120, 52, `x${SPEEDS[this.speedIdx]}`, 0x3a86ff, () => {
      this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
      this.registry.set('battleSpeed', this.speedIdx);
      this.speedBtn.setLabel(`x${SPEEDS[this.speedIdx]}`);
    });
    this.speedBtn.setDepth(950);
    button(this, W - 80, H - 42, 120, 52, 'Skip', 0x5c677d, () => (this.skipping = true)).setDepth(950);

    this.intro(data);
  }

  // ── Setup ───────────────────────────────────────────────

  private drawArena() {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0x000000, 0.28).fillRoundedRect(OX - 10, OY - 20, FIELD_W + 20, FIELD_H + 40, 40);
    g.lineStyle(2, COLORS.highlight, 0.2).strokeRoundedRect(OX - 10, OY - 20, FIELD_W + 20, FIELD_H + 40, 40);
    g.lineStyle(1, COLORS.highlight, 0.07);
    for (let x = 0; x <= FIELD_W; x += 60) g.lineBetween(OX + x, OY - 10, OX + x, OY + FIELD_H + 10);
    for (let y = 0; y <= FIELD_H; y += 50) g.lineBetween(OX, OY + y, OX + FIELD_W, OY + y);
    g.lineStyle(3, 0xffffff, 0.08).lineBetween(OX + FIELD_W / 2, OY - 10, OX + FIELD_W / 2, OY + FIELD_H + 10);
  }

  private drawHeader(data: BattleInit, round: number) {
    const run: Run = this.registry.get('run');
    const name = (x: number, text: string, color: string, originX: number) =>
      this.add.text(x, 36, text, { fontFamily: FONT_DISPLAY, fontSize: '24px', color }).setOrigin(originX, 0.5).setDepth(950);
    name(40, data.player.name.toUpperCase(), '#4cc9f0', 0);
    name(W - 40, data.enemy.name.toUpperCase(), '#ef476f', 1);
    this.add
      .text(W / 2, 36, run.endless ? `ROUND ${round}  ·  ENDLESS` : `ROUND ${round}`, { fontFamily: FONT_DISPLAY, fontSize: '26px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(950);
    const countStyle = { fontFamily: FONT_BODY, fontSize: '18px', fontStyle: 'bold', color: '#e8ecff' };
    this.counts = [
      this.add.text(40, 100, '', countStyle).setOrigin(0, 0.5).setDepth(950),
      this.add.text(W - 40, 100, '', countStyle).setOrigin(1, 0.5).setDepth(950),
    ];
    this.bars = this.add.graphics().setDepth(950);
    // Active synergies for each side
    this.battle.traits.forEach((levels, side) => {
      const active = ALL_TRAITS.filter((t) => levels[t] > 0).map((t) => `${TRAITS[t].name} ${levels[t]}`);
      this.add
        .text(side === 0 ? 40 : W - 40, 128, active.join('  ·  ') || 'No synergies', {
          fontFamily: FONT_BODY,
          fontSize: '15px',
          fontStyle: 'bold',
          color: active.length ? '#ffd166' : '#9aa3c7',
        })
        .setOrigin(side === 0 ? 0 : 1, 0.5)
        .setDepth(950);
    });
  }

  private intro(data: BattleInit) {
    const shade = this.add.rectangle(W / 2, H / 2, W + BLEED * 2, H, 0x000000, 0.6).setDepth(980);
    const vs = this.add
      .text(W / 2, H / 2, 'VS', { fontFamily: FONT_DISPLAY, fontSize: '110px', color: '#ffd166', stroke: '#000000', strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(981)
      .setScale(0.2);
    const left = this.add
      .text(-400, H / 2 - 110, data.player.name, { fontFamily: FONT_DISPLAY, fontSize: '40px', color: '#4cc9f0', stroke: '#000000', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(981);
    const right = this.add
      .text(W + 400, H / 2 + 110, data.enemy.name, { fontFamily: FONT_DISPLAY, fontSize: '40px', color: '#ef476f', stroke: '#000000', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(981);
    const kind = data.kind ?? 'ai';
    const tag = this.add
      .text(W / 2, H / 2 + 160, `${KIND_LABEL[kind]}  ·  ${data.enemy.wins} wins  ·  ${data.enemy.lives} lives`, {
        fontFamily: FONT_BODY,
        fontSize: '20px',
        fontStyle: 'bold',
        color: kind === 'online' ? '#06d6a0' : '#9aa3c7',
      })
      .setOrigin(0.5)
      .setDepth(981)
      .setAlpha(0);
    this.tweens.add({ targets: tag, alpha: 1, delay: 250, duration: 250 });
    this.tweens.add({ targets: vs, scale: 1, duration: 350, ease: 'Back.easeOut' });
    this.tweens.add({ targets: left, x: W / 2, duration: 400, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: right, x: W / 2, duration: 400, ease: 'Cubic.easeOut' });
    this.time.delayedCall(1700, () => {
      this.tweens.add({
        targets: [shade, vs, left, right, tag],
        alpha: 0,
        duration: 250,
        onComplete: () => {
          [shade, vs, left, right, tag].forEach((o) => o.destroy());
          this.running = true;
          this.drainEvents(); // start-of-battle abilities
        },
      });
    });
  }

  private addSprite(u: FieldUnit, pop: boolean) {
    const size = u.radius * 4.5;
    const baseScale = artScale(this, u.defId, size * (1 + 0.06 * (u.level - 1)), u.level);
    const img = this.add.image(OX + u.x, OY + u.y, creatureKey(u.defId, u.level)).setScale(baseScale).setFlipX(u.side === 1);
    this.sprites.set(u.id, { img, baseScale, lunge: 0, lungeX: 0, lungeY: 0, hitUntil: 0, tint: null });
    if (pop) {
      img.setScale(0);
      this.tweens.add({ targets: img, scale: baseScale, duration: 250, ease: 'Back.easeOut' });
    }
  }

  // ── Loop ────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.running && !this.finished) {
      const speed = this.skipping ? 60 : SPEEDS[this.speedIdx];
      this.acc += (Math.min(delta, 100) / 1000) * speed;
      let steps = 0;
      while (this.acc >= DT && steps++ < 600) {
        this.battle.step();
        this.drainEvents();
        this.acc -= DT;
        if (this.battle.result) break;
      }
      if (this.battle.result) {
        this.finished = true;
        this.time.delayedCall(this.skipping ? 100 : 700, () => this.showResult(this.battle.result!));
      }
    }
    this.render();
  }

  private render() {
    const alpha = this.finished ? 1 : Math.min(1, this.acc / DT);
    const g = this.overlay.clear();
    const gr = this.ground.clear();
    for (const u of this.battle.units) {
      const s = this.sprites.get(u.id);
      if (!s || !u.alive) continue;
      s.lunge = Math.max(0, s.lunge - 0.12);
      const x = OX + Phaser.Math.Linear(u.px, u.x, alpha) + s.lungeX * s.lunge;
      const y = OY + Phaser.Math.Linear(u.py, u.y, alpha) + s.lungeY * s.lunge;
      const k = persp(u.y);
      s.img.setPosition(x, y).setDepth(y);
      if (!this.tweens.isTweening(s.img)) s.img.setScale(s.baseScale * k);
      // Ground shadow + team ring, under the sprite
      const r = u.radius * k;
      gr.fillStyle(0x000000, 0.35).fillEllipse(x, y + r * 1.25, r * 2.3, r * 0.75);
      if (u.level >= 2 && getDef(u.defId).rarity === 5) {
        const pulse = 0.25 + 0.15 * Math.sin(this.time.now / 250);
        gr.fillStyle(0xffd166, pulse).fillCircle(x, y, r * 1.6);
      }
      gr.lineStyle(2, SIDE_COLOR[u.side], 0.85).strokeEllipse(x, y + r * 1.25, r * 2.5, r * 0.85);
      // Health bar only once damaged, so a fresh army stays clean
      const w = r * 2.2;
      const pct = Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1);
      if (pct < 0.999) {
        g.fillStyle(0x000000, 0.6).fillRect(x - w / 2, y - r * 1.9, w, 4);
        g.fillStyle(SIDE_COLOR[u.side], 1).fillRect(x - w / 2, y - r * 1.9, w * pct, 4);
      }
      if (u.shield > 0) {
        const sp = Math.min(1, u.shield / u.maxHp);
        g.fillStyle(0xe0fbfc, 1).fillRect(x - w / 2, y - r * 1.9 - 4, w * sp, 3);
        g.lineStyle(1.5, 0x9bf6ff, 0.35).strokeCircle(x, y, r * 1.3);
      }
      if (u.burn > 0) {
        const flick = 0.6 + 0.4 * Math.sin(this.time.now / 70 + u.id);
        g.fillStyle(0xff6a3d, flick).fillTriangle(x - 5, y - r * 2.1, x + 5, y - r * 2.1, x, y - r * 2.1 - 10 - u.burn);
        g.fillStyle(0xffd166, flick).fillTriangle(x - 2, y - r * 2.1, x + 2, y - r * 2.1, x, y - r * 2.1 - 5 - u.burn / 2);
      }
      const tint = this.time.now < s.hitUntil ? 0xff7070 : u.chill > 0 ? 0x9bdcff : null;
      if (tint !== s.tint) {
        s.tint = tint;
        if (tint === null) s.img.clearTint();
        else s.img.setTint(tint);
      }
    }

    // Projectiles
    const live = new Set<number>();
    for (const p of this.battle.projectiles) {
      live.add(p.id);
      let dot = this.shots.get(p.id);
      if (!dot) {
        const { accent } = ELEMENT_INFO[p.sourceElement];
        dot = this.add.circle(0, 0, 5, accent).setStrokeStyle(2, 0xffffff, 0.8).setDepth(800);
        this.shots.set(p.id, dot);
      }
      dot.setPosition(OX + p.x, OY + p.y);
    }
    for (const [id, dot] of this.shots) {
      if (!live.has(id)) {
        dot.destroy();
        this.shots.delete(id);
      }
    }

    // Army size bars
    const b = this.bars.clear();
    for (const side of [0, 1] as const) {
      const n = this.battle.aliveCount(side);
      this.counts[side].setText(`${n} units`);
      const pct = n / this.startCounts[side];
      const x = side === 0 ? 40 : W - 40 - 300;
      b.fillStyle(0x000000, 0.5).fillRoundedRect(x, 64, 300, 14, 7);
      if (pct > 0) {
        const wBar = Math.max(14, 300 * Math.min(1, pct));
        b.fillStyle(SIDE_COLOR[side]).fillRoundedRect(side === 0 ? x : x + 300 - wBar, 64, wBar, 14, 7);
      }
    }
  }

  private drainEvents() {
    const events = this.battle.events;
    this.battle.events = [];
    if (this.skipping) {
      // Only keep the bookkeeping events when fast-forwarding.
      for (const e of events) if (e.t === 'death' || e.t === 'spawn') this.handle(e);
      return;
    }
    for (const e of events) this.handle(e);
  }

  private handle(e: FieldEvent) {
    const u = 'id' in e ? this.battle.unit(e.id) : undefined;
    const s = u ? this.sprites.get(u.id) : undefined;
    switch (e.t) {
      case 'spawn':
        if (u) this.addSprite(u, true);
        return;
      case 'attack': {
        const t = this.battle.unit(e.targetId);
        if (!u || !s || !t || u.ranged) return;
        const d = Math.hypot(t.x - u.x, t.y - u.y) || 1;
        s.lungeX = ((t.x - u.x) / d) * 10;
        s.lungeY = ((t.y - u.y) / d) * 10;
        s.lunge = 1;
        return;
      }
      case 'hit': {
        if (!s) return;
        // Brief red tint (applied in render): readable "got hit" without hiding the art.
        if (!e.burn) s.hitUntil = this.time.now + 90;
        if (e.crit) floatText(this, s.img.x, s.img.y - 30, `${e.dmg}!`, '#ff4d6d', 18);
        else if (e.burn) floatText(this, s.img.x, s.img.y - 26, `${e.dmg}`, '#ff8c42', 15);
        else if (e.ability || e.eff === 'super') floatText(this, s.img.x, s.img.y - 26, `-${e.dmg}`, e.eff === 'super' ? '#ffd166' : '#ff5d73', 18);
        return;
      }
      case 'heal':
        if (s && e.amount >= 2) floatText(this, s.img.x, s.img.y - 26, `+${e.amount}`, '#06d6a0', 16);
        return;
      case 'shield':
        if (s) {
          const ring = this.add.circle(s.img.x, s.img.y, u!.radius * 1.4, 0x9bf6ff, 0.25).setStrokeStyle(2, 0xe0fbfc).setDepth(850);
          this.tweens.add({ targets: ring, alpha: 0, scale: 1.3, duration: 400, onComplete: () => ring.destroy() });
        }
        return;
      case 'shieldBreak':
        if (s) this.burst(s.img.x, s.img.y, 0x9bf6ff);
        return;
      case 'status':
        return;
      case 'death': {
        if (!u || !s) return;
        this.burst(s.img.x, s.img.y, ELEMENT_INFO[u.element].color);
        const img = s.img;
        this.sprites.delete(u.id);
        if (this.skipping) {
          img.destroy();
          return;
        }
        this.tweens.add({
          targets: img,
          alpha: 0,
          scale: s.baseScale * 0.4,
          angle: u.side === 0 ? -40 : 40,
          duration: 260,
          onComplete: () => img.destroy(),
        });
        return;
      }
      case 'ability': {
        if (!u || !s) return;
        const ring = this.add
          .circle(s.img.x, s.img.y, u.radius, 0, 0)
          .setStrokeStyle(3, ELEMENT_INFO[u.element].accent, 0.9)
          .setDepth(850);
        this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
        return;
      }
      case 'buff':
        if (s && (e.dAtk > 0 || e.dHp > 0)) {
          this.tweens.add({ targets: s.img, scale: s.baseScale * 1.25, duration: 90, yoyo: true });
        }
        return;
    }
  }

  private burst(x: number, y: number, color: number) {
    if (this.skipping) return;
    for (let i = 0; i < 6; i++) {
      const p = this.add.circle(x, y, Phaser.Math.Between(2, 5), i % 2 ? color : 0xffffff).setDepth(860);
      const a = Math.random() * Math.PI * 2;
      const d = Phaser.Math.Between(14, 36);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0,
        duration: 320,
        onComplete: () => p.destroy(),
      });
    }
  }

  // ── Result ──────────────────────────────────────────────

  private showResult(result: BattleResult) {
    const run: Run = this.registry.get('run');
    const label = { win: 'VICTORY', lose: 'DEFEAT', draw: 'DRAW' }[result];
    const color = { win: '#06d6a0', lose: '#ef476f', draw: '#ffd166' }[result];

    const shade = this.add.rectangle(W / 2, H / 2, W + BLEED * 2, H, 0x000000, 0).setDepth(990);
    this.tweens.add({ targets: shade, fillAlpha: 0.55, duration: 300 });
    const title = this.add
      .text(W / 2, H / 2 - 30, label, { fontFamily: FONT_DISPLAY, fontSize: '96px', color, stroke: '#000000', strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(991)
      .setScale(0.3);
    this.tweens.add({ targets: title, scale: 1, duration: 400, ease: 'Back.easeOut' });
    this.add
      .text(W / 2, H / 2 + 60, 'Tap to continue', { fontFamily: FONT_BODY, fontSize: '24px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(991);

    this.time.delayedCall(500, () => {
      this.input.once('pointerdown', () => {
        run.finishBattle(result);
        this.scene.start(run.status === 'playing' ? 'Shop' : 'GameOver');
      });
    });
  }
}
