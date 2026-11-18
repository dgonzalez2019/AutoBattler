import Phaser from 'phaser';
import { fitCamera } from '../ui/viewport';
import { commanderBadge } from '../art/commanderArt';
import { artScale, creatureKey } from '../art/creatureArt';
import { COMMANDERS } from '../data/commanders';
import { xpToNext } from '../data/progression';
import { hexColor, RARITY } from '../data/rarity';
import { profile, type RunResult } from '../game/profile';
import { WINS_TO_VICTORY, type Run } from '../game/run';
import { getDef } from '../data/creatures';
import { formName } from '../data/evolutions';
import { COLORS, FONT_BODY, FONT_DISPLAY, H, W } from '../ui/theme';
import { button, drawBackground, tween } from '../ui/widgets';
import { stardustIcon } from './HQScene';

/** End of run: result, then XP / Stardust / level-ups / unlocks. */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create() {
    const run: Run = this.registry.get('run');
    const champion = run.wins >= WINS_TO_VICTORY;
    drawBackground(this, 99);
    fitCamera(this);
    this.cameras.main.fadeIn(250);

    // Just hit 10 wins: offer Endless Mode before banking anything.
    if (run.status === 'won' && !this.registry.get('rewarded') && !this.registry.get('claimed')) {
      this.championChoice(run);
      return;
    }

    // Bank rewards exactly once per run.
    let result: RunResult = this.registry.get('runResult');
    if (!this.registry.get('rewarded')) {
      result = profile().finishRun({ wins: run.wins, rounds: run.round - 1, champion, endlessWins: run.endlessWins });
      this.registry.set('rewarded', true);
      this.registry.set('runResult', result);
    }

    const title = run.endless ? 'ENDLESS OVER' : champion ? 'CHAMPION!' : 'RUN OVER';
    this.add
      .text(W / 2, 90, title, {
        fontFamily: FONT_DISPLAY,
        fontSize: '72px',
        color: run.endless ? '#c77dff' : champion ? '#ffd166' : '#ef476f',
        stroke: '#000000',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    const endlessNote = run.endless ? `  ·  ${run.endlessWins} endless wins (best ${profile().data.stats.bestEndless})` : '';
    this.add
      .text(W / 2, 152, `${run.wins} wins  ·  ${run.round - 1} rounds  ·  ${run.commander.name}${endlessNote}`, {
        fontFamily: FONT_BODY,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#e8ecff',
      })
      .setOrigin(0.5);

    // Rewards
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.92).fillRoundedRect(W / 2 - 420, 190, 840, 400, 20);
    g.lineStyle(2, COLORS.panelStroke).strokeRoundedRect(W / 2 - 420, 190, 840, 400, 20);
    this.add.text(W / 2 - 380, 225, `+${result.rewards.xp} XP`, { fontFamily: FONT_DISPLAY, fontSize: '30px', color: '#ffd166' }).setOrigin(0, 0.5);
    stardustIcon(this, W / 2 + 160, 225, 14);
    this.add.text(W / 2 + 182, 225, `+${result.rewards.stardust} Stardust`, { fontFamily: FONT_DISPLAY, fontSize: '30px', color: '#e0aaff' }).setOrigin(0, 0.5);
    this.xpBar(result);

    // Level-ups and unlocks
    let y = 340;
    if (!result.levelsGained.length) {
      const p = profile().data;
      this.add
        .text(W / 2, y + 40, `${xpToNext(p.level) - p.xp} XP to Commander Lv ${p.level + 1}`, {
          fontFamily: FONT_BODY,
          fontSize: '20px',
          fontStyle: 'bold',
          color: COLORS.textDim,
        })
        .setOrigin(0.5);
    }
    for (const lv of result.levelsGained.slice(0, 4)) {
      const banner = this.add
        .text(W / 2 - 380, y, `LEVEL ${lv.level}!`, { fontFamily: FONT_DISPLAY, fontSize: '22px', color: '#06d6a0' })
        .setOrigin(0, 0.5)
        .setAlpha(0);
      this.tweens.add({ targets: banner, alpha: 1, delay: 600, duration: 300 });
      this.add.text(W / 2 - 380, y + 20, `+${lv.stardust} Stardust`, { fontFamily: FONT_BODY, fontSize: '13px', fontStyle: 'bold', color: '#e0aaff' }).setOrigin(0, 0.5);
      let x = W / 2 - 210;
      for (const c of lv.creatures) {
        const img = this.add.image(x, y, creatureKey(c.id)).setScale(artScale(this, c.id, 48));
        const t = this.add
          .text(x + 30, y, `${c.name} unlocked`, { fontFamily: FONT_BODY, fontSize: '15px', fontStyle: 'bold', color: hexColor(RARITY[c.rarity].color) })
          .setOrigin(0, 0.5);
        [img, t].forEach((o) => {
          o.setAlpha(0);
          this.tweens.add({ targets: o, alpha: 1, delay: 800, duration: 300 });
        });
        x += 200;
      }
      for (const id of lv.commanders) {
        const cmd = COMMANDERS[id];
        commanderBadge(this, x, y, id, cmd.color, 44);
        this.add.text(x + 30, y, `${cmd.name} unlocked`, { fontFamily: FONT_BODY, fontSize: '15px', fontStyle: 'bold', color: hexColor(cmd.color) }).setOrigin(0, 0.5);
        x += 200;
      }
      y += 60;
    }
    if (result.levelsGained.length > 4) {
      this.add
        .text(W / 2, y, `+${result.levelsGained.length - 4} more levels: see Command HQ`, { fontFamily: FONT_BODY, fontSize: '16px', color: COLORS.textDim })
        .setOrigin(0.5);
    }

    button(this, W / 2 - 170, H - 70, 300, 70, 'COMMAND HQ', 0x7b2cbf, () => this.scene.start('HQ', { tab: result.levelsGained.length ? 'collection' : 'commanders' }));
    button(this, W / 2 + 170, H - 70, 300, 70, 'PLAY AGAIN', 0x06d6a0, () => this.scene.start('HQ', { tab: 'commanders' }));
  }

  /** 10 wins: claim the championship now, or keep the army going in Endless Mode. */
  private championChoice(run: Run) {
    this.add
      .text(W / 2, 110, 'CHAMPION!', { fontFamily: FONT_DISPLAY, fontSize: '84px', color: '#ffd166', stroke: '#000000', strokeThickness: 12 })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 185, `${WINS_TO_VICTORY} wins with ${run.lives} ${run.lives === 1 ? 'life' : 'lives'} to spare, led by ${run.commander.name}.`, {
        fontFamily: FONT_BODY,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#e8ecff',
      })
      .setOrigin(0.5);
    // Show the winning army
    const squads = run.team.filter(Boolean) as NonNullable<Run['team'][number]>[];
    squads.forEach((u, i) => {
      const x = W / 2 + (i - (squads.length - 1) / 2) * 150;
      const img = this.add.image(x, 320, creatureKey(u.defId, u.level)).setScale(artScale(this, u.defId, 120, u.level));
      this.tweens.add({ targets: img, y: 310, duration: 800 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add
        .text(x, 395, formName(getDef(u.defId), u.level), { fontFamily: FONT_BODY, fontSize: '14px', fontStyle: 'bold', color: '#e8ecff' })
        .setOrigin(0.5);
    });

    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.92).fillRoundedRect(W / 2 - 560, 440, 1120, 150, 18);
    this.add
      .text(W / 2 - 280, 470, 'CLAIM REWARDS', { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#ffd166' })
      .setOrigin(0.5);
    this.add
      .text(W / 2 - 280, 505, 'End the run as champion and bank your XP and Stardust now.', {
        fontFamily: FONT_BODY,
        fontSize: '15px',
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5, 0);
    this.add
      .text(W / 2 + 280, 470, 'ENDLESS MODE', { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#c77dff' })
      .setOrigin(0.5);
    this.add
      .text(
        W / 2 + 280,
        505,
        `Keep this army and your ${run.lives} ${run.lives === 1 ? 'life' : 'lives'}. Enemies keep growing stronger every round. Every extra win adds XP and Stardust; the championship bonus is kept.`,
        { fontFamily: FONT_BODY, fontSize: '15px', color: COLORS.textDim, align: 'center', wordWrap: { width: 500 } },
      )
      .setOrigin(0.5, 0);

    button(this, W / 2 - 280, H - 60, 340, 70, 'CLAIM REWARDS', 0xffb703, () => {
      this.registry.set('claimed', true);
      this.scene.restart();
    });
    button(this, W / 2 + 280, H - 60, 340, 70, 'CONTINUE: ENDLESS', 0x7b2cbf, () => {
      run.continueEndless();
      this.cameras.main.fadeOut(250);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Shop'));
    });
  }

  /** XP bar that fills from the old value, rolling over on each level-up. */
  private xpBar(result: RunResult) {
    const x = W / 2 - 380;
    const y = 280;
    const w = 760;
    const p = profile().data;
    const g = this.add.graphics();
    const label = this.add
      .text(x, y - 20, `Commander Lv ${result.levelBefore}`, { fontFamily: FONT_BODY, fontSize: '15px', fontStyle: 'bold', color: '#e8ecff' })
      .setOrigin(0, 0.5);
    const draw = (pct: number) => {
      g.clear();
      g.fillStyle(0x000000, 0.5).fillRoundedRect(x, y, w, 16, 8);
      g.fillStyle(COLORS.gold).fillRoundedRect(x, y, Math.max(16, w * pct), 16, 8);
    };
    draw(0);
    const steps = result.levelsGained.length;
    const state = { v: 0 };
    void (async () => {
      for (let i = 0; i < steps; i++) {
        state.v = 0;
        await tween(this, { targets: state, v: 1, duration: 450, onUpdate: () => draw(state.v) });
        label.setText(`Commander Lv ${result.levelBefore + i + 1}`);
      }
      state.v = 0;
      await tween(this, { targets: state, v: p.xp / xpToNext(p.level), duration: 500, onUpdate: () => draw(state.v) });
      label.setText(`Commander Lv ${p.level}  ·  ${p.xp} / ${xpToNext(p.level)} XP`);
    })();
  }
}
