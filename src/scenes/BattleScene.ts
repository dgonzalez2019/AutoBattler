import Phaser from 'phaser';
import { getDef } from '../data/creatures';
import { ELEMENT_INFO } from '../data/elements';
import type { Run } from '../game/run';
import { simulateBattle, type BattleEvent, type BattleLog, type BattleUnit, type UnitSpec } from '../sim/battle';
import { CreatureView } from '../ui/CreatureView';
import { COLORS, FONT_BODY, FONT_DISPLAY, H, W } from '../ui/theme';
import { button, drawBackground, floatText, tween, wait } from '../ui/widgets';

interface BattleInit {
  player: UnitSpec[];
  enemy: UnitSpec[];
  seed: number;
}

const ROW_Y = 400;
const GAP = 124;
const SPEEDS = [1, 2, 4];

/** Replays a precomputed battle log as animation. All game logic lives in the sim. */
export class BattleScene extends Phaser.Scene {
  private views = new Map<number, CreatureView>();
  private order: [number[], number[]] = [[], []];
  private sideOf = new Map<number, 0 | 1>();
  private log!: BattleLog;
  private speedIdx = 0;

  constructor() {
    super('Battle');
  }

  create(data: BattleInit) {
    this.views.clear();
    this.sideOf.clear();
    this.order = [[], []];
    this.speedIdx = Number(this.registry.get('battleSpeed') ?? 0);
    this.applySpeed();

    const run: Run = this.registry.get('run');
    drawBackground(this, run.round * 7 + 3);
    this.cameras.main.fadeIn(250);

    // Arena floor
    const floor = this.add.graphics();
    floor.fillStyle(0x000000, 0.25).fillEllipse(W / 2, ROW_Y + 80, 1250, 120);
    floor.lineStyle(2, COLORS.highlight, 0.25).strokeEllipse(W / 2, ROW_Y + 80, 1250, 120);

    this.add.text(40, 40, 'YOU', { fontFamily: FONT_DISPLAY, fontSize: '28px', color: '#4cc9f0' }).setOrigin(0, 0.5);
    this.add.text(W - 40, 40, 'OPPONENT', { fontFamily: FONT_DISPLAY, fontSize: '28px', color: '#ef476f' }).setOrigin(1, 0.5);
    this.add
      .text(W / 2, 40, `ROUND ${run.round}`, { fontFamily: FONT_DISPLAY, fontSize: '28px', color: '#ffffff' })
      .setOrigin(0.5);

    const speedBtn = button(this, W - 210, H - 50, 120, 54, `x${SPEEDS[this.speedIdx]}`, 0x3a86ff, () => {
      this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
      this.registry.set('battleSpeed', this.speedIdx);
      speedBtn.setLabel(`x${SPEEDS[this.speedIdx]}`);
      this.applySpeed();
    });
    button(this, W - 80, H - 50, 120, 54, 'Skip', 0x5c677d, () => {
      this.tweens.timeScale = 30;
      this.time.timeScale = 30;
    });

    this.log = simulateBattle(data.player, data.enemy, data.seed);
    for (const side of [0, 1] as const) {
      this.log.initial[side].forEach((u, i) => this.spawn(u, i, false));
    }
    void this.play();
  }

  private applySpeed() {
    this.tweens.timeScale = SPEEDS[this.speedIdx];
    this.time.timeScale = SPEEDS[this.speedIdx];
  }

  private slotX(side: 0 | 1, index: number) {
    return side === 0 ? W / 2 - 82 - index * GAP : W / 2 + 82 + index * GAP;
  }

  private spawn(u: BattleUnit, index: number, animate: boolean) {
    const v = new CreatureView(this, this.slotX(u.side, index), ROW_Y, u, 140, u.side === 1);
    this.views.set(u.uid, v);
    this.sideOf.set(u.uid, u.side);
    this.order[u.side].splice(index, 0, u.uid);
    if (animate) {
      v.setScale(0);
      this.tweens.add({ targets: v, scale: 1, duration: 300, ease: 'Back.easeOut' });
    }
  }

  private relayout(): Promise<void> {
    const moves: Promise<void>[] = [];
    for (const side of [0, 1] as const) {
      this.order[side].forEach((uid, i) => {
        const v = this.views.get(uid)!;
        const x = this.slotX(side, i);
        if (v.x !== x) moves.push(tween(this, { targets: v, x, duration: 260, ease: 'Cubic.easeOut' }));
      });
    }
    return Promise.all(moves).then(() => undefined);
  }

  private async play() {
    await wait(this, 500);
    for (const e of this.log.events) await this.animate(e);
  }

  private async animate(e: BattleEvent) {
    switch (e.t) {
      case 'ability': {
        const v = this.views.get(e.uid);
        if (!v) return;
        const def = getDef(v.data_.defId);
        v.pulse(ELEMENT_INFO[def.element].color);
        await wait(this, 280);
        return;
      }
      case 'attack': {
        const a = this.views.get(e.a)!;
        const b = this.views.get(e.b)!;
        const ax = a.x;
        const bx = b.x;
        await Promise.all([
          tween(this, { targets: a, x: ax + 55, duration: 150, ease: 'Quad.easeIn' }),
          tween(this, { targets: b, x: bx - 55, duration: 150, ease: 'Quad.easeIn' }),
        ]);
        this.cameras.main.shake(120, 0.006);
        this.impact((ax + bx) / 2, ROW_Y - 10);
        // Damage events right after this show the hit; return to place in parallel.
        this.tweens.add({ targets: a, x: ax, duration: 220, delay: 80, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: b, x: bx, duration: 220, delay: 80, ease: 'Quad.easeOut' });
        return;
      }
      case 'damage': {
        const v = this.views.get(e.uid);
        if (!v) return;
        v.update_({ hp: e.hp });
        v.art.setTintFill(0xffffff);
        this.time.delayedCall(90, () => v.art.clearTint());
        this.tweens.add({ targets: v.art, angle: { from: -6, to: 0 }, duration: 200 });
        floatText(this, v.x, v.y - 70, `-${e.amount}`, '#ff5d73', 34);
        if (e.eff === 'super') floatText(this, v.x, v.y - 110, 'SUPER EFFECTIVE', '#ffd166', 18);
        if (e.eff === 'weak') floatText(this, v.x, v.y - 110, 'resisted', '#9aa3c7', 18);
        await wait(this, 260);
        return;
      }
      case 'stats': {
        const v = this.views.get(e.uid);
        if (!v) return;
        v.update_({ atk: e.atk, hp: e.hp });
        const parts = [];
        if (e.dAtk) parts.push(`${e.dAtk > 0 ? '+' : ''}${e.dAtk} atk`);
        if (e.dHp) parts.push(`${e.dHp > 0 ? '+' : ''}${e.dHp} hp`);
        floatText(this, v.x, v.y - 70, parts.join(' '), e.dAtk < 0 || e.dHp < 0 ? '#ff5d73' : '#06d6a0', 24);
        await wait(this, 300);
        return;
      }
      case 'faint': {
        const v = this.views.get(e.uid);
        if (!v) return;
        const side = this.sideOf.get(e.uid)!;
        this.order[side] = this.order[side].filter((u) => u !== e.uid);
        await tween(this, {
          targets: v,
          alpha: 0,
          y: v.y + 30,
          angle: side === 0 ? -25 : 25,
          scale: 0.6,
          duration: 300,
        });
        v.destroy();
        this.views.delete(e.uid);
        await this.relayout();
        return;
      }
      case 'summon': {
        this.spawn(e.unit, e.index, true);
        await this.relayout();
        await wait(this, 200);
        return;
      }
      case 'end':
        await wait(this, 400);
        this.showResult(e.result);
        return;
    }
  }

  private impact(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const p = this.add.circle(x, y, Phaser.Math.Between(3, 7), Phaser.Utils.Array.GetRandom([0xffffff, 0xffd166, 0xff8c42]));
      const a = Math.random() * Math.PI * 2;
      const d = Phaser.Math.Between(30, 80);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0,
        duration: 350,
        onComplete: () => p.destroy(),
      });
    }
  }

  private showResult(result: BattleLog['result']) {
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
    const run: Run = this.registry.get('run');
    const label = { win: 'VICTORY', lose: 'DEFEAT', draw: 'DRAW' }[result];
    const color = { win: '#06d6a0', lose: '#ef476f', draw: '#ffd166' }[result];

    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(80);
    this.tweens.add({ targets: shade, fillAlpha: 0.55, duration: 300 });
    const title = this.add
      .text(W / 2, H / 2 - 30, label, { fontFamily: FONT_DISPLAY, fontSize: '96px', color, stroke: '#000000', strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(81)
      .setScale(0.3);
    this.tweens.add({ targets: title, scale: 1, duration: 400, ease: 'Back.easeOut' });
    this.add
      .text(W / 2, H / 2 + 60, 'Tap to continue', { fontFamily: FONT_BODY, fontSize: '24px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(81);

    this.time.delayedCall(500, () => {
      this.input.once('pointerdown', () => {
        run.finishBattle(result);
        this.scene.start(run.status === 'playing' ? 'Shop' : 'GameOver');
      });
    });
  }
}
