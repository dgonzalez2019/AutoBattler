import Phaser from 'phaser';
import { CREATURES, type CreatureDef } from '../data/creatures';
import { ELEMENT_INFO } from '../data/elements';

/**
 * Real creature art lives in src/assets/creatures/<id>.png (or .webp).
 * Any creature without a file gets a procedurally drawn placeholder,
 * so art can be dropped in one creature at a time with no code changes.
 */
const files = import.meta.glob('../assets/creatures/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const ART_SIZE = 256;

export function creatureKey(id: string): string {
  return `creature-${id}`;
}

function artUrls(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) {
    const id = path.split('/').pop()!.replace(/\.(png|webp)$/, '');
    if (CREATURES[id]) out[id] = url;
  }
  return out;
}

const REAL_ART = new Set(Object.keys(artUrls()));

/** Real art fills its frame edge to edge; placeholders leave padding. This evens them out. */
const REAL_FILL = 0.85;

/** Scale that draws a creature roughly `size` pixels tall, whatever its texture resolution. */
export function artScale(scene: Phaser.Scene, id: string, size: number): number {
  const src = scene.textures.get(creatureKey(id)).getSourceImage() as { width: number };
  return (size / src.width) * (REAL_ART.has(id) ? REAL_FILL : 1);
}

/** Call from a scene's preload(). */
export function preloadCreatureArt(scene: Phaser.Scene) {
  for (const [id, url] of Object.entries(artUrls())) scene.load.image(creatureKey(id), url);
}

/** Call from a scene's create(): draws placeholders for anything without real art. */
export function ensureCreatureTextures(scene: Phaser.Scene) {
  for (const def of Object.values(CREATURES)) {
    const key = creatureKey(def.id);
    if (!scene.textures.exists(key)) drawPlaceholder(scene, def, key);
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shade(color: number, f: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const adj = (v: number) => Phaser.Math.Clamp(Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f), 0, 255);
  return Phaser.Display.Color.GetColor(adj(c.red), adj(c.green), adj(c.blue));
}

/** Chunky, outlined "creature" silhouette in the element's colors, facing right. */
function drawPlaceholder(scene: Phaser.Scene, def: CreatureDef, key: string) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const { color, accent } = ELEMENT_INFO[def.element];
  const outline = shade(color, 0.35);
  const h = hash(def.id);
  const s = ART_SIZE;
  const cx = s / 2;
  const scale = def.token ? 0.7 : 0.82 + def.rarity * 0.045;
  const rx = 74 * scale * (0.9 + ((h & 7) / 7) * 0.25);
  const ry = 62 * scale * (0.9 + (((h >> 3) & 7) / 7) * 0.25);
  const cy = s * 0.6;

  // Ground shadow
  g.fillStyle(0x000000, 0.25).fillEllipse(cx, cy + ry * 0.95, rx * 1.6, ry * 0.35);

  // Element features drawn behind the body
  g.lineStyle(6, outline, 1);
  const top = cy - ry;
  switch (def.element) {
    case 'plasma':
      for (const [dx, hgt] of [[-0.45, 0.8], [0, 1.1], [0.45, 0.8]]) {
        const x = cx + dx * rx;
        const pts = [x - 18 * scale, top + 14, x + dx * 10, top - 46 * scale * hgt, x + 18 * scale, top + 14];
        g.fillStyle(accent).fillTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
        g.strokeTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
      }
      break;
    case 'cryo':
      for (const dx of [-0.35, 0.05, 0.4]) {
        const x = cx + dx * rx;
        const pts = [x - 13, top + 16, x, top - 48 * scale, x + 13, top + 16];
        g.fillStyle(accent).fillTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
        g.strokeTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
      }
      break;
    case 'bio':
      for (const dir of [-1, 1]) {
        const x = cx + dir * rx * 0.35;
        g.fillStyle(accent).fillEllipse(x + dir * 14, top - 6, 34 * scale, 64 * scale);
        g.strokeEllipse(x + dir * 14, top - 6, 34 * scale, 64 * scale);
      }
      break;
    case 'mech':
      g.lineStyle(6, outline).lineBetween(cx + rx * 0.1, top + 10, cx + rx * 0.25, top - 42 * scale);
      g.fillStyle(accent).fillCircle(cx + rx * 0.25, top - 42 * scale, 11);
      g.strokeCircle(cx + rx * 0.25, top - 42 * scale, 11);
      break;
    case 'void':
      for (const dir of [-1, 1]) {
        const x = cx + dir * rx * 0.45;
        const pts = [x - 14, top + 18, x + dir * 22, top - 40 * scale, x + 14, top + 12];
        g.fillStyle(shade(color, 0.6)).fillTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
        g.strokeTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
      }
      break;
  }

  // Feet
  g.fillStyle(shade(color, 0.7));
  for (const dx of [-0.45, 0.35]) {
    g.fillEllipse(cx + dx * rx, cy + ry * 0.8, 36 * scale, 22 * scale);
    g.lineStyle(5, outline).strokeEllipse(cx + dx * rx, cy + ry * 0.8, 36 * scale, 22 * scale);
  }

  // Tail (behind-left)
  g.fillStyle(shade(color, 0.85)).fillEllipse(cx - rx * 0.95, cy - ry * 0.05, 40 * scale, 26 * scale);
  g.lineStyle(5, outline).strokeEllipse(cx - rx * 0.95, cy - ry * 0.05, 40 * scale, 26 * scale);

  // Body with simple cel shading
  g.fillStyle(shade(color, 0.75)).fillEllipse(cx, cy, rx * 2, ry * 2);
  g.fillStyle(color).fillEllipse(cx - rx * 0.06, cy - ry * 0.08, rx * 1.85, ry * 1.8);
  g.fillStyle(shade(color, 1.35)).fillEllipse(cx + rx * 0.2, cy + ry * 0.25, rx * 0.95, ry * 0.9);
  g.fillStyle(0xffffff, 0.35).fillEllipse(cx - rx * 0.35, cy - ry * 0.5, rx * 0.5, ry * 0.28);
  g.lineStyle(7, outline).strokeEllipse(cx, cy, rx * 2, ry * 2);

  // Element markings
  if (def.element === 'mech') {
    g.lineStyle(4, shade(color, 0.5));
    g.strokeRect(cx - rx * 0.55, cy + ry * 0.05, 18, 18);
    g.fillStyle(accent).fillCircle(cx - rx * 0.55 + 9, cy + ry * 0.05 + 9, 5);
  } else if (def.element === 'void') {
    g.fillStyle(accent, 0.9);
    for (let i = 0; i < 5; i++) g.fillCircle(cx - rx * 0.6 + ((h >> i) & 15) * 4, cy + ((h >> (i + 4)) & 15) * 3 - 10, 2.5);
  }

  // Eyes, looking right
  const eyeY = cy - ry * 0.2;
  const eyeX = cx + rx * 0.3;
  const gap = 26 * scale + ((h >> 6) & 3) * 3;
  const eyeR = (def.element === 'void' ? 15 : 13) * scale;
  const eyes = def.element === 'void' && !def.token ? [eyeX + gap / 2] : [eyeX, eyeX + gap];
  for (const ex of eyes) {
    g.fillStyle(0xffffff).fillEllipse(ex, eyeY, eyeR * 2, eyeR * 2.3);
    g.lineStyle(4, outline).strokeEllipse(ex, eyeY, eyeR * 2, eyeR * 2.3);
    g.fillStyle(0x111122).fillCircle(ex + eyeR * 0.3, eyeY + 1, eyeR * 0.6);
    g.fillStyle(0xffffff).fillCircle(ex + eyeR * 0.45, eyeY - eyeR * 0.3, eyeR * 0.25);
  }

  g.generateTexture(key, s, s);
  g.destroy();
}
