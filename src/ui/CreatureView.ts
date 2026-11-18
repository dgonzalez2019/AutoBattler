import Phaser from 'phaser';
import { artScale, creatureKey } from '../art/creatureArt';
import { getDef } from '../data/creatures';
import { ELEMENT_INFO } from '../data/elements';
import { COLORS, FONT_DISPLAY } from './theme';

export interface CreatureViewData {
  defId: string;
  atk: number;
  hp: number;
  level: number;
  xp?: number;
}

/** A creature on screen: art, idle bob, attack/health badges and level pips. */
export class CreatureView extends Phaser.GameObjects.Container {
  readonly art: Phaser.GameObjects.Image;
  private atkText: Phaser.GameObjects.Text;
  private hpText: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Graphics;
  private ring: Phaser.GameObjects.Graphics;
  data_: CreatureViewData;

  constructor(scene: Phaser.Scene, x: number, y: number, data: CreatureViewData, size = 130, flip = false) {
    super(scene, x, y);
    this.data_ = { ...data };
    const def = getDef(data.defId);
    const color = ELEMENT_INFO[def.element].color;

    this.ring = scene.add.graphics();
    this.ring.fillStyle(color, 0.18).fillEllipse(0, size * 0.36, size * 0.9, size * 0.22);

    const scale = artScale(scene, def.id, size);
    this.art = scene.add.image(0, 0, creatureKey(def.id)).setScale(scale).setFlipX(flip);
    // Gentle idle bob so the board feels alive.
    scene.tweens.add({
      targets: this.art,
      y: -4,
      scaleY: scale * 1.03,
      duration: 900 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const by = size * 0.5;
    const atkBadge = this.badge(-size * 0.24, by, COLORS.attack, 'atk');
    const hpBadge = this.badge(size * 0.24, by, COLORS.health, 'hp');
    this.atkText = this.badgeText(-size * 0.24, by);
    this.hpText = this.badgeText(size * 0.24, by);

    this.pips = scene.add.graphics();
    this.add([this.ring, this.art, atkBadge, hpBadge, this.atkText, this.hpText, this.pips]);
    this.setSize(size, size * 1.2);
    this.update_(data);
    scene.add.existing(this);
  }

  private badge(x: number, y: number, color: number, kind: 'atk' | 'hp') {
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.4).fillCircle(x, y + 3, 19);
    g.fillStyle(color).fillCircle(x, y, 19);
    g.lineStyle(3, 0xffffff, 0.85).strokeCircle(x, y, 19);
    // Tiny icon above the badge: blade for attack, heart for health.
    g.fillStyle(0xffffff, 0.9);
    if (kind === 'atk') {
      g.fillTriangle(x - 3, y - 22, x + 3, y - 22, x, y - 32);
    } else {
      g.fillCircle(x - 3, y - 27, 4).fillCircle(x + 3, y - 27, 4).fillTriangle(x - 7, y - 26, x + 7, y - 26, x, y - 19);
    }
    return g;
  }

  private badgeText(x: number, y: number) {
    return this.scene.add
      .text(x, y, '', { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5);
  }

  update_(data: Partial<CreatureViewData>) {
    Object.assign(this.data_, data);
    this.atkText.setText(String(this.data_.atk));
    this.hpText.setText(String(Math.max(0, this.data_.hp)));
    this.drawPips();
  }

  private drawPips() {
    const { level, xp } = this.data_;
    const g = this.pips.clear();
    const y = -this.height * 0.48;
    // Level stars
    for (let i = 0; i < level; i++) {
      const x = (i - (level - 1) / 2) * 18;
      g.fillStyle(COLORS.gold).fillPoints(star(x, y, 8, 3.5), true);
      g.lineStyle(2, 0x000000, 0.6).strokePoints(star(x, y, 8, 3.5), true);
    }
    // XP bar toward the next level
    if (xp !== undefined && level < 3) {
      const need = level === 1 ? 2 : 3;
      const have = level === 1 ? xp : xp - 2;
      for (let i = 0; i < need; i++) {
        const x = (i - (need - 1) / 2) * 14;
        g.fillStyle(i < have ? COLORS.good : 0x000000, i < have ? 1 : 0.4).fillRoundedRect(x - 5, y + 12, 10, 5, 2);
      }
    }
  }

  pulse(color: number) {
    const ring = this.scene.add.circle(this.x, this.y, 40, color, 0).setStrokeStyle(5, color, 0.9).setDepth(40);
    this.scene.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    return this.scene.tweens.add({ targets: this, scale: 1.15, duration: 120, yoyo: true });
  }
}

function star(cx: number, cy: number, r1: number, r2: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}
