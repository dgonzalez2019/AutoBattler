import Phaser from 'phaser';
import { ensureCommanderTextures, preloadCommanderArt } from '../art/commanderArt';
import { ensureCreatureTextures, preloadCreatureArt } from '../art/creatureArt';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    preloadCreatureArt(this);
    preloadCommanderArt(this);
  }

  create() {
    ensureCreatureTextures(this);
    ensureCommanderTextures(this);
    this.scene.start('Title');
  }
}
