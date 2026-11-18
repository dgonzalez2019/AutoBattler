// Generates creature art with the OpenAI Images API.
//   OPENAI_API_KEY=... node scripts/generate-art.mjs [id ...] [--force]
// Writes src/assets/creatures/<id>.webp (512x512, transparent). Existing files are skipped unless --force.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import sharp from 'sharp';

const MODEL = process.env.ART_MODEL ?? 'gpt-image-1.5';
const OUT = new URL('../src/assets/creatures/', import.meta.url);
const RAW = new URL('../art-source/', import.meta.url);

const PALETTE = {
  plasma: 'fiery orange and golden yellow with glowing plasma energy',
  mech: 'steel grey and electric cyan with metallic plating and glowing lights',
  cryo: 'icy light blue and white with frost crystals',
  bio: 'leafy green and cream with organic plant features',
  void: 'deep purple and lavender with starry cosmic patterns',
};

const STYLE = [
  'Original creature design for a sci-fi monster-collecting autobattler game.',
  'Style: polished 2D game sprite, glossy cel shading, bold clean dark outline, vibrant saturated colors,',
  'cute but cool chibi proportions, strong readable silhouette, full body visible.',
  'Pose: three-quarter side view, facing RIGHT, standing ready for battle, centered in frame.',
  'Isolated on a fully transparent background. No text, no frame, no ground, no shadow, no scenery.',
].join(' ');

async function loadCreatures() {
  // Parse the roster straight from the TypeScript source so there is one source of truth.
  const src = await readFile(new URL('../src/data/creatures.ts', import.meta.url), 'utf8');
  const re = /id: '(\w+)', name: '(\w+)', element: '(\w+)', class: '(\w+)', rarity: (\d)[\s\S]*?look: '([^']*)'/g;
  return [...src.matchAll(re)].map(([, id, name, element, cls, rarity, look]) => ({ id, name, element, cls, rarity: +rarity, look }));
}

function prompt(c) {
  const size = [
    'a small, cute, basic',
    'a mid-sized, capable-looking',
    'a strong, evolved-looking',
    'a large, powerful, imposing',
    'a legendary, majestic, awe-inspiring and highly detailed',
  ][c.rarity - 1];
  return `${STYLE} The creature is ${size} ${c.look}. Color palette: ${PALETTE[c.element]}. Name: ${c.name}.`;
}

async function generate(c) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, prompt: prompt(c), size: '1024x1024', background: 'transparent', quality: 'medium', n: 1 }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${c.id}: ${res.status} ${JSON.stringify(body.error ?? body)}`);
  const png = Buffer.from(body.data[0].b64_json, 'base64');
  await mkdir(RAW, { recursive: true });
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL(`${c.id}.png`, RAW), png);
  await writeFile(new URL(`${c.id}.webp`, OUT), await toSprite(png, FLIP.has(c.id)));
  console.log(`ok ${c.id}`);
}

/** Creatures the model drew facing left; mirrored so every sprite faces right. */
const FLIP = new Set(['frostling', 'gearhound', 'mechadon', 'emberpup', 'pyrolisk', 'railhawk', 'blizzowl', 'mantidra']);

/** Trim empty space, fit into a 256px square (high-quality downscale), mirror if needed. */
export async function toSprite(png, flip) {
  let img = sharp(png)
    .trim({ threshold: 10 })
    .resize(232, 232, { fit: 'contain', kernel: 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (flip) img = img.flop();
  return img.webp({ quality: 92, alphaQuality: 100 }).toBuffer();
}

const args = process.argv.slice(2);
const force = args.includes('--force');
if (args.includes('--reexport')) {
  // Rebuild sprites from the saved originals in art-source/ (no API calls).
  for (const c of await loadCreatures()) {
    const png = await readFile(new URL(`${c.id}.png`, RAW)).catch(() => null);
    if (!png) continue;
    await writeFile(new URL(`${c.id}.webp`, OUT), await toSprite(png, FLIP.has(c.id)));
    console.log(`re-exported ${c.id}`);
  }
  process.exit(0);
}
const only = args.filter((a) => !a.startsWith('--'));
const all = await loadCreatures();
const todo = [];
for (const c of all) {
  if (only.length && !only.includes(c.id)) continue;
  const exists = await access(new URL(`${c.id}.webp`, OUT)).then(() => true, () => false);
  if (exists && !force) continue;
  todo.push(c);
}
console.log(`generating ${todo.length} of ${all.length} creatures with ${MODEL}`);
// A few at a time to stay well within rate limits.
for (let i = 0; i < todo.length; i += 4) {
  const results = await Promise.allSettled(todo.slice(i, i + 4).map(generate));
  for (const r of results) if (r.status === 'rejected') console.error(String(r.reason));
}
