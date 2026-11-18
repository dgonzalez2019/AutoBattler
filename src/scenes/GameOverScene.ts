import Phaser from 'phaser';
import { fitCamera } from '../ui/viewport';
import { commanderBadge } from '../art/commanderArt';
import { artScale, creatureKey } from '../art/creatureArt';
import { COMMANDERS } from '../data/commanders';
import { xpToNext } from '../data/progression';
import { hexColor, RARITY } from '../data/rarity';
import { profile, type RunResult } from '../game/profile';
import { ENDLESS_FINAL_ROUND, WINS_TO_VICTORY, type Run } from '../game/run';
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

    const justWon = run.status === 'won';
    const conquered = run.status === 'conquered';

    // Bank rewards exactly once: the run (incl. championship at 10 wins), then Endless separately.
    let result: RunResult;
    if (run.endless) {
      result = this.registry.get('endlessResult');
      if (!this.registry.get('endlessRewarded')) {
        result = profile().finishEndless(run.endlessWins, run.endlessRounds, conquered);
        this.registry.set('endlessRewarded', true);
        this.registry.set('endlessResult', result);
      }
    } else {
      result = this.registry.get('runResult');
      if (!this.registry.get('rewarded')) {
        result = profile().finishRun({ wins: run.wins, rounds: run.round - 1, champion });
        this.registry.set('rewarded', true);
        this.registry.set('runResult', result);
      }
    }

    const title = conquered ? 'ENDLESS CONQUERED!' : run.endless ? 'ENDLESS OVER' : champion ? 'CHAMPION!' : 'RUN OVER';
    const titleColor = conquered ? '#ffd166' : run.endless ? '#c77dff' : champion ? '#ffd166' : '#ef476f';
    this.add
      .text(W / 2, 90, title, { fontFamily: FONT_DISPLAY, fontSize: '72px', color: titleColor, stroke: '#000000', strokeThickness: 10 })
      .setOrigin(0.5);
    const best = profile().data.stats.bestEndless;
    const subtitle = run.endless
      ? `${run.endlessWins} endless wins  ·  survived to round ${Math.min(run.round - 1, ENDLESS_FINAL_ROUND)} / ${ENDLESS_FINAL_ROUND}  ·  best ${best}`
      : justWon
        ? `${WINS_TO_VICTORY} wins with ${run.lives} ${run.lives === 1 ? 'life' : 'lives'} to spare  ·  ${run.commander.name}`
        : `${run.wins} wins  ·  ${run.round - 1} rounds  ·  ${run.commander.name}`;
    this.add
      .text(W / 2, 152, subtitle, {
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

    if (justWon) {
      this.endlessOffer(run);
      return;
    }
    button(this, W / 2 - 170, H - 70, 300, 70, 'COMMAND HQ', 0x7b2cbf, () => this.scene.start('HQ', { tab: result.levelsGained.length ? 'collection' : 'commanders' }));
    button(this, W / 2 + 170, H - 70, 300, 70, 'PLAY AGAIN', 0x06d6a0, () => this.scene.start('HQ', { tab: 'commanders' }));
  }

  /** After the championship is banked: finish here, or take this army into Endless Mode. */
  private endlessOffer(run: Run) {
    const squads = run.team.filter(Boolean) as NonNullable<Run['team'][number]>[];
    this.add
      .text(W / 2, 520, `Championship banked! Keep going in ENDLESS MODE with this army: survive to round ${ENDLESS_FINAL_ROUND}.`, {
        fontFamily: FONT_BODY,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#e0aaff',
      })
      .setOrigin(0.5);
    squads.forEach((u, i) => {
      const x = W / 2 + (i - (squads.length - 1) / 2) * 110;
      const img = this.add.image(x, 562, creatureKey(u.defId, u.level)).setScale(artScale(this, u.defId, 52, u.level));
      this.tweens.add({ targets: img, y: 556, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add
        .text(x, 580, formName(getDef(u.defId), u.level), { fontFamily: FONT_BODY, fontSize: '11px', fontStyle: 'bold', color: '#e8ecff' })
        .setOrigin(0.5, 0);
    });
    button(this, W / 2 - 200, H - 70, 340, 70, 'FINISH RUN', 0x5c677d, () => this.scene.start('HQ', { tab: 'commanders' }));
    button(this, W / 2 + 200, H - 70, 340, 70, 'CONTINUE: ENDLESS', 0x7b2cbf, () => {
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
