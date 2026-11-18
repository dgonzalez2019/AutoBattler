import Phaser from 'phaser';
import { COMMANDER_LIST } from '../data/commanders';

/** Commander portraits: src/assets/commanders/<id>.webp, with a lettered placeholder fallback. */
const files = import.meta.glob('../assets/commanders/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const commanderKey = (id: string) => `commander-${id}`;

export function preloadCommanderArt(scene: Phaser.Scene) {
  for (const [path, url] of Object.entries(files)) {
    const id = path.split('/').pop()!.replace(/\.(png|webp)$/, '');
    scene.load.image(commanderKey(id), url);
  }
}

export function ensureCommanderTextures(scene: Phaser.Scene) {
  for (const c of COMMANDER_LIST) {
    const key = commanderKey(c.id);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(c.color).fillCircle(128, 128, 120);
    g.lineStyle(8, 0xffffff, 0.8).strokeCircle(128, 128, 120);
    g.generateTexture(key, 256, 256);
    g.destroy();
  }
}

/** A round commander badge: portrait over a ring in the commander's color. */
export function commanderBadge(scene: Phaser.Scene, x: number, y: number, id: string, color: number, size: number) {
  const c = scene.add.container(x, y);
  const ring = scene.add.graphics();
  ring.fillStyle(0x0b0f1e, 1).fillCircle(0, 0, size / 2);
  ring.fillStyle(color, 0.35).fillCircle(0, 0, size / 2);
  ring.lineStyle(Math.max(2, size / 22), color, 1).strokeCircle(0, 0, size / 2);
  const img = scene.add.image(0, 0, commanderKey(id));
  img.setScale((size * 1.02) / img.width);
  // Circular crop
  const maskShape = scene.make.graphics({ x: 0, y: 0 }, false).fillCircle(0, 0, size / 2 - 2);
  c.add([ring, img]);
  const updateMask = () => maskShape.setPosition(c.x, c.y);
  updateMask();
  img.setMask(maskShape.createGeometryMask());
  c.once('destroy', () => maskShape.destroy());
  return c;
}
