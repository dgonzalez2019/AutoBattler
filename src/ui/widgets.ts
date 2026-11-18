import Phaser from 'phaser';
import { COLORS, FONT_BODY, FONT_DISPLAY, H, W } from './theme';
import { BLEED } from './viewport';

export function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));
}

export function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
}

/** Deep-space backdrop: gradient, nebula glow and twinkling stars. */
export function drawBackground(scene: Phaser.Scene, seed = 1) {
  const g = scene.add.graphics().setDepth(-100);
  g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bgBottom, COLORS.bgBottom, 1);
  g.fillRect(-BLEED, 0, W + BLEED * 2, H);
  const rnd = new Phaser.Math.RandomDataGenerator([String(seed)]);
  const nebulas = [0x7b2cbf, 0x4cc9f0, 0xff6a3d];
  for (let i = 0; i < 9; i++) {
    g.fillStyle(nebulas[i % 3], 0.05);
    g.fillCircle(rnd.between(-BLEED / 2, W + BLEED / 2), rnd.between(0, H), rnd.between(120, 300));
  }
  for (let i = 0; i < 260; i++) {
    const star = scene.add
      .circle(rnd.between(-BLEED, W + BLEED), rnd.between(0, H), rnd.realInRange(0.6, 1.8), 0xffffff, rnd.realInRange(0.3, 0.9))
      .setDepth(-99);
    if (i % 4 === 0) {
      scene.tweens.add({ targets: star, alpha: 0.1, duration: rnd.between(900, 2600), yoyo: true, repeat: -1 });
    }
  }
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.85) {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.panel, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
  g.lineStyle(2, COLORS.panelStroke, 0.9).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
  return g;
}

export interface Button extends Phaser.GameObjects.Container {
  setEnabled(on: boolean): Button;
  setLabel(text: string): Button;
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  color: number,
  onClick: () => void,
): Button {
  const c = scene.add.container(x, y) as Button;
  const bg = scene.add.graphics();
  const draw = (fill: number, alpha: number) => {
    bg.clear();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 14);
    bg.fillStyle(fill, alpha).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    bg.fillStyle(0xffffff, 0.15 * alpha).fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, h / 2 - 3, 10);
  };
  const text = scene.add
    .text(0, 0, label, { fontFamily: FONT_DISPLAY, fontSize: '22px', color: '#ffffff' })
    .setOrigin(0.5)
    .setShadow(0, 2, '#000000', 3);
  c.add([bg, text]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  let enabled = true;
  draw(color, 1);
  c.on('pointerover', () => enabled && draw(Phaser.Display.Color.ValueToColor(color).brighten(15).color, 1));
  c.on('pointerout', () => draw(color, enabled ? 1 : 0.35));
  c.on('pointerdown', () => {
    if (!enabled) return;
    scene.tweens.add({ targets: c, scale: 0.94, duration: 60, yoyo: true });
    onClick();
  });
  c.setEnabled = (on: boolean) => {
    enabled = on;
    draw(color, on ? 1 : 0.35);
    text.setAlpha(on ? 1 : 0.5);
    return c;
  };
  c.setLabel = (t: string) => {
    text.setText(t);
    return c;
  };
  return c;
}

/** Floating text that rises and fades (damage numbers, buffs, notices). */
export function floatText(scene: Phaser.Scene, x: number, y: number, msg: string, color: string, size = 30) {
  const t = scene.add
    .text(x, y, msg, { fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color, stroke: '#000000', strokeThickness: 6 })
    .setOrigin(0.5)
    .setDepth(50);
  scene.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
}

export function toast(scene: Phaser.Scene, msg: string) {
  const t = scene.add
    .text(W / 2, H / 2 - 40, msg, {
      fontFamily: FONT_BODY,
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 18, y: 10 },
    })
    .setOrigin(0.5)
    .setDepth(100);
  scene.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() });
}
