// Generates creature art with the OpenAI Images API.
//   OPENAI_API_KEY=... node scripts/generate-art.mjs [id ...] [--force]
// Writes src/assets/creatures/<id>.webp (512x512, transparent). Existing files are skipped unless --force.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import sharp from 'sharp';

const MODEL = process.env.ART_MODEL ?? 'gpt-image-1.5';
const OUT = new URL('../src/assets/creatures/', import.meta.url);
const RAW = new URL('../art-source/', import.meta.url);
const CMD_OUT = new URL('../src/assets/commanders/', import.meta.url);

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
const FLIP = new Set(['frostling', 'gearhound', 'mechadon', 'emberpup', 'pyrolisk', 'railhawk', 'blizzowl', 'mantidra', 'hammerhead', 'starbreaker', 'leechling', 'abyssal', 'novaraptor']);
/** Evolved forms ("id@stage") the model drew facing left. */
const FLIP_EVO = new Set(['novaraptor@2', 'novaraptor@3']);

/** Trim empty space, fit into a 256px square (high-quality downscale), mirror if needed. */
export async function toSprite(png, flip) {
  let img = sharp(png)
    .trim({ threshold: 10 })
    .resize(232, 232, { fit: 'contain', kernel: 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (flip) img = img.flop();
  return img.webp({ quality: 92, alphaQuality: 100 }).toBuffer();
}

// ── Commander portraits ───────────────────────────────────

async function loadCommanders() {
  const src = await readFile(new URL('../src/data/commanders.ts', import.meta.url), 'utf8');
  const re = /id: '(\w+)', name: '([^']+)', title: '([^']+)'[\s\S]*?look: '([^']*)'/g;
  return [...src.matchAll(re)].map(([, id, name, title, look]) => ({ id, name, title, look }));
}

async function generateCommanders(only, force) {
  const all = await loadCommanders();
  await mkdir(CMD_OUT, { recursive: true });
  await mkdir(RAW, { recursive: true });
  const todo = [];
  for (const c of all) {
    if (only.length && !only.includes(c.id)) continue;
    const exists = await access(new URL(`${c.id}.webp`, CMD_OUT)).then(() => true, () => false);
    if (!exists || force) todo.push(c);
  }
  console.log(`generating ${todo.length} of ${all.length} commander portraits with ${MODEL}`);
  const one = async (c) => {
    const prompt = [
      'Original character portrait for a sci-fi monster-collecting autobattler game.',
      'Style: polished 2D game art, glossy cel shading, bold clean dark outline, vibrant colors, matching a cute-but-cool creature roster.',
      'Framing: head-and-shoulders bust, facing the viewer at a slight angle, centered, expressive and heroic.',
      'Isolated on a fully transparent background. No text, no frame, no scenery.',
      `The character is ${c.name}, the ${c.title}: ${c.look}.`,
    ].join(' ');
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, prompt, size: '1024x1024', background: 'transparent', quality: 'medium', n: 1 }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`${c.id}: ${res.status} ${JSON.stringify(body.error ?? body)}`);
    const png = Buffer.from(body.data[0].b64_json, 'base64');
    await writeFile(new URL(`cmd-${c.id}.png`, RAW), png);
    const out = await sharp(png)
      .trim({ threshold: 10 })
      .resize(232, 232, { fit: 'contain', kernel: 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100 })
      .toBuffer();
    await writeFile(new URL(`${c.id}.webp`, CMD_OUT), out);
    console.log(`ok ${c.id}`);
  };
  for (let i = 0; i < todo.length; i += 4) {
    const results = await Promise.allSettled(todo.slice(i, i + 4).map(one));
    for (const r of results) if (r.status === 'rejected') console.error(String(r.reason));
  }
}

// ── Evolutions ────────────────────────────────────────────
async function loadEvolutions() {
  const src = await readFile(new URL('../src/data/evolutions.ts', import.meta.url), 'utf8');
  return Object.fromEntries([...src.matchAll(/^  (\w+): \['(\w+)', '(\w+)'\]/gm)].map(([, id, a, b]) => [id, [a, b]]));
}

const STAGE_TEXT = {
  2: 'Draw its EVOLVED form (stage 2 of 3): bigger, more confident and more powerful, with more developed features and a few new details.',
  3: 'Draw its FINAL evolution (stage 3 of 3): a large, majestic, fully-powered apex form with impressive new features and a heroic presence.',
};

class OutOfCredits extends Error {}

async function generateEvolutions(stages, only, force) {
  const creatures = Object.fromEntries((await loadCreatures()).map((c) => [c.id, c]));
  const evos = await loadEvolutions();
  for (const stage of stages) {
    const todo = [];
    for (const id of Object.keys(evos)) {
      if (only.length && !only.includes(id)) continue;
      const out = new URL(`${id}@${stage}.webp`, OUT);
      const exists = await access(out).then(() => true, () => false);
      if (exists && !force) continue;
      todo.push(id);
    }
    console.log(`stage ${stage}: generating ${todo.length} evolutions`);
    const one = async (id) => {
      const c = creatures[id];
      // Stage 2 builds on the base art; stage 3 on stage 2, so each line stays consistent.
      const srcFile = stage === 2 ? `${id}.png` : `${id}@2.png`;
      let input = await readFile(new URL(srcFile, RAW)).catch(() => null);
      if (!input) throw new Error(`${id}@${stage}: missing art-source/${srcFile}`);
      // Feed a right-facing reference so the evolution faces right too.
      if (stage === 2 && FLIP.has(id)) input = await sharp(input).flop().png().toBuffer();
      const name = evos[id][stage - 2];
      const prompt = [
        'This is a creature from a sci-fi monster-collecting game.',
        STAGE_TEXT[stage],
        'Keep the same species identity, color palette, element theme and art style (glossy cel shading, bold clean dark outline). It must clearly be the same creature line, not a different creature.',
        'Full body, three-quarter side view facing RIGHT, centered. Fully transparent background, no text, no ground, no shadow.',
        `It is now named ${name}. Original concept: ${c.look}.`,
      ].join(' ');
      const form = new FormData();
      form.append('model', MODEL);
      form.append('image[]', new Blob([input], { type: 'image/png' }), 'base.png');
      form.append('prompt', prompt);
      form.append('background', 'transparent');
      form.append('quality', 'medium');
      form.append('size', '1024x1024');
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
      });
      const body = await res.json();
      if (!res.ok) {
        const code = body.error?.code ?? '';
        if (res.status === 429 && /credit|quota/.test(code + (body.error?.type ?? ''))) throw new OutOfCredits(code);
        throw new Error(`${id}@${stage}: ${res.status} ${JSON.stringify(body.error ?? body)}`);
      }
      const png = Buffer.from(body.data[0].b64_json, 'base64');
      await writeFile(new URL(`${id}@${stage}.png`, RAW), png);
      await writeFile(new URL(`${id}@${stage}.webp`, OUT), await toSprite(png, FLIP_EVO.has(`${id}@${stage}`)));
      console.log(`ok ${id}@${stage} (${name})`);
    };
    for (let i = 0; i < todo.length; i += 4) {
      const results = await Promise.allSettled(todo.slice(i, i + 4).map(one));
      for (const r of results) if (r.status === 'rejected') console.error(String(r.reason));
      if (results.some((r) => r.status === 'rejected' && r.reason instanceof OutOfCredits)) {
        console.error('STOPPED: out of OpenAI credits. Re-run later to continue where this left off.');
        return;
      }
    }
  }
}

// ── Mothership ────────────────────────────────────────────
async function generateMothership() {
  const prompt = [
    'Original spaceship art for a sci-fi monster-collecting autobattler game: the player\'s MOTHERSHIP, a large carrier home base.',
    'Style: polished 2D game art, glossy cel shading, bold clean dark outline, vibrant colors, matching cute-but-cool creature art.',
    'Sleek rounded hull in white and deep purple with cyan glowing engines, hangar bays, a big dish antenna, a turret cannon and a medical module with a green cross light.',
    'Side view, flying toward the RIGHT, slightly from above, centered, whole ship visible. Fully transparent background, no text, no stars, no scenery.',
  ].join(' ');
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, prompt, size: '1536x1024', background: 'transparent', quality: 'medium', n: 1 }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`mothership: ${res.status} ${JSON.stringify(body.error ?? body)}`);
  const png = Buffer.from(body.data[0].b64_json, 'base64');
  await mkdir(RAW, { recursive: true });
  await writeFile(new URL('mothership.png', RAW), png);
  const out = await sharp(png)
    .trim({ threshold: 10 })
    .resize(480, 320, { fit: 'contain', kernel: 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .flop() // the model drew it facing left; the game wants it facing right
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer();
  await writeFile(new URL('../src/assets/mothership.webp', import.meta.url), out);
  console.log('ok mothership');
}

// ── Main (kept last so every definition above is initialised) ──
const args = process.argv.slice(2);
const force = args.includes('--force');

if (args.includes('--evolutions')) {
  const stages = args.includes('--stage3') ? [3] : args.includes('--stage2') ? [2] : [2, 3];
  await generateEvolutions(stages, args.filter((a) => !a.startsWith('--')), force);
  process.exit(0);
}

if (args.includes('--mothership')) {
  await generateMothership();
  process.exit(0);
}

if (args.includes('--commanders')) {
  await generateCommanders(args.filter((a) => !a.startsWith('--')), force);
  process.exit(0);
}
if (args.includes('--reexport')) {
  // Rebuild sprites from the saved originals in art-source/ (no API calls).
  for (const c of await loadCreatures()) {
    const png = await readFile(new URL(`${c.id}.png`, RAW)).catch(() => null);
    if (!png) continue;
    await writeFile(new URL(`${c.id}.webp`, OUT), await toSprite(png, FLIP.has(c.id)));
    console.log(`re-exported ${c.id}`);
    for (const stage of [2, 3]) {
      const evo = await readFile(new URL(`${c.id}@${stage}.png`, RAW)).catch(() => null);
      if (!evo) continue;
      await writeFile(new URL(`${c.id}@${stage}.webp`, OUT), await toSprite(evo, FLIP_EVO.has(`${c.id}@${stage}`)));
    }
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

