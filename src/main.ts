import '@fontsource/russo-one/400.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/400-italic.css';
import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { HQScene } from './scenes/HQScene';
import { ShopScene } from './scenes/ShopScene';
import { TitleScene } from './scenes/TitleScene';
import { H } from './ui/theme';
import { viewWidth, watchWindow } from './ui/viewport';

async function start() {
  // Make sure web fonts are ready before Phaser rasterizes any text.
  await Promise.allSettled([
    document.fonts.load('32px "Russo One"'),
    document.fonts.load('bold 20px "Nunito"'),
    document.fonts.load('20px "Nunito"'),
  ]);

  // Exposed for automated browser tests and debugging.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: viewWidth(),
    height: H,
    backgroundColor: '#0b0f1e',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false, mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
    input: { activePointers: 2 },
    scene: [BootScene, TitleScene, HQScene, ShopScene, BattleScene, GameOverScene],
  });
  watchWindow(game);
  // Exposed for automated browser tests and debugging.
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

void start();
