import Phaser from 'phaser';
import { BLEED, fitCamera } from '../ui/viewport';
import { abilityTexts, CREATURES, getDef } from '../data/creatures';
import { EVOLVE_BONUS, evolves, formName } from '../data/evolutions';
import { ELEMENT_INFO } from '../data/elements';
import { CLASS_INFO, TRAITS, type TraitId } from '../data/traits';
import { ALL_TRAITS, computeTraits } from '../game/synergy';
import { squadCount } from '../game/army';
import { opponents } from '../game/matchmaking';
import { endlessPower, ENDLESS_SCALING_FROM } from '../game/ai';
import { playerName } from '../game/player';
import { MODULES, moduleText } from '../game/mothership';
import { ENDLESS_FINAL_ROUND, INTEREST_PER, MAX_INTEREST, MAX_SQUADS as MAX_TEAM, REROLL_COST, Run, unitCost, WINS_TO_VICTORY } from '../game/run';
import { hexColor, RARITIES, RARITY, sellValue, shopOdds } from '../data/rarity';
import { CreatureView } from '../ui/CreatureView';
import { COLORS, FONT_BODY, FONT_DISPLAY } from '../ui/theme';
import { button, drawBackground, panel, toast, wait, type Button } from '../ui/widgets';
import { commanderBadge } from '../art/commanderArt';
import { artScale, creatureKey } from '../art/creatureArt';

type Selection = { kind: 'shop' | 'team'; index: number } | null;

const SLOT_W = 124;
const SLOT_H = 168;
const TEAM_Y = 285;
const SHOP_Y = 545;
const INFO_X = 1110;

const SYN_X = 18;
const SYN_W = 262;
const teamX = (i: number) => 890 - i * 134;
const shopX = (i: number, n: number) => 628 - ((n - 1) * 134) / 2 + i * 134;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export class ShopScene extends Phaser.Scene {
  private run!: Run;
  private selected: Selection = null;
  private dyn!: Phaser.GameObjects.Container;
  private hud!: Record<'gold' | 'lives' | 'wins' | 'round', Phaser.GameObjects.Text>;
  private info!: Phaser.GameObjects.Container;
  private btn!: Record<'reroll' | 'freeze' | 'sell' | 'end', Button>;
  private ship: Phaser.GameObjects.Container | null = null;
  private syn!: Phaser.GameObjects.Container;
  private trait: TraitId | null = null;
  private showCommander = false;
  private shipBtn!: Button;
  private incomeText!: Phaser.GameObjects.Text;
  /** Creature previewed from a trait's sprite grid. */
  private preview: string | null = null;
  private busy = false;

  constructor() {
    super('Shop');
  }

  create() {
    this.run = this.registry.get('run');
    this.selected = null;
    this.ship = null;
    this.busy = false;
    drawBackground(this, this.run.round);
    fitCamera(this);

    // HUD
    this.hud = {
      gold: this.hudPill(345, 'GOLD', COLORS.gold),
      lives: this.hudPill(510, 'LIVES', COLORS.health),
      wins: this.hudPill(675, 'WINS', COLORS.good),
      round: this.hudPill(840, 'ROUND', COLORS.highlight),
    };

    // Section labels
    this.label(teamX(4) - SLOT_W / 2, 172, 'YOUR ARMY');
    this.label(teamX(0) + SLOT_W / 2, 172, 'FRONT').setOrigin(1, 0.5).setColor('#ffd166');
    this.label(shopX(0, 4) - SLOT_W / 2, 432, 'SHOP');

    panel(this, SYN_X + SYN_W / 2, 375, SYN_W, 490);
    this.syn = this.add.container(0, 0);
    this.trait = null;
    this.showCommander = false;
    this.commanderChip();
    this.incomeText = this.add
      .text(345, 88, '', { fontFamily: FONT_BODY, fontSize: '12px', fontStyle: 'bold', color: '#ffd166' })
      .setOrigin(0.5, 0.5);
    if (this.run.endless) {
      const power = Math.round((endlessPower(this.run.round) - 1) * 100);
      this.add
        .text(
          640,
          118,
          `ENDLESS  ·  Round ${this.run.round} / ${ENDLESS_FINAL_ROUND}  ·  ${this.run.endlessWins} endless wins  ·  ${power > 0 ? `enemy power +${power}%` : `enemies power up from round ${ENDLESS_SCALING_FROM}`}`,
          { fontFamily: FONT_DISPLAY, fontSize: '16px', color: '#e0aaff', backgroundColor: '#3a0ca3', padding: { x: 14, y: 5 } },
        )
        .setOrigin(0.5);
    }

    panel(this, INFO_X, 380, 300, 470);
    this.info = this.add.container(INFO_X, 160);

    // Buttons
    this.btn = {
      reroll: button(this, 180, 672, 200, 60, `Reroll  ${REROLL_COST}g`, 0x3a86ff, () => this.onReroll()),
      freeze: button(this, 400, 672, 200, 60, 'Freeze', 0x4cc9f0, () => this.onFreeze()),
      sell: button(this, 620, 672, 200, 60, 'Sell', 0xef476f, () => this.onSell()),
      end: button(this, INFO_X, 672, 280, 64, 'BATTLE!', 0x06d6a0, () => void this.onEndTurn()),
    };
    this.shipBtn = button(this, INFO_X, 48, 280, 54, 'MOTHERSHIP', 0x7b2cbf, () => this.openMothership());

    this.dyn = this.add.container(0, 0);
    this.input.dragDistanceThreshold = 10;
    this.refresh();

    if (this.run.lastResult) {
      const msg = { win: 'Victory!', lose: 'Defeat...', draw: 'Draw' }[this.run.lastResult];
      const inc = this.run.lastIncome;
      const parts = inc
        ? [`${inc.base} income`, inc.interest && `${inc.interest} interest`, inc.win && `${inc.win} win bonus`, inc.bonus && `${inc.bonus} bonus`].filter(Boolean)
        : [];
      toast(this, `${msg}  Round ${this.run.round}  ·  +${inc?.total ?? 0} gold (${parts.join(' + ')})`);
    }
  }

  private hudPill(x: number, name: string, color: number) {
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.9).fillRoundedRect(x - 78, 22, 156, 52, 26);
    g.lineStyle(2, color, 0.9).strokeRoundedRect(x - 78, 22, 156, 52, 26);
    g.fillStyle(color).fillCircle(x - 54, 48, 11);
    this.add.text(x - 38, 48, name, { fontFamily: FONT_BODY, fontSize: '13px', fontStyle: 'bold', color: COLORS.textDim }).setOrigin(0, 0.5);
    return this.add.text(x + 62, 48, '', { fontFamily: FONT_DISPLAY, fontSize: '24px', color: '#ffffff' }).setOrigin(1, 0.5);
  }

  /** Commander badge (top left): tap to read the passive in the info panel. */
  private commanderChip() {
    const c = this.run.commander;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.9).fillRoundedRect(18, 20, 240, 56, 28);
    g.lineStyle(2, c.color, 0.9).strokeRoundedRect(18, 20, 240, 56, 28);
    commanderBadge(this, 48, 48, c.id, c.color, 50);
    this.add.text(80, 37, c.name, { fontFamily: FONT_DISPLAY, fontSize: '16px', color: hexColor(c.color) }).setOrigin(0, 0.5);
    this.add.text(80, 59, c.title, { fontFamily: FONT_BODY, fontSize: '12px', fontStyle: 'bold', color: COLORS.textDim }).setOrigin(0, 0.5);
    this.add
      .zone(138, 48, 240, 56)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.selected = null;
        this.trait = null;
        this.showCommander = !this.showCommander;
        this.refresh();
      });
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
    const built = Object.values(run.modules).reduce((a, b) => a + b, 0);
    this.shipBtn.setLabel(built ? `MOTHERSHIP  ·  ${built}` : 'MOTHERSHIP');
    // Economy hint: what next turn pays if you stop spending now.
    const next = run.projectedIncome;
    const toNext = INTEREST_PER - (run.gold % INTEREST_PER);
    this.incomeText.setText(
      `Next turn +${next.total}` +
        (next.interest ? `  (interest +${next.interest})` : '') +
        (next.interest < MAX_INTEREST ? `  ·  save ${toNext} more for +1` : '  ·  max interest'),
    );
    this.hud.lives.setText(String(run.lives));
    this.hud.wins.setText(run.endless ? String(run.wins) : `${run.wins}/${WINS_TO_VICTORY}`);
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
      if (unit) {
        this.dyn.add(this.slotGraphic(x, TEAM_Y, isSel, isTarget, false, RARITY[getDef(unit.defId).rarity].color));
        this.dyn.add(this.makeView(x, TEAM_Y, unit, { kind: 'team', index: i }));
        this.dyn.add(this.countPill(x, TEAM_Y, unit.defId, unit.level));
      }
    }

    // Shop slots
    const n = run.shop.length;
    for (let i = 0; i < n; i++) {
      const x = shopX(i, n);
      const slot = run.shop[i];
      const isSel = this.selected?.kind === 'shop' && this.selected.index === i;
      const rarityColor = slot ? RARITY[getDef(slot.unit.defId).rarity].color : undefined;
      this.dyn.add(this.slotGraphic(x, SHOP_Y, isSel, false, slot?.frozen, rarityColor));
      if (!slot) continue;
      this.dyn.add(this.makeView(x, SHOP_Y, slot.unit, { kind: 'shop', index: i }));
      // Price tag
      const tag = this.add.graphics();
      tag.fillStyle(COLORS.gold).fillCircle(x - SLOT_W / 2 + 18, SHOP_Y - SLOT_H / 2 + 18, 15);
      tag.lineStyle(2, 0x000000, 0.5).strokeCircle(x - SLOT_W / 2 + 18, SHOP_Y - SLOT_H / 2 + 18, 15);
      const price = this.add
        .text(x - SLOT_W / 2 + 18, SHOP_Y - SLOT_H / 2 + 18, String(unitCost(slot.unit.defId)), {
          fontFamily: FONT_DISPLAY,
          fontSize: '18px',
          color: run.gold >= unitCost(slot.unit.defId) ? '#3a2a00' : '#b00020',
        })
        .setOrigin(0.5);
      this.dyn.add([tag, price]);
      this.dyn.add(this.countPill(x, SHOP_Y, slot.unit.defId, slot.unit.level));
      if (slot.frozen) {
        const f = this.add
          .text(x, SHOP_Y + SLOT_H / 2 + 12, 'FROZEN', { fontFamily: FONT_BODY, fontSize: '14px', fontStyle: 'bold', color: '#e0fbfc' })
          .setOrigin(0.5);
        this.dyn.add(f);
      }
    }

    // Buttons
    const sel = this.selected;
    this.btn.reroll.setEnabled(run.rerollCost === 0 || run.gold >= REROLL_COST);
    this.btn.reroll.setLabel(run.rerollCost === 0 ? 'Reroll  FREE' : `Reroll  ${REROLL_COST}g`);
    this.btn.freeze.setEnabled(sel?.kind === 'shop');
    this.btn.freeze.setLabel(sel?.kind === 'shop' && run.shop[sel.index]?.frozen ? 'Unfreeze' : 'Freeze');
    this.btn.sell.setEnabled(sel?.kind === 'team');
    const sellUnit = sel?.kind === 'team' ? run.team[sel.index] : null;
    this.btn.sell.setLabel(sellUnit ? `Sell  +${sellValue(getDef(sellUnit.defId).rarity, sellUnit.level)}g` : 'Sell');
    this.renderOdds();

    this.renderSynergies();
    this.renderInfo();
  }

  /** Shop odds for this round, shown next to the SHOP label. */
  private renderOdds() {
    const odds = shopOdds(this.run.round);
    let x = shopX(0, 4) - SLOT_W / 2 + 92;
    for (const r of RARITIES) {
      if (!odds[r - 1]) continue;
      const t = this.add
        .text(x, 432, `${RARITY[r].name} ${odds[r - 1]}%`, { fontFamily: FONT_BODY, fontSize: '13px', fontStyle: 'bold', color: hexColor(RARITY[r].color) })
        .setOrigin(0, 0.5);
      this.dyn.add(t);
      x += t.width + 14;
    }
  }

  /** Active and in-progress synergies, plus a preview of what the selected shop squad would add. */
  private renderSynergies() {
    this.syn.removeAll(true);
    const team = this.run.team.filter((u): u is NonNullable<typeof u> => !!u);
    const now = computeTraits(team);
    const sel = this.selected;
    const preview = sel?.kind === 'shop' && this.run.shop[sel.index] ? computeTraits([...team, this.run.shop[sel.index]!.unit]) : null;

    this.syn.add(
      this.add.text(SYN_X + SYN_W / 2, 146, 'SYNERGIES', { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5),
    );
    const shown = ALL_TRAITS.filter((t) => now.counts[t] > 0 || (preview && preview.counts[t] > 0)).sort(
      (a, b) => now.levels[b] - now.levels[a] || now.counts[b] - now.counts[a],
    );
    if (!shown.length) {
      this.syn.add(
        this.add
          .text(SYN_X + SYN_W / 2, 230, 'Every creature has an element and a class.\n\nField 2 or 3 DIFFERENT creatures that share one to unlock its bonus.', {
            fontFamily: FONT_BODY,
            fontSize: '15px',
            color: COLORS.textDim,
            align: 'center',
            wordWrap: { width: SYN_W - 30 },
          })
          .setOrigin(0.5, 0)
          .setLineSpacing(3),
      );
    }
    shown.slice(0, 9).forEach((t, i) => {
      const def = TRAITS[t];
      const y = 186 + i * 47;
      const count = now.counts[t];
      const level = now.levels[t];
      const gain = preview ? preview.counts[t] - count : 0;
      const g = this.add.graphics();
      const active = level > 0;
      const isSel = this.trait === t;
      g.fillStyle(active ? def.color : COLORS.panelLight, active ? 0.22 : 0.5).fillRoundedRect(SYN_X + 10, y - 19, SYN_W - 20, 40, 10);
      if (isSel || gain) g.lineStyle(2, gain ? COLORS.good : COLORS.gold, 1).strokeRoundedRect(SYN_X + 10, y - 19, SYN_W - 20, 40, 10);
      // Count badge
      g.fillStyle(active ? def.color : 0x2a3263).fillCircle(SYN_X + 32, y + 1, 14);
      const badge = this.add
        .text(SYN_X + 32, y + 1, String(count), { fontFamily: FONT_DISPLAY, fontSize: '16px', color: active ? '#10131f' : '#c8cde8' })
        .setOrigin(0.5);
      const name = this.add
        .text(SYN_X + 54, y - 10, def.name, { fontFamily: FONT_BODY, fontSize: '16px', fontStyle: 'bold', color: active ? '#ffffff' : COLORS.textDim })
        .setOrigin(0, 0);
      const steps = def.thresholds.map((n, k) => (k < level ? `[${n}]` : String(n))).join(' > ');
      const prog = this.add
        .text(SYN_X + 54, y + 8, steps + (gain ? `   +${gain}` : ''), { fontFamily: FONT_BODY, fontSize: '12px', fontStyle: 'bold', color: gain ? '#06d6a0' : COLORS.textDim })
        .setOrigin(0, 0);
      const kind = this.add
        .text(SYN_X + SYN_W - 20, y + 1, def.kind === 'element' ? 'ELEMENT' : 'CLASS', { fontFamily: FONT_BODY, fontSize: '10px', fontStyle: 'bold', color: hex(def.color) })
        .setOrigin(1, 0.5);
      const zone = this.add.zone(SYN_X + SYN_W / 2, y + 1, SYN_W - 20, 40).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => {
        this.trait = this.trait === t ? null : t;
        this.preview = null;
        this.selected = null;
        this.refresh();
      });
      this.syn.add([g, badge, name, prog, kind, zone]);
    });
  }

  /** "x6" pill in the slot corner: how many creatures this squad fields. */
  private countPill(x: number, y: number, defId: string, level: number) {
    const swarm = computeTraits(this.run.team.filter((u): u is NonNullable<typeof u> => !!u)).levels.swarm;
    const n = squadCount(defId, level, this.run.modules.barracks, swarm);
    return this.add
      .text(x + SLOT_W / 2 - 8, y - SLOT_H / 2 + 8, `x${n}`, {
        fontFamily: FONT_DISPLAY,
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#3a0ca3',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(1, 0);
  }

  private slotGraphic(x: number, y: number, selected: boolean, target: boolean, frozen = false, rarity?: number) {
    const g = this.add.graphics();
    const stroke = selected ? COLORS.gold : target ? COLORS.good : (rarity ?? COLORS.panelStroke);
    g.fillStyle(frozen ? 0x1d4e6b : COLORS.panelLight, frozen ? 0.75 : 0.45).fillRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 18);
    if (rarity !== undefined && !frozen) {
      // Rarity glow along the bottom of the card
      g.fillStyle(rarity, 0.18).fillRoundedRect(x - SLOT_W / 2, y + SLOT_H / 2 - 50, SLOT_W, 50, { tl: 0, tr: 0, bl: 18, br: 18 });
    }
    const strong = selected || target || rarity !== undefined;
    g.lineStyle(selected || target ? 4 : rarity !== undefined ? 3 : 2, stroke, strong ? 1 : 0.6).strokeRoundedRect(
      x - SLOT_W / 2,
      y - SLOT_H / 2,
      SLOT_W,
      SLOT_H,
      18,
    );
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
    v.on('dragend', (p: Phaser.Input.Pointer) => this.onDrop(sel, p.worldX, p.worldY));
    v.on('pointerup', () => {
      if (dragged) return;
      if (sel.kind === 'shop') this.onTapShop(sel.index);
      else this.onTapTeam(sel.index);
    });
    return v;
  }

  private infoBadge: Phaser.GameObjects.Container | null = null;

  private renderInfo() {
    this.info.removeAll(true);
    this.infoBadge?.destroy();
    this.infoBadge = null;
    const sel = this.selected;
    let unit = sel ? (sel.kind === 'shop' ? this.run.shop[sel.index]?.unit : this.run.team[sel.index]) : null;
    if (!unit && this.preview && this.trait) {
      const d = CREATURES[this.preview];
      unit = { defId: d.id, atk: d.atk, hp: d.hp, level: 1, xp: 0 };
    }
    const style = (size: number, color = COLORS.text, bold = false, align: 'center' | 'left' = 'center') => ({
      fontFamily: FONT_BODY,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      wordWrap: { width: 262 },
      align,
    });
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.info.add(o), o);

    // Trait details
    if (!unit && this.showCommander) {
      const c = this.run.commander;
      add(this.add.text(0, 0, c.name.toUpperCase(), { fontFamily: FONT_DISPLAY, fontSize: '26px', color: hexColor(c.color) }).setOrigin(0.5, 0));
      add(this.add.text(0, 36, c.title, style(15, COLORS.textDim, true)).setOrigin(0.5, 0));
      add(this.add.text(0, 200, c.passive, style(17, '#ffffff', true)).setOrigin(0.5, 0).setLineSpacing(4));
      add(this.add.text(0, 300, 'Your commander for this run. Unlock more in Command HQ.', style(13, COLORS.textDim)).setOrigin(0.5, 0));
      this.infoBadge = commanderBadge(this, INFO_X, 280, c.id, c.color, 110);
      return;
    }
    if (!unit && this.trait) {
      const def = TRAITS[this.trait];
      const team = this.run.team.filter((u): u is NonNullable<typeof u> => !!u);
      const st = computeTraits(team);
      add(this.add.text(0, 0, def.name.toUpperCase(), { fontFamily: FONT_DISPLAY, fontSize: '28px', color: hex(def.color) }).setOrigin(0.5, 0));
      const blurb = add(
        this.add.text(0, 38, `${def.kind === 'element' ? 'Element' : 'Class'} synergy  ·  ${def.blurb}`, style(13, COLORS.textDim, true)).setOrigin(0.5, 0),
      );
      let y = 38 + blurb.height + 12;
      def.tiers.forEach((line, k) => {
        const on = st.levels[this.trait!] > k;
        const t = add(
          this.add.text(-128, y, `(${def.thresholds[k]})  ${line}`, style(15, on ? '#ffffff' : COLORS.textDim, on, 'left')).setOrigin(0, 0).setLineSpacing(3),
        );
        y += t.height + 12;
      });
      // Every creature that shares this trait, as sprites: in your army (green), locked (dim).
      const members = Object.values(CREATURES)
        .filter((c) => !c.token && (c.element === this.trait || c.class === this.trait))
        .sort((a, b) => a.rarity - b.rarity || a.name.localeCompare(b.name));
      const owned = new Set(team.map((u) => u.defId));
      add(this.add.text(0, y + 2, `CREATURES (${members.length})  ·  tap one`, { fontFamily: FONT_DISPLAY, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5, 0));
      const PER_ROW = 6;
      const CELL = 44;
      const gridTop = y + 26;
      members.forEach((c, i) => {
        const col = i % PER_ROW;
        const row = Math.floor(i / PER_ROW);
        const inRow = Math.min(PER_ROW, members.length - row * PER_ROW);
        const cx = (col - (inRow - 1) / 2) * CELL;
        const cy = gridTop + row * CELL + CELL / 2;
        const unlocked = this.run.inPool(c.id);
        const inArmy = owned.has(c.id);
        const g = add(this.add.graphics());
        g.fillStyle(COLORS.panelLight, unlocked ? 0.7 : 0.3).fillRoundedRect(cx - 20, cy - 20, 40, 40, 8);
        g.lineStyle(inArmy ? 3 : 2, inArmy ? COLORS.good : RARITY[c.rarity].color, unlocked ? 1 : 0.4).strokeRoundedRect(cx - 20, cy - 20, 40, 40, 8);
        const img = add(this.add.image(cx, cy, creatureKey(c.id)).setScale(artScale(this, c.id, 36)));
        if (!unlocked) img.setTint(0x2a2d44);
        const zone = add(this.add.zone(cx, cy, 42, 42).setInteractive({ useHandCursor: true }));
        zone.on('pointerup', () => {
          this.preview = c.id;
          this.renderInfo();
        });
      });
      const gridBottom = gridTop + Math.ceil(members.length / PER_ROW) * CELL;
      add(
        this.add
          .text(0, gridBottom + 8, 'Green = in your army  ·  dim = locked\nCounts DIFFERENT creatures only', style(12, '#ffd166', true))
          .setOrigin(0.5, 0)
          .setLineSpacing(2),
      );
      return;
    }

    if (!unit) {
      add(this.add.text(0, 0, 'HOW TO PLAY', { fontFamily: FONT_DISPLAY, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5, 0));
      add(
        this.add
          .text(
            0,
            42,
            'Buy squads and drag them into your army. Drop a duplicate onto its twin to level it up.\n\nGold carries over: every 5 you save earns +1 interest next turn (max +3).\n\nBuild around SYNERGIES: shared elements and classes unlock big bonuses. Tap a synergy for details.\n\nElements also form a type wheel: Plasma > Mech > Cryo > Bio > Void > Plasma (x1.5 damage).',
            style(15, COLORS.textDim),
          )
          .setOrigin(0.5, 0)
          .setLineSpacing(4),
      );
      return;
    }

    const def = getDef(unit.defId);
    const el = ELEMENT_INFO[def.element];
    const cl = TRAITS[def.class];
    const swarm = computeTraits(this.run.team.filter((u): u is NonNullable<typeof u> => !!u)).levels.swarm;
    add(this.add.text(0, 0, formName(def, unit.level).toUpperCase(), { fontFamily: FONT_DISPLAY, fontSize: '28px', color: hex(el.color) }).setOrigin(0.5, 0));
    // Element + class chips
    const chip = (x: number, text: string, color: number) => {
      const t = this.add
        .text(x, 40, text, { fontFamily: FONT_BODY, fontSize: '14px', fontStyle: 'bold', color: '#10131f', backgroundColor: hex(color), padding: { x: 8, y: 3 } })
        .setOrigin(0.5, 0);
      add(t);
    };
    chip(-62, el.name, el.color);
    chip(62, CLASS_INFO[def.class].name, cl.color);
    const stats = add(
      this.add
        .text(
          0,
          72,
          `${RARITY[def.rarity].name}  ·  ${unitCost(def.id)} gold  ·  Level ${unit.level}\n${unit.atk} attack  ·  ${unit.hp} health  ·  Squad of ${squadCount(def.id, unit.level, this.run.modules.barracks, swarm)}  ·  ${def.ranged ? 'Ranged' : 'Melee'}`,
          style(14, '#ffffff', true),
        )
        .setOrigin(0.5, 0)
        .setLineSpacing(2),
    );
    let y = 72 + stats.height + 8;
    const role = add(this.add.text(0, y, def.role, { ...style(14, '#e0aaff', true) }).setOrigin(0.5, 0));
    // Evolution line, current form highlighted
    const line = [1, 2, 3].map((lv) => (lv === unit.level ? `[${formName(def, lv)}]` : formName(def, lv)));
    const evoText = add(
      this.add
        .text(0, y + role.height + 4, evolves(def) ? `Evolves: ${line.join(' > ')}` : def.rarity === 5 ? 'Legendary: Ascends at Lv 2 and 3' : '', style(12, '#9bf6ff', true))
        .setOrigin(0.5, 0),
    );
    y += evoText.height + 4;
    y += role.height + 10;
    for (const line of abilityTexts(def, unit.level)) {
      const i = line.indexOf(':');
      const head = add(this.add.text(-128, y, line.slice(0, i).toUpperCase(), style(12, '#ffd166', true, 'left')).setOrigin(0, 0));
      const body = add(this.add.text(-128, y + head.height + 1, cap(line.slice(i + 1).trim()), style(15, '#ffffff', false, 'left')).setOrigin(0, 0));
      y += head.height + body.height + 10;
    }
    const look = add(this.add.text(0, y + 2, `"${def.look}"`, { ...style(13, COLORS.textDim), fontStyle: 'italic' }).setOrigin(0.5, 0));
    y += look.height + 14;
    if (!sel && this.preview && this.trait) {
      const back = add(
        this.add
          .text(0, Math.max(y, 380), `< Back to ${TRAITS[this.trait].name}`, style(14, '#ffd166', true))
          .setOrigin(0.5, 0)
          .setInteractive({ useHandCursor: true }),
      );
      back.on('pointerup', () => {
        this.preview = null;
        this.renderInfo();
      });
      if (!this.run.inPool(def.id)) {
        add(this.add.text(0, Math.max(y, 380) + 24, `Locked: unlocks at Commander Lv ${def.unlock}`, style(12, COLORS.textDim, true)).setOrigin(0.5, 0));
      }
    } else {
      add(
        this.add
          .text(0, Math.max(y, 380), sel?.kind === 'shop' ? 'Tap an army slot to buy' : 'Tap another slot to move or merge', style(14, '#ffd166', true))
          .setOrigin(0.5, 0),
      );
    }
  }

  // ── Input ────────────────────────────────────────────────

  private onTapShop(i: number) {
    this.trait = null;
    const s = this.selected;
    this.selected = s?.kind === 'shop' && s.index === i ? null : { kind: 'shop', index: i };
    this.refresh();
  }

  private onTapTeam(i: number) {
    this.trait = null;
    const s = this.selected;
    if (s?.kind === 'shop') {
      this.tryBuy(s.index, i);
    } else if (s?.kind === 'team') {
      if (s.index === i) this.selected = null;
      else {
        this.watchEvolution(i, () => this.run.move(s.index, i));
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
        this.watchEvolution(teamIdx, () => this.run.move(sel.index, teamIdx));
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
    if (this.run.gold < this.run.cost(shopIdx)) {
      toast(this, 'Not enough gold');
      return;
    }
    if (!this.watchEvolution(teamIdx, () => this.run.buy(shopIdx, teamIdx))) {
      toast(this, 'That slot is taken');
      return;
    }
    this.selected = null;
  }

  /** Run a merge; if the creature in `teamIdx` leveled up, play its evolution. */
  private watchEvolution(teamIdx: number, action: () => boolean): boolean {
    const before = this.run.team[teamIdx]?.level ?? 0;
    const ok = action();
    const after = this.run.team[teamIdx];
    if (ok && after && before && after.level > before) {
      const { defId, level } = after;
      this.time.delayedCall(30, () => void this.playEvolution(defId, before, level));
    }
    return ok;
  }

  /** Full-screen evolution: the old form pulses, flashes white and becomes the new one. */
  private async playEvolution(defId: string, from: number, to: number) {
    const def = getDef(defId);
    const cx = 640;
    const cy = 330;
    const layer = this.add.container(0, 0).setDepth(500);
    const shade = this.add.rectangle(640, 360, 1280 + BLEED * 2, 720, 0x05060f, 0).setInteractive();
    layer.add(shade);
    this.tweens.add({ targets: shade, fillAlpha: 0.88, duration: 250 });
    const glow = this.add.circle(cx, cy, 120, ELEMENT_INFO[def.element].color, 0.2);
    const old = this.add.image(cx, cy, creatureKey(defId, from)).setScale(artScale(this, defId, 230, from));
    const next = this.add.image(cx, cy, creatureKey(defId, to)).setScale(artScale(this, defId, 250, to)).setAlpha(0);
    const title = this.add
      .text(cx, 110, 'WHAT?', { fontFamily: FONT_DISPLAY, fontSize: '34px', color: '#ffffff' })
      .setOrigin(0.5)
      .setAlpha(0);
    const caption = this.add
      .text(cx, 530, `${formName(def, from)} is evolving...`, { fontFamily: FONT_DISPLAY, fontSize: '30px', color: '#ffffff', stroke: '#000000', strokeThickness: 6 })
      .setOrigin(0.5);
    layer.add([glow, old, next, title, caption]);
    let skipped = false;
    shade.once('pointerup', () => (skipped = true));
    const pause = (ms: number) => (skipped ? Promise.resolve() : wait(this, ms));

    this.tweens.add({ targets: title, alpha: 1, duration: 200 });
    // Accelerating white flicker
    for (const ms of [260, 200, 150, 110, 80, 60]) {
      old.setTintFill(0xffffff);
      await pause(ms);
      old.clearTint();
      await pause(ms * 0.8);
    }
    // Flash and swap
    const flash = this.add.circle(cx, cy, 30, 0xffffff, 1);
    layer.add(flash);
    this.tweens.add({ targets: flash, scale: 14, alpha: 0, duration: 500, ease: 'Cubic.easeOut' });
    old.setVisible(false);
    next.setAlpha(1).setTintFill(0xffffff);
    await pause(160);
    next.clearTint();
    this.tweens.add({ targets: glow, scale: 1.6, alpha: 0.35, duration: 500 });
    this.tweens.add({ targets: next, scale: next.scale * 1.08, duration: 180, yoyo: true });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const p = this.add.circle(cx, cy, 5, i % 2 ? ELEMENT_INFO[def.element].accent : 0xffd166);
      layer.add(p);
      this.tweens.add({ targets: p, x: cx + Math.cos(a) * 220, y: cy + Math.sin(a) * 220, alpha: 0, duration: 700, ease: 'Cubic.easeOut' });
    }
    const bonus = EVOLVE_BONUS[to];
    title.setText(evolves(def) ? 'EVOLUTION!' : 'ASCENSION!').setColor('#ffd166');
    caption.setText(
      evolves(def)
        ? `${formName(def, from)} evolved into ${formName(def, to)}!`
        : `${def.name} ascended!`,
    );
    const stats = this.add
      .text(cx, 575, `+${bonus.atk} attack  ·  +${bonus.hp} health  ·  bigger squad, stronger abilities`, {
        fontFamily: FONT_BODY,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#06d6a0',
      })
      .setOrigin(0.5);
    const hint = this.add.text(cx, 640, 'Tap to continue', { fontFamily: FONT_BODY, fontSize: '16px', color: COLORS.textDim }).setOrigin(0.5);
    layer.add([stats, hint]);
    await new Promise<void>((resolve) => {
      if (skipped) {
        resolve();
        return;
      }
      shade.once('pointerup', () => resolve());
      this.time.delayedCall(2600, resolve);
    });
    this.tweens.add({ targets: layer, alpha: 0, duration: 200, onComplete: () => layer.destroy() });
    this.refresh();
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

  private async onEndTurn() {
    if (this.busy) return;
    if (!this.run.team.some(Boolean)) {
      toast(this, 'Add a squad to your army first');
      return;
    }
    this.busy = true;
    this.run.endTurn();
    const player = this.run.snapshot(playerName());
    // Matchmaking: fight an army another player saved at this same round.
    const status = this.add
      .text(1110, 610, 'Finding opponent...', { fontFamily: FONT_BODY, fontSize: '16px', fontStyle: 'bold', color: '#ffd166' })
      .setOrigin(0.5);
    const [opp] = await Promise.all([opponents.findOpponent(this.run.round, this.run.battleSeed()), opponents.submit(player)]);
    status.destroy();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Battle', { player, enemy: opp.army, kind: opp.kind, seed: this.run.battleSeed() });
    });
  }

  // ── Mothership ───────────────────────────────────────────

  /** Full-screen hangar: the ship on the left, the seven modules as cards on the right. */
  private openMothership() {
    this.ship?.destroy();
    const c = this.add.container(0, 0).setDepth(200);
    this.ship = c;
    const shade = this.add.rectangle(640, 360, 1280 + BLEED * 2, 720, 0x05060f, 0.82).setInteractive();
    shade.on('pointerup', () => this.closeMothership());
    const bg = panel(this, 640, 372, 1240, 680, 0.98);
    const block = this.add.zone(640, 372, 1240, 680).setInteractive(); // swallow taps on the panel
    c.add([shade, bg, block]);

    // Ship column
    const built = Object.values(this.run.modules).reduce((a, b) => a + b, 0);
    const shipImg = this.add.image(180, 260, 'mothership').setScale(300 / 480);
    this.tweens.add({ targets: shipImg, y: 250, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    c.add([
      this.add.text(180, 92, 'MOTHERSHIP', { fontFamily: FONT_DISPLAY, fontSize: '34px', color: '#e0aaff' }).setOrigin(0.5),
      shipImg,
      this.add
        .text(180, 380, `${built} / ${MODULES.length * 3} upgrades`, { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#ffffff' })
        .setOrigin(0.5),
      this.add
        .text(180, 414, `${this.run.gold} gold`, { fontFamily: FONT_DISPLAY, fontSize: '26px', color: '#ffd166' })
        .setOrigin(0.5),
      this.add
        .text(
          180,
          450,
          'Upgrades last for the whole run. Weapons fire during every battle, and your ship hovers over the battlefield.',
          { fontFamily: FONT_BODY, fontSize: '14px', color: COLORS.textDim, align: 'center', wordWrap: { width: 260 } },
        )
        .setOrigin(0.5, 0),
    ]);

    // Module cards: 2 columns x 4 rows
    MODULES.forEach((m, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 340 + col * 470;
      const y = 60 + row * 158;
      const lvl = this.run.modules[m.id];
      const maxed = lvl >= m.costs.length;
      const g = this.add.graphics();
      g.fillStyle(COLORS.panelLight, lvl ? 0.75 : 0.45).fillRoundedRect(x, y, 450, 146, 16);
      g.lineStyle(lvl ? 3 : 2, m.color, lvl ? 1 : 0.5).strokeRoundedRect(x, y, 450, 146, 16);
      for (let p = 0; p < m.costs.length; p++) {
        g.fillStyle(p < lvl ? m.color : 0x000000, p < lvl ? 1 : 0.45).fillRoundedRect(x + 340 + p * 34, y + 18, 28, 10, 5);
      }
      c.add(g);
      c.add(this.add.text(x + 18, y + 12, m.name, { fontFamily: FONT_DISPLAY, fontSize: '22px', color: '#ffffff' }));
      c.add(
        this.add.text(x + 18 + 0, y + 42, m.kind.toUpperCase(), {
          fontFamily: FONT_BODY,
          fontSize: '11px',
          fontStyle: 'bold',
          color: hexColor(m.color),
        }),
      );
      c.add(
        this.add.text(x + 18, y + 62, lvl ? `Now: ${moduleText(m, lvl)}` : 'Not built', {
          fontFamily: FONT_BODY,
          fontSize: '14px',
          fontStyle: 'bold',
          color: lvl ? '#ffffff' : COLORS.textDim,
          wordWrap: { width: 260 },
        }),
      );
      if (!maxed) {
        c.add(
          this.add.text(x + 18, y + 102, `Next: ${moduleText(m, lvl + 1)}`, {
            fontFamily: FONT_BODY,
            fontSize: '13px',
            color: '#ffd166',
            wordWrap: { width: 270 },
          }),
        );
      }
      const cost = this.run.moduleCost(m.id);
      const label = cost === null ? 'MAXED' : `${lvl ? 'Upgrade' : 'Build'} ${cost}g`;
      const b = button(this, x + 370, y + 96, 140, 50, label, m.color, () => {
        if (!this.run.buyModule(m.id)) {
          toast(this, cost === null ? 'Already maxed' : 'Not enough gold');
          return;
        }
        this.refresh();
        this.openMothership();
      });
      b.setEnabled(cost !== null && this.run.gold >= cost);
      c.add(b);
    });
    c.add(button(this, 1105, 650, 200, 54, 'Close', 0x5c677d, () => this.closeMothership()));
  }

  private closeMothership() {
    this.ship?.destroy();
    this.ship = null;
  }
}
