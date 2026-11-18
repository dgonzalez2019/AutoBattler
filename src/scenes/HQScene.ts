import Phaser from 'phaser';
import { fitCamera } from '../ui/viewport';
import { commanderBadge } from '../art/commanderArt';
import { artScale, creatureKey } from '../art/creatureArt';
import { COMMANDER_LIST, COMMANDERS, getCommander } from '../data/commanders';
import { abilityTexts, SHOP_POOL, type CreatureDef } from '../data/creatures';
import { evolves, formName } from '../data/evolutions';
import { ELEMENT_INFO, ELEMENTS } from '../data/elements';
import { rewardTrack } from '../data/progression';
import { hexColor, RARITY } from '../data/rarity';
import { TRAITS } from '../data/traits';
import { profile } from '../game/profile';
import { Run } from '../game/run';
import { COLORS, FONT_BODY, FONT_DISPLAY, H, W } from '../ui/theme';
import { button, drawBackground, panel, toast, type Button } from '../ui/widgets';

type Tab = 'commanders' | 'collection' | 'rewards';

const CONTENT_TOP = 150;

/** Draw a small 4-point star (the Stardust icon). */
export function stardustIcon(scene: Phaser.Scene, x: number, y: number, r = 9) {
  const g = scene.add.graphics();
  g.fillStyle(0xe0aaff).fillPoints(
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 4;
      const rr = i % 2 ? r * 0.38 : r;
      return new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }),
    true,
  );
  return g;
}

/** Command HQ: commanders, creature collection and the level reward track. */
export class HQScene extends Phaser.Scene {
  private tab: Tab = 'commanders';
  private items: Phaser.GameObjects.GameObject[] = [];
  private header: Phaser.GameObjects.GameObject[] = [];
  private tabButtons: Partial<Record<Tab, Button>> = {};
  private picked: string | null = null;

  constructor() {
    super('HQ');
  }

  create(data: { tab?: Tab }) {
    this.tab = data?.tab ?? 'commanders';
    this.items = [];
    this.header = [];
    this.picked = null;
    drawBackground(this, 77);
    fitCamera(this);
    this.cameras.main.fadeIn(200);

    button(this, 90, 44, 140, 50, 'Back', 0x5c677d, () => this.scene.start('Title'));
    this.add.text(W / 2, 44, 'COMMAND HQ', { fontFamily: FONT_DISPLAY, fontSize: '34px', color: '#ffffff' }).setOrigin(0.5);

    const tabs: [Tab, string][] = [
      ['commanders', 'Commanders'],
      ['collection', 'Collection'],
      ['rewards', 'Level Rewards'],
    ];
    tabs.forEach(([t, label], i) => {
      this.tabButtons[t] = button(this, W / 2 - 230 + i * 230, 108, 210, 46, label, 0x3a0ca3, () => {
        this.tab = t;
        this.picked = null;
        this.render();
      });
    });

    button(this, W - 150, H - 40, 260, 58, 'START RUN', 0x06d6a0, () => this.startRun()).setDepth(10);
    this.render();
  }

  private clear() {
    for (const o of this.items) o.destroy();
    this.items = [];
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.items.push(o);
    return o;
  }

  private render() {
    this.clear();
    this.renderHeader();
    for (const [t, b] of Object.entries(this.tabButtons) as [Tab, Button][]) b.setAlpha(t === this.tab ? 1 : 0.55);
    if (this.tab === 'commanders') this.renderCommanders();
    else if (this.tab === 'collection') this.renderCollection();
    else this.renderRewards();
    this.renderFooter();
  }

  /** Level, XP bar and Stardust (top right). */
  private renderHeader() {
    for (const o of this.header) o.destroy();
    const p = profile().data;
    const x = W - 300;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.9).fillRoundedRect(x - 10, 18, 300, 54, 27);
    g.fillStyle(COLORS.gold).fillCircle(x + 20, 45, 20);
    const lvl = this.add.text(x + 20, 45, String(p.level), { fontFamily: FONT_DISPLAY, fontSize: '18px', color: '#3a2a00' }).setOrigin(0.5);
    const pct = Math.min(1, p.xp / profile().xpNeeded);
    g.fillStyle(0x000000, 0.5).fillRoundedRect(x + 48, 50, 130, 10, 5);
    g.fillStyle(COLORS.gold).fillRoundedRect(x + 48, 50, Math.max(10, 130 * pct), 10, 5);
    const lbl = this.add.text(x + 48, 34, `Commander Lv ${p.level}`, { fontFamily: FONT_BODY, fontSize: '13px', fontStyle: 'bold', color: '#e8ecff' }).setOrigin(0, 0.5);
    const star = stardustIcon(this, x + 205, 45, 10);
    const dust = this.add.text(x + 220, 45, String(p.stardust), { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#e0aaff' }).setOrigin(0, 0.5);
    this.header = [g, lvl, lbl, star, dust];
  }

  private renderFooter() {
    const c = getCommander(profile().data.selectedCommander);
    this.keep(
      this.add
        .text(30, H - 40, `Commander: ${c.name}  ·  ${c.passive}`, {
          fontFamily: FONT_BODY,
          fontSize: '16px',
          fontStyle: 'bold',
          color: hexColor(c.color),
          wordWrap: { width: 900 },
        })
        .setOrigin(0, 0.5),
    );
  }

  // ── Commanders ───────────────────────────────────────────

  private renderCommanders() {
    const prof = profile();
    COMMANDER_LIST.forEach((c, i) => {
      const col = i % 7;
      const row = Math.floor(i / 7);
      const x = 104 + col * 179;
      const y = 280 + row * 250;
      const owned = prof.hasCommander(c.id);
      const selected = prof.data.selectedCommander === c.id;
      const g = this.keep(this.add.graphics());
      g.fillStyle(COLORS.panel, owned ? 0.92 : 0.6).fillRoundedRect(x - 83, y - 118, 166, 238, 16);
      g.lineStyle(selected ? 4 : 2, selected ? COLORS.gold : owned ? c.color : COLORS.panelStroke, owned ? 1 : 0.5).strokeRoundedRect(x - 83, y - 118, 166, 238, 16);
      const badge = this.keep(commanderBadge(this, x, y - 60, c.id, c.color, 96));
      if (!owned) badge.setAlpha(0.45);
      this.keep(this.add.text(x, y + 2, c.name, { fontFamily: FONT_DISPLAY, fontSize: '17px', color: owned ? '#ffffff' : COLORS.textDim }).setOrigin(0.5, 0));
      this.keep(this.add.text(x, y + 24, c.title, { fontFamily: FONT_BODY, fontSize: '12px', fontStyle: 'bold', color: hexColor(c.color) }).setOrigin(0.5, 0));
      this.keep(
        this.add
          .text(x, y + 44, c.passive, { fontFamily: FONT_BODY, fontSize: '12px', color: '#e8ecff', align: 'center', wordWrap: { width: 150 } })
          .setOrigin(0.5, 0)
          .setAlpha(owned ? 1 : 0.7),
      );
      const status = selected
        ? 'SELECTED'
        : owned
          ? 'Tap to select'
          : `Lv ${c.unlockLevel}  or  ${c.price} dust`;
      this.keep(
        this.add
          .text(x, y + 104, status, {
            fontFamily: FONT_BODY,
            fontSize: '13px',
            fontStyle: 'bold',
            color: selected ? '#ffd166' : owned ? COLORS.textDim : prof.data.stardust >= c.price ? '#e0aaff' : '#9aa3c7',
          })
          .setOrigin(0.5),
      );
      const zone = this.keep(this.add.zone(x, y, 166, 238).setInteractive({ useHandCursor: true }));
      zone.on('pointerup', () => this.onCommander(c.id));
    });
  }

  private onCommander(id: string) {
    const prof = profile();
    const c = COMMANDERS[id];
    if (prof.hasCommander(id)) {
      prof.selectCommander(id);
    } else if (prof.data.stardust >= c.price) {
      if (!window.confirm(`Unlock ${c.name} for ${c.price} Stardust?`)) return;
      prof.buyCommander(id);
      prof.selectCommander(id);
      toast(this, `${c.name} unlocked!`);
    } else {
      toast(this, `Reach Commander Lv ${c.unlockLevel}, or save ${c.price} Stardust`);
      return;
    }
    this.render();
  }

  // ── Collection ───────────────────────────────────────────

  private renderCollection() {
    const prof = profile();
    const fresh = new Set(prof.data.fresh);
    const owned = SHOP_POOL.filter((c) => prof.hasCreature(c.id)).length;
    this.keep(
      this.add
        .text(W / 2, CONTENT_TOP, `${owned} / ${SHOP_POOL.length} creatures unlocked  ·  tap one for details`, {
          fontFamily: FONT_BODY,
          fontSize: '15px',
          fontStyle: 'bold',
          color: COLORS.textDim,
        })
        .setOrigin(0.5),
    );
    ELEMENTS.forEach((el, r) => {
      const y = 205 + r * 80;
      const info = ELEMENT_INFO[el];
      this.keep(this.add.circle(40, y, 8, info.color));
      this.keep(this.add.text(54, y, info.name, { fontFamily: FONT_BODY, fontSize: '15px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0, 0.5));
      const row = SHOP_POOL.filter((c) => c.element === el).sort((a, b) => a.rarity - b.rarity || (a.unlock ?? 0) - (b.unlock ?? 0));
      row.forEach((c, i) => {
        const x = 168 + i * 72;
        const has = prof.hasCreature(c.id);
        const g = this.keep(this.add.graphics());
        const sel = this.picked === c.id;
        g.fillStyle(COLORS.panelLight, has ? 0.7 : 0.3).fillRoundedRect(x - 33, y - 33, 66, 66, 10);
        g.lineStyle(sel ? 3 : 2, sel ? COLORS.gold : RARITY[c.rarity].color, has ? 1 : 0.45).strokeRoundedRect(x - 33, y - 33, 66, 66, 10);
        const img = this.keep(this.add.image(x, y, creatureKey(c.id)).setScale(artScale(this, c.id, 58)));
        if (!has) {
          img.setTint(0x1a1d33);
          this.keep(this.add.text(x, y + 20, `Lv ${c.unlock}`, { fontFamily: FONT_DISPLAY, fontSize: '12px', color: '#c8cde8' }).setOrigin(0.5));
        }
        if (fresh.has(c.id)) {
          this.keep(this.add.text(x + 30, y - 30, 'NEW', { fontFamily: FONT_BODY, fontSize: '10px', fontStyle: 'bold', color: '#10131f', backgroundColor: '#06d6a0', padding: { x: 3, y: 1 } }).setOrigin(1, 0));
        }
        const zone = this.keep(this.add.zone(x, y, 66, 66).setInteractive({ useHandCursor: true }));
        zone.on('pointerup', () => {
          this.picked = c.id;
          this.render();
        });
      });
    });
    if (this.picked) this.renderCreatureDetail(SHOP_POOL.find((c) => c.id === this.picked)!);
    if (prof.data.fresh.length) prof.markSeen();
  }

  private renderCreatureDetail(c: CreatureDef) {
    const prof = profile();
    const has = prof.hasCreature(c.id);
    this.keep(panel(this, 560, 606, 1080, 66, 0.95));
    this.keep(
      this.add
        .text(40, 586, `${c.name}`, { fontFamily: FONT_DISPLAY, fontSize: '20px', color: hexColor(ELEMENT_INFO[c.element].color) })
        .setOrigin(0, 0.5),
    );
    this.keep(
      this.add
        .text(40, 612, `${RARITY[c.rarity].name} ${ELEMENT_INFO[c.element].name} ${TRAITS[c.class].name}  ·  ${RARITY[c.rarity].cost}g  ·  ${c.atk}/${c.hp} x${c.squad}`, {
          fontFamily: FONT_BODY,
          fontSize: '13px',
          fontStyle: 'bold',
          color: COLORS.textDim,
        })
        .setOrigin(0, 0.5),
    );
    this.keep(
      this.add
        .text(
          330,
          606,
          [
            ...abilityTexts(c, 1),
            evolves(c) ? `Evolves: ${c.name} > ${formName(c, 2)} (Lv 2) > ${formName(c, 3)} (Lv 3)` : 'Legendary: Ascends at Lv 2 and 3',
          ].join('\n'),
          { fontFamily: FONT_BODY, fontSize: '13px', color: '#e8ecff', wordWrap: { width: 560 } },
        )
        .setOrigin(0, 0.5),
    );
    if (!has) {
      const price = prof.researchPrice(c.id)!;
      const b = this.keep(
        button(this, 1010, 606, 180, 46, `Research ${price}`, 0x7b2cbf, () => {
          if (!window.confirm(`Research ${c.name} now for ${price} Stardust? (Otherwise it unlocks at Lv ${c.unlock}.)`)) return;
          if (prof.research(c.id)) toast(this, `${c.name} added to your shop pool!`);
          this.render();
        }),
      );
      b.setEnabled(prof.data.stardust >= price);
    } else {
      this.keep(this.add.text(1010, 606, 'In your shop pool', { fontFamily: FONT_BODY, fontSize: '14px', fontStyle: 'bold', color: '#06d6a0' }).setOrigin(0.5));
    }
  }

  // ── Rewards track ────────────────────────────────────────

  private renderRewards() {
    const prof = profile();
    const track = rewardTrack().filter((t) => t.creatures.length || t.commanders.length);
    const perCol = Math.ceil(track.length / 2);
    track.forEach((t, i) => {
      const col = Math.floor(i / perCol);
      const k = i % perCol;
      const x = 40 + col * 610;
      const y = 170 + k * 50;
      const reached = prof.data.level >= t.level;
      const next = prof.data.level + 1 === t.level;
      const g = this.keep(this.add.graphics());
      g.fillStyle(reached ? 0x06d6a0 : COLORS.panel, reached ? 0.16 : 0.85).fillRoundedRect(x, y - 21, 590, 44, 10);
      if (next) g.lineStyle(2, COLORS.gold, 1).strokeRoundedRect(x, y - 21, 590, 44, 10);
      this.keep(
        this.add
          .text(x + 14, y, `Lv ${t.level}`, { fontFamily: FONT_DISPLAY, fontSize: '17px', color: reached ? '#06d6a0' : next ? '#ffd166' : '#ffffff' })
          .setOrigin(0, 0.5),
      );
      let cx = x + 92;
      for (const c of t.creatures) {
        const img = this.keep(this.add.image(cx, y, creatureKey(c.id)).setScale(artScale(this, c.id, 40)));
        if (!prof.hasCreature(c.id)) img.setTint(0x6b6f8a);
        this.keep(this.add.text(cx + 24, y, c.name, { fontFamily: FONT_BODY, fontSize: '13px', fontStyle: 'bold', color: hexColor(RARITY[c.rarity].color) }).setOrigin(0, 0.5));
        cx += 150;
      }
      for (const id of t.commanders) {
        const cmd = COMMANDERS[id];
        this.keep(commanderBadge(this, cx, y, id, cmd.color, 36));
        this.keep(this.add.text(cx + 24, y, cmd.name, { fontFamily: FONT_BODY, fontSize: '13px', fontStyle: 'bold', color: hexColor(cmd.color) }).setOrigin(0, 0.5));
        cx += 150;
      }
      this.keep(stardustIcon(this, x + 545, y, 7));
      this.keep(this.add.text(x + 556, y, `${t.stardust}`, { fontFamily: FONT_BODY, fontSize: '13px', fontStyle: 'bold', color: '#e0aaff' }).setOrigin(0, 0.5));
    });
    this.keep(
      this.add
        .text(W / 2, 640, 'Every level also grants Stardust. Levels beyond these keep paying Stardust up to Lv 30.', {
          fontFamily: FONT_BODY,
          fontSize: '14px',
          color: COLORS.textDim,
        })
        .setOrigin(0.5),
    );
  }

  // ── Start ────────────────────────────────────────────────

  private startRun() {
    const prof = profile();
    this.registry.set('run', new Run({ commander: prof.data.selectedCommander, pool: prof.shopPool() }));
    this.registry.set('rewarded', false);
    this.registry.set('claimed', false);
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Shop'));
  }
}
