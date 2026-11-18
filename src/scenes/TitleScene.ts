import Phaser from 'phaser';
import { artScale, creatureKey } from '../art/creatureArt';
import { onlineEnabled } from '../config';
import { playerName, setPlayerName } from '../game/player';
import { WINS_TO_VICTORY } from '../game/run';
import { commanderBadge } from '../art/commanderArt';
import { getCommander } from '../data/commanders';
import { hexColor } from '../data/rarity';
import { profile } from '../game/profile';
import { stardustIcon } from './HQScene';
import { COLORS, FONT_BODY, FONT_DISPLAY, H, W } from '../ui/theme';
import { button, drawBackground } from '../ui/widgets';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    drawBackground(this, 42);
    const lineup = ['sparkit', 'frostling', 'quasarion', 'bryobit', 'nullmite'];
    lineup.forEach((id, i) => {
      const x = W / 2 + (i - 2) * 170;
      const big = i === 2;
      const img = this.add.image(x, 420, creatureKey(id)).setScale(artScale(this, id, big ? 200 : 140));
      if (i > 2) img.setFlipX(true);
      this.tweens.add({ targets: img, y: 410, duration: 900 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    this.add
      .text(W / 2, 150, 'AUTOBATTLER', { fontFamily: FONT_DISPLAY, fontSize: '88px', color: '#ffffff', stroke: '#3a0ca3', strokeThickness: 12 })
      .setOrigin(0.5)
      .setShadow(0, 6, '#000000', 10, true, true);
    this.add
      .text(W / 2, 230, `Build a team of alien creatures. Win ${WINS_TO_VICTORY} battles.`, {
        fontFamily: FONT_BODY,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#9aa3c7',
      })
      .setOrigin(0.5);

    // Commander name + matchmaking mode
    const nameText = this.add
      .text(W / 2, H - 182, '', { fontFamily: FONT_BODY, fontSize: '20px', fontStyle: 'bold', color: '#e8ecff' })
      .setOrigin(0.5);
    const showName = () => nameText.setText(`Player name: ${playerName()}   (tap to rename)`);
    showName();
    nameText.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      const next = window.prompt('Player name (shown to opponents):', playerName());
      if (next !== null) setPlayerName(next);
      showName();
    });
    this.add
      .text(W / 2, H - 40, onlineEnabled() ? 'Online matchmaking: fight armies from real players' : 'Offline mode: AI opponents', {
        fontFamily: FONT_BODY,
        fontSize: '16px',
        fontStyle: 'bold',
        color: onlineEnabled() ? '#06d6a0' : '#9aa3c7',
      })
      .setOrigin(0.5);

    // Profile summary
    const p = profile().data;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.9).fillRoundedRect(W - 330, 18, 310, 54, 27);
    g.fillStyle(COLORS.gold).fillCircle(W - 300, 45, 20);
    this.add.text(W - 300, 45, String(p.level), { fontFamily: FONT_DISPLAY, fontSize: '18px', color: '#3a2a00' }).setOrigin(0.5);
    this.add
      .text(W - 270, 45, `Commander Lv ${p.level}`, { fontFamily: FONT_BODY, fontSize: '15px', fontStyle: 'bold', color: '#e8ecff' })
      .setOrigin(0, 0.5);
    stardustIcon(this, W - 112, 45, 10);
    this.add.text(W - 96, 45, String(p.stardust), { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#e0aaff' }).setOrigin(0, 0.5);
    const cmd = getCommander(p.selectedCommander);
    commanderBadge(this, 60, 45, cmd.id, cmd.color, 56);
    this.add.text(98, 35, cmd.name, { fontFamily: FONT_DISPLAY, fontSize: '18px', color: hexColor(cmd.color) }).setOrigin(0, 0.5);
    this.add.text(98, 57, cmd.title, { fontFamily: FONT_BODY, fontSize: '13px', fontStyle: 'bold', color: COLORS.textDim }).setOrigin(0, 0.5);

    button(this, W / 2 - 165, H - 110, 300, 76, 'PLAY', 0x06d6a0, () => {
      this.cameras.main.fadeOut(200);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HQ', { tab: 'commanders' }));
    });
    const hq = button(this, W / 2 + 165, H - 110, 300, 76, 'COMMAND HQ', 0x7b2cbf, () => this.scene.start('HQ', { tab: 'collection' }));
    if (p.fresh.length) {
      hq.add(
        this.add
          .text(130, -38, `${p.fresh.length} NEW`, { fontFamily: FONT_BODY, fontSize: '13px', fontStyle: 'bold', color: '#10131f', backgroundColor: '#06d6a0', padding: { x: 6, y: 2 } })
          .setOrigin(1, 0),
      );
    }
  }
}
