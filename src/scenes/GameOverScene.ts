import Phaser from 'phaser';
import type { Run } from '../game/run';
import { FONT_BODY, FONT_DISPLAY, H, W } from '../ui/theme';
import { button, drawBackground } from '../ui/widgets';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create() {
    const run: Run = this.registry.get('run');
    const won = run.status === 'won';
    drawBackground(this, 99);
    this.add
      .text(W / 2, 220, won ? 'CHAMPION!' : 'GAME OVER', {
        fontFamily: FONT_DISPLAY,
        fontSize: '96px',
        color: won ? '#ffd166' : '#ef476f',
        stroke: '#000000',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 330, `${run.wins} wins  ·  reached round ${run.round}`, {
        fontFamily: FONT_BODY,
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#e8ecff',
      })
      .setOrigin(0.5);
    button(this, W / 2, H - 160, 320, 76, 'PLAY AGAIN', 0x06d6a0, () => this.scene.start('Title'));
  }
}
