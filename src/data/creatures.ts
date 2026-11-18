import type { Element } from './elements';
import type { CreatureClass } from './traits';

/** When an ability fires. Shop triggers (buy/sell/endTurn) run in the run state; the rest in battle. */
export type Trigger =
  | 'startOfBattle'
  | 'beforeAttack'
  | 'hurt'
  | 'faint'
  | 'kill'
  | 'timer'
  | 'buy'
  | 'sell'
  | 'endTurn';

/**
 * Who an effect lands on.
 * - target: the enemy being attacked (attack/kill), or the attacker (hurt)
 * - aroundTarget: enemies near that target
 * - squad: other units from the same squad
 * - lowestAlly: allies with the lowest health % (including itself)
 */
export type Target =
  | 'self'
  | 'target'
  | 'aroundTarget'
  | 'nearestEnemy'
  | 'randomEnemy'
  | 'lowestEnemy'
  | 'allEnemies'
  | 'randomAlly'
  | 'lowestAlly'
  | 'allAllies'
  | 'squad';

export type Effect =
  | { kind: 'damage'; to: Target; amount: number; count?: number }
  | { kind: 'burn'; to: Target; stacks: number; count?: number }
  | { kind: 'chill'; to: Target; seconds: number; count?: number }
  | { kind: 'shield'; to: Target; amount: number; count?: number; element?: Element }
  | { kind: 'heal'; to: Target; amount: number; count?: number }
  | { kind: 'buff'; to: Target; atk: number; hp: number; count?: number; element?: Element }
  | { kind: 'summon'; token: string; atk: number; hp: number; count?: number }
  | { kind: 'gold'; amount: number };

export interface Ability {
  trigger: Trigger;
  /** Seconds between activations, for 'timer'. */
  every?: number;
  /** Numbers scale with level: amount, stacks, atk, hp. Counts and seconds don't. */
  effects: Effect[];
  /** {n} placeholders show n x level. */
  text: string;
}

export interface CreatureDef {
  id: string;
  name: string;
  element: Element;
  class: CreatureClass;
  tier: number;
  atk: number;
  hp: number;
  /** Units per squad at level 1. */
  squad: number;
  ranged?: boolean;
  abilities: Ability[];
  /** Tokens are summoned by abilities and never appear in the shop. */
  token?: boolean;
  /** Short role summary shown in the shop. */
  role: string;
  /** Flavor description; also feeds the art prompt. */
  look: string;
}

const list: CreatureDef[] = [
  // ── Tier 1 ──────────────────────────────────────────────
  {
    id: 'sparkit', name: 'Sparkit', element: 'plasma', class: 'gunner', tier: 1, atk: 2, hp: 6, squad: 6, ranged: true,
    role: 'Opens fights by setting the enemy ablaze.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'burn', to: 'randomEnemy', stacks: 1, count: 2 }], text: 'Start of battle: apply {1} Burn to 2 random enemies.' },
    ],
    look: 'tiny fox-like critter with a crackling plasma tail and static-charged fur',
  },
  {
    id: 'bryobit', name: 'Bryobit', element: 'bio', class: 'swarm', tier: 1, atk: 2, hp: 9, squad: 6,
    role: 'Each loss makes the rest of its squad stronger.',
    abilities: [
      { trigger: 'faint', effects: [{ kind: 'buff', to: 'squad', atk: 1, hp: 2 }], text: 'Faint: its squad-mates gain +{1}/+{2}.' },
    ],
    look: 'round mossy seed creature with leaf ears and a sprouting tuft',
  },
  {
    id: 'frostling', name: 'Frostling', element: 'cryo', class: 'vanguard', tier: 1, atk: 2, hp: 15, squad: 6,
    role: 'Cheap frontline that slows whoever hits it.',
    abilities: [
      { trigger: 'hurt', effects: [{ kind: 'chill', to: 'target', seconds: 1 }], text: 'Hurt: Chill the attacker for 1s.' },
    ],
    look: 'small penguin-like creature with an ice crystal crest and frosty breath',
  },
  {
    id: 'boltbug', name: 'Boltbug', element: 'mech', class: 'swarm', tier: 1, atk: 1, hp: 9, squad: 6,
    role: 'Upgrades your army and leaves scrap behind.',
    abilities: [
      { trigger: 'buy', effects: [{ kind: 'buff', to: 'randomAlly', atk: 1, hp: 2 }], text: 'Buy: give a random squad +{1}/+{2}.' },
      { trigger: 'faint', effects: [{ kind: 'summon', token: 'microbot', atk: 1, hp: 3 }], text: 'Faint: build a {1}/{3} Microbot.' },
    ],
    look: 'robotic beetle with glowing bolt antennae and a copper shell',
  },
  {
    id: 'nullmite', name: 'Nullmite', element: 'void', class: 'striker', tier: 1, atk: 3, hp: 6, squad: 6,
    role: 'Glass cannon that refuses to stay dead.',
    abilities: [
      { trigger: 'faint', effects: [{ kind: 'summon', token: 'voidspawn', atk: 1, hp: 3 }], text: 'Faint: a {1}/{3} Voidspawn crawls out.' },
    ],
    look: 'shadowy mite with a single starry eye and tiny claws',
  },
  // ── Tier 2 ──────────────────────────────────────────────
  {
    id: 'ionix', name: 'Ionix', element: 'plasma', class: 'gunner', tier: 2, atk: 2, hp: 9, squad: 4, ranged: true,
    role: 'Periodic chain lightning that softens whole groups.',
    abilities: [
      { trigger: 'timer', every: 3, effects: [{ kind: 'damage', to: 'randomEnemy', amount: 2, count: 3 }], text: 'Every 3s: chain lightning hits 3 random enemies for {2}.' },
    ],
    look: 'floating orb creature with orbiting electric rings',
  },
  {
    id: 'thornback', name: 'Thornback', element: 'bio', class: 'vanguard', tier: 2, atk: 2, hp: 15, squad: 4,
    role: 'Punishes melee attackers.',
    abilities: [
      { trigger: 'hurt', effects: [{ kind: 'damage', to: 'target', amount: 1 }], text: 'Hurt: deal {1} damage back to the attacker.' },
    ],
    look: 'armadillo-like creature covered in thorny vines',
  },
  {
    id: 'cryomaw', name: 'Cryomaw', element: 'cryo', class: 'gunner', tier: 2, atk: 3, hp: 9, squad: 4, ranged: true,
    role: 'Ranged control: every shot slows.',
    abilities: [
      { trigger: 'beforeAttack', effects: [{ kind: 'chill', to: 'target', seconds: 1.5 }], text: 'Attack: Chill the target for 1.5s.' },
      { trigger: 'startOfBattle', effects: [{ kind: 'buff', to: 'nearestEnemy', atk: -1, hp: 0 }], text: 'Start of battle: the nearest enemy loses {1} attack.' },
    ],
    look: 'shark-jawed lizard breathing frost',
  },
  {
    id: 'gearhound', name: 'Gearhound', element: 'mech', class: 'striker', tier: 2, atk: 3, hp: 12, squad: 4,
    role: 'Grows every turn you keep it; shields up on kills.',
    abilities: [
      { trigger: 'endTurn', effects: [{ kind: 'buff', to: 'self', atk: 0, hp: 1 }], text: 'End turn: permanently gain +{1} health.' },
      { trigger: 'kill', effects: [{ kind: 'shield', to: 'self', amount: 3 }], text: 'Kill: gain a {3} Shield.' },
    ],
    look: 'loyal robot dog with gear-shaped ears',
  },
  {
    id: 'wraithling', name: 'Wraithling', element: 'void', class: 'gunner', tier: 2, atk: 3, hp: 6, squad: 4, ranged: true,
    role: 'Its death curse finishes off the weakest enemy.',
    abilities: [
      { trigger: 'faint', effects: [{ kind: 'damage', to: 'lowestEnemy', amount: 4 }], text: 'Faint: deal {4} damage to the lowest-health enemy.' },
    ],
    look: 'ghostly wisp creature with a cosmic cloak',
  },
  // ── Tier 3 ──────────────────────────────────────────────
  {
    id: 'novaraptor', name: 'Novaraptor', element: 'plasma', class: 'striker', tier: 3, atk: 5, hp: 15, squad: 3,
    role: 'Snowballs on kills and spreads fire.',
    abilities: [
      { trigger: 'kill', effects: [{ kind: 'buff', to: 'self', atk: 2, hp: 0 }, { kind: 'burn', to: 'aroundTarget', stacks: 1 }], text: 'Kill: gain +{2} attack and apply {1} Burn to enemies around the victim.' },
    ],
    look: 'sleek raptor with a burning solar-flare crest',
  },
  {
    id: 'verdantaur', name: 'Verdantaur', element: 'bio', class: 'mystic', tier: 3, atk: 3, hp: 21, squad: 3,
    role: 'Army-wide health and steady healing.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'buff', to: 'allAllies', atk: 0, hp: 2 }], text: 'Start of battle: your whole army gains +{2} health.' },
      { trigger: 'timer', every: 5, effects: [{ kind: 'heal', to: 'lowestAlly', amount: 4, count: 3 }], text: 'Every 5s: heal the 3 most injured allies for {4}.' },
    ],
    look: 'gentle bull-like giant with a tree growing from its back',
  },
  {
    id: 'glacieron', name: 'Glacieron', element: 'cryo', class: 'mystic', tier: 3, atk: 4, hp: 21, squad: 3,
    role: 'Keeps your front line alive with ice armor.',
    abilities: [
      { trigger: 'timer', every: 4, effects: [{ kind: 'shield', to: 'lowestAlly', amount: 5, count: 3 }], text: 'Every 4s: Shield the 3 most injured allies for {5}.' },
    ],
    look: 'majestic ice stag with glacier antlers',
  },
  {
    id: 'titanode', name: 'Titanode', element: 'mech', class: 'vanguard', tier: 3, atk: 4, hp: 15, squad: 3,
    role: 'The Mech anchor: shields every machine on the field.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'allAllies', amount: 4, element: 'mech' }], text: 'Start of battle: every Mech ally gains a {4} Shield.' },
      { trigger: 'sell', effects: [{ kind: 'buff', to: 'allAllies', atk: 1, hp: 0 }], text: 'Sell: every squad gains +{1} attack.' },
    ],
    look: 'heavy mech golem with a glowing core',
  },
  {
    id: 'eclipsar', name: 'Eclipsar', element: 'void', class: 'striker', tier: 3, atk: 5, hp: 15, squad: 3,
    role: 'Ramps up the longer it fights.',
    abilities: [
      { trigger: 'beforeAttack', effects: [{ kind: 'buff', to: 'self', atk: 1, hp: 0 }], text: 'Attack: gain +{1} attack.' },
      { trigger: 'kill', effects: [{ kind: 'heal', to: 'self', amount: 5 }], text: 'Kill: heal itself for {5}.' },
    ],
    look: 'panther made of night sky with an eclipse halo',
  },
  // ── Tier 4 ──────────────────────────────────────────────
  {
    id: 'quasarion', name: 'Quasarion', element: 'plasma', class: 'mystic', tier: 4, atk: 6, hp: 18, squad: 2, ranged: true,
    role: 'Board-wide fire nukes. Pairs well with Mystics.',
    abilities: [
      { trigger: 'timer', every: 5, effects: [{ kind: 'damage', to: 'allEnemies', amount: 2 }, { kind: 'burn', to: 'allEnemies', stacks: 1 }], text: 'Every 5s: solar flare hits ALL enemies for {2} and applies {1} Burn.' },
    ],
    look: 'radiant dragon with a quasar jet for a tail',
  },
  {
    id: 'mechadon', name: 'Mechadon', element: 'mech', class: 'swarm', tier: 4, atk: 5, hp: 24, squad: 2,
    role: 'A walking drone factory.',
    abilities: [
      { trigger: 'timer', every: 6, effects: [{ kind: 'summon', token: 'drone', atk: 3, hp: 9 }], text: 'Every 6s: launch a {3}/{9} Drone.' },
      { trigger: 'faint', effects: [{ kind: 'summon', token: 'drone', atk: 3, hp: 9, count: 2 }], text: 'Faint: launch 2 more Drones.' },
    ],
    look: 'armored robot dinosaur with drone bays on its back',
  },
  {
    id: 'glaciarch', name: 'Glaciarch', element: 'cryo', class: 'vanguard', tier: 4, atk: 4, hp: 30, squad: 2,
    role: 'Freezes the whole enemy army at the start.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'chill', to: 'allEnemies', seconds: 3 }], text: 'Start of battle: Chill ALL enemies for 3s.' },
      { trigger: 'timer', every: 4, effects: [{ kind: 'shield', to: 'self', amount: 6 }], text: 'Every 4s: gain a {6} Shield.' },
    ],
    look: 'colossal ice titan beast with a glacier for a back and frozen horns',
  },
  {
    id: 'worldroot', name: 'Worldroot', element: 'bio', class: 'swarm', tier: 4, atk: 3, hp: 27, squad: 2,
    role: 'Sprouts an endless stream of saplings.',
    abilities: [
      { trigger: 'timer', every: 4, effects: [{ kind: 'summon', token: 'sproutling', atk: 2, hp: 6 }], text: 'Every 4s: sprout a {2}/{6} Sproutling.' },
      { trigger: 'faint', effects: [{ kind: 'heal', to: 'allAllies', amount: 5 }], text: 'Faint: heal your whole army for {5}.' },
    ],
    look: 'ancient walking tree spirit with glowing seed pods and root legs',
  },
  {
    id: 'singularity', name: 'Singularity', element: 'void', class: 'striker', tier: 4, atk: 7, hp: 21, squad: 2,
    role: 'Gravity crush hits everything near its target.',
    abilities: [
      { trigger: 'beforeAttack', effects: [{ kind: 'damage', to: 'aroundTarget', amount: 2 }], text: 'Attack: gravity crush deals {2} to enemies around the target.' },
      { trigger: 'kill', effects: [{ kind: 'buff', to: 'self', atk: 1, hp: 3 }], text: 'Kill: gain +{1}/+{3}.' },
    ],
    look: 'menacing black hole beast with a swirling accretion disk mane',
  },
  // ── Tokens ──────────────────────────────────────────────
  { id: 'voidspawn', name: 'Voidspawn', element: 'void', class: 'swarm', tier: 1, atk: 1, hp: 3, squad: 1, token: true, abilities: [], role: 'Summoned.', look: 'tiny wobbling blob of void' },
  { id: 'microbot', name: 'Microbot', element: 'mech', class: 'swarm', tier: 1, atk: 1, hp: 3, squad: 1, token: true, abilities: [], role: 'Summoned.', look: 'tiny boxy scrap robot on two little legs' },
  { id: 'drone', name: 'Drone', element: 'mech', class: 'swarm', tier: 1, atk: 3, hp: 9, squad: 1, token: true, abilities: [], role: 'Summoned.', look: 'small hovering combat drone' },
  { id: 'sproutling', name: 'Sproutling', element: 'bio', class: 'swarm', tier: 1, atk: 2, hp: 6, squad: 1, token: true, abilities: [], role: 'Summoned.', look: 'small walking sapling with leaf hands' },
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

/** Ability texts with {n} placeholders filled in for the given level. */
export function abilityTexts(def: CreatureDef, level: number): string[] {
  return def.abilities.map((a) => a.text.replace(/\{(\d+)\}/g, (_, n) => String(scaled(Number(n), level))));
}
