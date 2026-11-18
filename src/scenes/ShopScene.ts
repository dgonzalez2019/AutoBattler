import Phaser from 'phaser';
import { abilityText, getDef } from '../data/creatures';
import { ELEMENT_INFO, ELEMENTS } from '../data/elements';
import { generateOpponent } from '../game/ai';
import { REROLL_COST, Run, UNIT_COST, WINS_TO_VICTORY } from '../game/run';
import { MAX_TEAM } from '../sim/battle';
import { CreatureView } from '../ui/CreatureView';
import { COLORS, FONT_BODY, FONT_DISPLAY } from '../ui/theme';
import { button, drawBackground, panel, toast, type Button } from '../ui/widgets';

type Selection = { kind: 'shop' | 'team'; index: number } | null;

const SLOT_W = 136;
const SLOT_H = 168;
const TEAM_Y = 285;
const SHOP_Y = 545;
const INFO_X = 1110;

const teamX = (i: number) => 880 - i * 150;
const shopX = (i: number, n: number) => 580 - ((n - 1) * 150) / 2 + i * 150;

export class ShopScene extends Phaser.Scene {
  private run!: Run;
  private selected: Selection = null;
  private dyn!: Phaser.GameObjects.Container;
  private hud!: Record<'gold' | 'lives' | 'wins' | 'round', Phaser.GameObjects.Text>;
  private info!: Phaser.GameObjects.Container;
  private btn!: Record<'reroll' | 'freeze' | 'sell' | 'end', Button>;

  constructor() {
    super('Shop');
  }

  create() {
    this.run = this.registry.get('run');
    this.selected = null;
    drawBackground(this, this.run.round);

    // HUD
    this.hud = {
      gold: this.hudPill(150, 'GOLD', COLORS.gold),
      lives: this.hudPill(390, 'LIVES', COLORS.health),
      wins: this.hudPill(630, 'WINS', COLORS.good),
      round: this.hudPill(870, 'ROUND', COLORS.highlight),
    };

    // Section labels
    this.label(280, 172, 'YOUR TEAM');
    this.label(960, 172, 'FRONT').setOrigin(1, 0.5).setColor('#ffd166');
    this.label(shopX(0, 4) - SLOT_W / 2, 432, 'SHOP');

    panel(this, INFO_X, 380, 300, 470);
    this.info = this.add.container(INFO_X, 160);

    // Buttons
    this.btn = {
      reroll: button(this, 180, 672, 200, 60, `Reroll  ${REROLL_COST}g`, 0x3a86ff, () => this.onReroll()),
      freeze: button(this, 400, 672, 200, 60, 'Freeze', 0x4cc9f0, () => this.onFreeze()),
      sell: button(this, 620, 672, 200, 60, 'Sell', 0xef476f, () => this.onSell()),
      end: button(this, INFO_X, 672, 280, 64, 'BATTLE!', 0x06d6a0, () => this.onEndTurn()),
    };

    this.dyn = this.add.container(0, 0);
    this.input.dragDistanceThreshold = 10;
    this.refresh();

    if (this.run.lastResult) {
      const msg = { win: 'Victory!', lose: 'Defeat...', draw: 'Draw' }[this.run.lastResult];
      toast(this, `${msg}  Round ${this.run.round} begins`);
    }
  }

  private hudPill(x: number, name: string, color: number) {
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.9).fillRoundedRect(x - 105, 22, 210, 52, 26);
    g.lineStyle(2, color, 0.9).strokeRoundedRect(x - 105, 22, 210, 52, 26);
    g.fillStyle(color).fillCircle(x - 78, 48, 13);
    this.add.text(x - 56, 48, name, { fontFamily: FONT_BODY, fontSize: '16px', fontStyle: 'bold', color: COLORS.textDim }).setOrigin(0, 0.5);
    return this.add.text(x + 85, 48, '', { fontFamily: FONT_DISPLAY, fontSize: '26px', color: '#ffffff' }).setOrigin(1, 0.5);
  }

  private label(x: number, y: number, text: string) {
    return this.add
      .text(x, y, text, { fontFamily: FONT_DISPLAY, fontSize: '20px', color: COLORS.textDim })
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);
  }

  // ── Rendering ────────────────────────────────────────────

  private refresh() {
    const run = this.run;
    this.dyn.removeAll(true);

    this.hud.gold.setText(String(run.gold));
    this.hud.lives.setText(String(run.lives));
    this.hud.wins.setText(`${run.wins}/${WINS_TO_VICTORY}`);
    this.hud.round.setText(String(run.round));

    // Team slots
    for (let i = 0; i < MAX_TEAM; i++) {
      const x = teamX(i);
      const sel = this.selected;
      const isSel = sel?.kind === 'team' && sel.index === i;
      const isTarget =
        (sel?.kind === 'shop' && run.canPlace(sel.index, i)) ||
        (sel?.kind === 'team' && sel.index !== i);
      this.dyn.add(this.slotGraphic(x, TEAM_Y, isSel, isTarget));
      const zone = this.add.zone(x, TEAM_Y, SLOT_W, SLOT_H).setInteractive();
      zone.on('pointerup', () => this.onTapTeam(i));
      this.dyn.add(zone);
      const unit = run.team[i];
      if (unit) this.dyn.add(this.makeView(x, TEAM_Y, unit, { kind: 'team', index: i }));
    }

    // Shop slots
    const n = run.shop.length;
    for (let i = 0; i < n; i++) {
      const x = shopX(i, n);
      const slot = run.shop[i];
      const isSel = this.selected?.kind === 'shop' && this.selected.index === i;
      this.dyn.add(this.slotGraphic(x, SHOP_Y, isSel, false, slot?.frozen));
      if (!slot) continue;
      this.dyn.add(this.makeView(x, SHOP_Y, slot.unit, { kind: 'shop', index: i }));
      // Price tag
      const tag = this.add.graphics();
      tag.fillStyle(COLORS.gold).fillCircle(x - SLOT_W / 2 + 18, SHOP_Y - SLOT_H / 2 + 18, 15);
      tag.lineStyle(2, 0x000000, 0.5).strokeCircle(x - SLOT_W / 2 + 18, SHOP_Y - SLOT_H / 2 + 18, 15);
      const price = this.add
        .text(x - SLOT_W / 2 + 18, SHOP_Y - SLOT_H / 2 + 18, String(UNIT_COST), { fontFamily: FONT_DISPLAY, fontSize: '18px', color: '#3a2a00' })
        .setOrigin(0.5);
      this.dyn.add([tag, price]);
      if (slot.frozen) {
        const f = this.add
          .text(x + SLOT_W / 2 - 10, SHOP_Y - SLOT_H / 2 + 16, 'FROZEN', { fontFamily: FONT_BODY, fontSize: '13px', fontStyle: 'bold', color: '#e0fbfc' })
          .setOrigin(1, 0.5);
        this.dyn.add(f);
      }
    }

    // Buttons
    const sel = this.selected;
    this.btn.reroll.setEnabled(run.gold >= REROLL_COST);
    this.btn.freeze.setEnabled(sel?.kind === 'shop');
    this.btn.freeze.setLabel(sel?.kind === 'shop' && run.shop[sel.index]?.frozen ? 'Unfreeze' : 'Freeze');
    this.btn.sell.setEnabled(sel?.kind === 'team');
    this.btn.sell.setLabel(sel?.kind === 'team' ? `Sell  +${run.team[sel.index]?.level ?? 1}g` : 'Sell');

    this.renderInfo();
  }

  private slotGraphic(x: number, y: number, selected: boolean, target: boolean, frozen = false) {
    const g = this.add.graphics();
    const stroke = selected ? COLORS.gold : target ? COLORS.good : COLORS.panelStroke;
    g.fillStyle(frozen ? 0x1d4e6b : COLORS.panelLight, frozen ? 0.75 : 0.45).fillRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 18);
    g.lineStyle(selected || target ? 4 : 2, stroke, selected || target ? 1 : 0.6).strokeRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 18);
    return g;
  }

  private makeView(x: number, y: number, unit: { defId: string; atk: number; hp: number; level: number; xp: number }, sel: NonNullable<Selection>) {
    const v = new CreatureView(this, x, y - 8, unit, 118);
    v.setInteractive({ draggable: true, useHandCursor: true });
    let dragged = false;
    v.on('dragstart', () => {
      dragged = true;
      this.selected = sel;
      v.setDepth(20);
      this.dyn.bringToTop(v);
      v.setScale(1.1);
    });
    v.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => v.setPosition(dx, dy));
    v.on('dragend', (p: Phaser.Input.Pointer) => this.onDrop(sel, p.x, p.y));
    v.on('pointerup', () => {
      if (dragged) return;
      if (sel.kind === 'shop') this.onTapShop(sel.index);
      else this.onTapTeam(sel.index);
    });
    return v;
  }

  private renderInfo() {
    this.info.removeAll(true);
    const sel = this.selected;
    const unit = sel ? (sel.kind === 'shop' ? this.run.shop[sel.index]?.unit : this.run.team[sel.index]) : null;
    const style = (size: number, color = COLORS.text, bold = false) => ({
      fontFamily: FONT_BODY,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      wordWrap: { width: 250 },
      align: 'center' as const,
    });

    if (!unit) {
      this.info.add([
        this.add.text(0, 0, 'HOW TO PLAY', { fontFamily: FONT_DISPLAY, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5, 0),
        this.add
          .text(0, 44, 'Tap or drag a creature from the shop onto your team. Drop a duplicate onto its twin to level it up.\n\nYour front creature fights first.', style(16, COLORS.textDim))
          .setOrigin(0.5, 0)
          .setLineSpacing(4),
        this.add.text(0, 230, 'TYPE WHEEL', { fontFamily: FONT_DISPLAY, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5, 0),
        this.add.text(0, 258, 'super effective = x1.5 damage', style(14, COLORS.textDim)).setOrigin(0.5, 0),
      ]);
      ELEMENTS.forEach((el, i) => {
        const a = ELEMENT_INFO[el];
        const b = ELEMENT_INFO[ELEMENTS[(i + 1) % ELEMENTS.length]];
        const y = 292 + i * 26;
        this.info.add([
          this.add.circle(-98, y + 9, 7, a.color),
          this.add.text(-86, y, a.name, style(16, '#ffffff', true)).setOrigin(0, 0),
          this.add.text(0, y + 1, 'beats', style(14, COLORS.textDim)).setOrigin(0.5, 0),
          this.add.circle(36, y + 9, 7, b.color),
          this.add.text(48, y, b.name, style(16, '#ffffff', true)).setOrigin(0, 0),
        ]);
      });
      return;
    }

    const def = getDef(unit.defId);
    const el = ELEMENT_INFO[def.element];
    const hex = '#' + el.color.toString(16).padStart(6, '0');
    this.info.add([
      this.add.text(0, 0, def.name.toUpperCase(), { fontFamily: FONT_DISPLAY, fontSize: '28px', color: hex }).setOrigin(0.5, 0),
      this.add.text(0, 40, `${el.name}  ·  Tier ${def.tier}  ·  Level ${unit.level}`, style(16, COLORS.textDim, true)).setOrigin(0.5, 0),
      this.add.text(0, 76, `${unit.atk} ATTACK   ${unit.hp} HEALTH`, style(18, '#ffffff', true)).setOrigin(0.5, 0),
      this.add.text(0, 120, abilityText(def, unit.level) || 'No ability.', style(18)).setOrigin(0.5, 0).setLineSpacing(4),
      this.add.text(0, 220, `"${def.look}"`, { ...style(14, COLORS.textDim), fontStyle: 'italic' }).setOrigin(0.5, 0),
    ]);
    if (sel?.kind === 'shop') {
      this.info.add(this.add.text(0, 300, 'Tap a team slot to buy', style(15, '#ffd166', true)).setOrigin(0.5, 0));
    } else {
      this.info.add(this.add.text(0, 300, 'Tap another slot to move or merge', style(15, '#ffd166', true)).setOrigin(0.5, 0));
    }
  }

  // ── Input ────────────────────────────────────────────────

  private onTapShop(i: number) {
    const s = this.selected;
    this.selected = s?.kind === 'shop' && s.index === i ? null : { kind: 'shop', index: i };
    this.refresh();
  }

  private onTapTeam(i: number) {
    const s = this.selected;
    if (s?.kind === 'shop') {
      this.tryBuy(s.index, i);
    } else if (s?.kind === 'team') {
      if (s.index === i) this.selected = null;
      else {
        this.run.move(s.index, i);
        this.selected = null;
      }
    } else if (this.run.team[i]) {
      this.selected = { kind: 'team', index: i };
    }
    this.refresh();
  }

  private onDrop(sel: NonNullable<Selection>, x: number, y: number) {
    const teamIdx = this.slotAt(x, y);
    if (teamIdx !== null) {
      if (sel.kind === 'shop') this.tryBuy(sel.index, teamIdx);
      else if (teamIdx !== sel.index) {
        this.run.move(sel.index, teamIdx);
        this.selected = null;
      }
    } else if (sel.kind === 'team' && this.btn.sell.getBounds().contains(x, y)) {
      this.run.sell(sel.index);
      this.selected = null;
    }
    this.refresh();
  }

  private slotAt(x: number, y: number): number | null {
    for (let i = 0; i < MAX_TEAM; i++) {
      if (Math.abs(x - teamX(i)) < SLOT_W / 2 + 6 && Math.abs(y - TEAM_Y) < SLOT_H / 2 + 20) return i;
    }
    return null;
  }

  private tryBuy(shopIdx: number, teamIdx: number) {
    if (this.run.gold < UNIT_COST) {
      toast(this, 'Not enough gold');
      return;
    }
    if (!this.run.buy(shopIdx, teamIdx)) {
      toast(this, 'That slot is taken');
      return;
    }
    this.selected = null;
  }

  private onReroll() {
    this.run.reroll();
    if (this.selected?.kind === 'shop') this.selected = null;
    this.refresh();
  }

  private onFreeze() {
    if (this.selected?.kind !== 'shop') return;
    this.run.toggleFreeze(this.selected.index);
    this.refresh();
  }

  private onSell() {
    if (this.selected?.kind !== 'team') return;
    this.run.sell(this.selected.index);
    this.selected = null;
    this.refresh();
  }

  private onEndTurn() {
    if (!this.run.team.some(Boolean)) {
      toast(this, 'Add a creature to your team first');
      return;
    }
    const player = this.run.endTurn();
    const enemy = generateOpponent(this.run.round, this.run.battleSeed());
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Battle', { player, enemy, seed: this.run.battleSeed() });
    });
  }
}
