import Phaser from 'phaser';
import { ensureCreatureTextures, preloadCreatureArt } from '../art/creatureArt';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    preloadCreatureArt(this);
  }

  create() {
    ensureCreatureTextures(this);
    this.scene.start('Title');
  }
}
