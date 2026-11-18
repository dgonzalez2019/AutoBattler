import type { Element } from './elements';

/** When an ability fires. Battle triggers run in the sim; shop triggers run in the run state. */
export type Trigger =
  | 'startOfBattle'
  | 'beforeAttack'
  | 'hurt'
  | 'faint'
  | 'buy'
  | 'sell'
  | 'endTurn';

export type Effect =
  | { kind: 'damageRandomEnemy'; amount: number }
  | { kind: 'damageLowestEnemy'; amount: number }
  | { kind: 'damageAllEnemies'; amount: number }
  | { kind: 'damageFrontEnemy'; amount: number }
  | { kind: 'damageSecondEnemy'; amount: number }
  | { kind: 'debuffFrontEnemyAtk'; amount: number }
  | { kind: 'buffSelf'; atk: number; hp: number }
  | { kind: 'buffRandomAlly'; atk: number; hp: number }
  | { kind: 'buffAllAllies'; atk: number; hp: number }
  | { kind: 'summon'; token: string; atk: number; hp: number };

export interface Ability {
  trigger: Trigger;
  /** Base effect at level 1. Numbers scale linearly with level. */
  effect: Effect;
  text: string;
}

export interface CreatureDef {
  id: string;
  name: string;
  element: Element;
  tier: number;
  atk: number;
  hp: number;
  ability?: Ability;
  /** Tokens are summoned by abilities and never appear in the shop. */
  token?: boolean;
  /** Short flavor line, also used as the seed for the art prompt. */
  look: string;
}

const list: CreatureDef[] = [
  // ── Tier 1 ──────────────────────────────────────────────
  {
    id: 'sparkit', name: 'Sparkit', element: 'plasma', tier: 1, atk: 2, hp: 2,
    ability: { trigger: 'startOfBattle', effect: { kind: 'damageRandomEnemy', amount: 1 }, text: 'Start of battle: zap a random enemy for {1}.' },
    look: 'tiny fox-like critter with a crackling plasma tail',
  },
  {
    id: 'bryobit', name: 'Bryobit', element: 'bio', tier: 1, atk: 2, hp: 3,
    ability: { trigger: 'faint', effect: { kind: 'buffRandomAlly', atk: 1, hp: 1 }, text: 'Faint: give a random ally +{1}/+{1}.' },
    look: 'round mossy seed creature with leaf ears',
  },
  {
    id: 'frostling', name: 'Frostling', element: 'cryo', tier: 1, atk: 1, hp: 4,
    ability: { trigger: 'hurt', effect: { kind: 'buffSelf', atk: 1, hp: 0 }, text: 'Hurt: gain +{1} attack.' },
    look: 'small penguin-like creature with an ice crystal crest',
  },
  {
    id: 'boltbug', name: 'Boltbug', element: 'mech', tier: 1, atk: 1, hp: 3,
    ability: { trigger: 'buy', effect: { kind: 'buffRandomAlly', atk: 1, hp: 1 }, text: 'Buy: give a random ally +{1}/+{1}.' },
    look: 'robotic beetle with glowing bolt antennae',
  },
  {
    id: 'nullmite', name: 'Nullmite', element: 'void', tier: 1, atk: 3, hp: 1,
    ability: { trigger: 'faint', effect: { kind: 'summon', token: 'voidspawn', atk: 1, hp: 1 }, text: 'Faint: summon a {1}/{1} Voidspawn.' },
    look: 'shadowy mite with a single starry eye',
  },
  // ── Tier 2 ──────────────────────────────────────────────
  {
    id: 'ionix', name: 'Ionix', element: 'plasma', tier: 2, atk: 3, hp: 3,
    ability: { trigger: 'beforeAttack', effect: { kind: 'damageSecondEnemy', amount: 1 }, text: 'Before attack: arc {1} damage to the 2nd enemy.' },
    look: 'floating orb creature with orbiting electric rings',
  },
  {
    id: 'thornback', name: 'Thornback', element: 'bio', tier: 2, atk: 2, hp: 5,
    ability: { trigger: 'hurt', effect: { kind: 'damageFrontEnemy', amount: 1 }, text: 'Hurt: deal {1} damage to the front enemy.' },
    look: 'armadillo-like creature covered in thorny vines',
  },
  {
    id: 'cryomaw', name: 'Cryomaw', element: 'cryo', tier: 2, atk: 3, hp: 4,
    ability: { trigger: 'startOfBattle', effect: { kind: 'debuffFrontEnemyAtk', amount: 1 }, text: 'Start of battle: front enemy loses {1} attack.' },
    look: 'shark-jawed lizard breathing frost',
  },
  {
    id: 'gearhound', name: 'Gearhound', element: 'mech', tier: 2, atk: 3, hp: 3,
    ability: { trigger: 'endTurn', effect: { kind: 'buffSelf', atk: 0, hp: 1 }, text: 'End turn: gain +{1} health.' },
    look: 'loyal robot dog with gear-shaped ears',
  },
  {
    id: 'wraithling', name: 'Wraithling', element: 'void', tier: 2, atk: 4, hp: 2,
    ability: { trigger: 'faint', effect: { kind: 'damageRandomEnemy', amount: 2 }, text: 'Faint: deal {2} damage to a random enemy.' },
    look: 'ghostly wisp creature with a cosmic cloak',
  },
  // ── Tier 3 ──────────────────────────────────────────────
  {
    id: 'novaraptor', name: 'Novaraptor', element: 'plasma', tier: 3, atk: 5, hp: 4,
    ability: { trigger: 'startOfBattle', effect: { kind: 'damageLowestEnemy', amount: 2 }, text: 'Start of battle: deal {2} to the weakest enemy.' },
    look: 'sleek raptor with a burning solar-flare crest',
  },
  {
    id: 'verdantaur', name: 'Verdantaur', element: 'bio', tier: 3, atk: 3, hp: 7,
    ability: { trigger: 'startOfBattle', effect: { kind: 'buffAllAllies', atk: 0, hp: 1 }, text: 'Start of battle: give all allies +{1} health.' },
    look: 'gentle bull-like giant with a tree growing from its back',
  },
  {
    id: 'glacieron', name: 'Glacieron', element: 'cryo', tier: 3, atk: 4, hp: 6,
    ability: { trigger: 'hurt', effect: { kind: 'buffRandomAlly', atk: 0, hp: 2 }, text: 'Hurt: give a random ally +{2} health.' },
    look: 'majestic ice stag with glacier antlers',
  },
  {
    id: 'titanode', name: 'Titanode', element: 'mech', tier: 3, atk: 4, hp: 5,
    ability: { trigger: 'sell', effect: { kind: 'buffAllAllies', atk: 1, hp: 0 }, text: 'Sell: give all allies +{1} attack.' },
    look: 'heavy mech golem with a glowing core',
  },
  {
    id: 'eclipsar', name: 'Eclipsar', element: 'void', tier: 3, atk: 6, hp: 3,
    ability: { trigger: 'beforeAttack', effect: { kind: 'buffSelf', atk: 1, hp: 0 }, text: 'Before attack: gain +{1} attack.' },
    look: 'panther made of night sky with an eclipse halo',
  },
  // ── Tier 4 ──────────────────────────────────────────────
  {
    id: 'quasarion', name: 'Quasarion', element: 'plasma', tier: 4, atk: 6, hp: 6,
    ability: { trigger: 'startOfBattle', effect: { kind: 'damageAllEnemies', amount: 1 }, text: 'Start of battle: deal {1} to all enemies.' },
    look: 'radiant dragon with a quasar jet for a tail',
  },
  {
    id: 'mechadon', name: 'Mechadon', element: 'mech', tier: 4, atk: 5, hp: 8,
    ability: { trigger: 'faint', effect: { kind: 'summon', token: 'drone', atk: 3, hp: 3 }, text: 'Faint: summon a {3}/{3} Drone.' },
    look: 'armored robot dinosaur with drone bays on its back',
  },
  // ── Tokens ──────────────────────────────────────────────
  { id: 'voidspawn', name: 'Voidspawn', element: 'void', tier: 1, atk: 1, hp: 1, token: true, look: 'tiny wobbling blob of void' },
  { id: 'drone', name: 'Drone', element: 'mech', tier: 1, atk: 3, hp: 3, token: true, look: 'small hovering combat drone' },
];

export const CREATURES: Record<string, CreatureDef> = Object.fromEntries(list.map((c) => [c.id, c]));

export const SHOP_POOL = list.filter((c) => !c.token);

export function getDef(id: string): CreatureDef {
  const def = CREATURES[id];
  if (!def) throw new Error(`Unknown creature: ${id}`);
  return def;
}

/** Scale an ability number by level (level 1 = base). */
export function scaled(n: number, level: number): number {
  return n * level;
}

/** Ability text with {n} placeholders filled in for the given level. */
export function abilityText(def: CreatureDef, level: number): string {
  if (!def.ability) return '';
  return def.ability.text.replace(/\{(\d+)\}/g, (_, n) => String(scaled(Number(n), level)));
}
