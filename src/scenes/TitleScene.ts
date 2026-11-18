import Phaser from 'phaser';
import { artScale, creatureKey } from '../art/creatureArt';
import { onlineEnabled } from '../config';
import { playerName, setPlayerName } from '../game/player';
import { Run, WINS_TO_VICTORY } from '../game/run';
import { FONT_BODY, FONT_DISPLAY, H, W } from '../ui/theme';
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
    const showName = () => nameText.setText(`Commander: ${playerName()}   (tap to rename)`);
    showName();
    nameText.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      const next = window.prompt('Commander name (shown to opponents):', playerName());
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

    button(this, W / 2, H - 110, 300, 76, 'PLAY', 0x06d6a0, () => {
      this.registry.set('run', new Run());
      this.cameras.main.fadeOut(250);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Shop'));
    });
  }
}
