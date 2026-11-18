import type { Element } from './elements';
import type { Rarity } from './rarity';
import type { CreatureClass } from './traits';

/** When an ability fires. Shop triggers (buy/sell/endTurn) run in the run state; the rest in battle. */
export type Trigger =
  | 'startOfBattle'
  | 'beforeAttack'
  | 'hurt'
  | 'faint'
  | 'kill'
  | 'allyFaint'
  | 'timer'
  | 'buy'
  | 'sell'
  | 'endTurn';

/**
 * Who an effect lands on.
 * - target: the enemy being attacked (attack/kill), or the attacker (hurt)
 * - aroundTarget: enemies near that target
 * - aroundSelf: enemies near this creature
 * - squad: other units from the same squad
 * - lowestAlly: allies with the lowest health % (including itself)
 */
export type Target =
  | 'self'
  | 'target'
  | 'aroundTarget'
  | 'aroundSelf'
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
  /** Shop only. On end turn the gold is banked for next turn; otherwise it's immediate. */
  | { kind: 'gold'; amount: number }
  /** Faint only: come back once at a share of max health. */
  | { kind: 'rebirth'; hpPct: number };

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
  /** 1 Common, 2 Uncommon, 3 Rare, 4 Epic, 5 Legendary. Sets cost, squad size and shop odds. */
  rarity: Rarity;
  atk: number;
  hp: number;
  /** Units per squad at level 1. */
  squad: number;
  ranged?: boolean;
  abilities: Ability[];
  /** Commander Level that unlocks this creature for your shop (base roster: always available). */
  unlock?: number;
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
    id: 'sparkit', name: 'Sparkit', element: 'plasma', class: 'gunner', rarity: 1, atk: 2, hp: 6, squad: 6, ranged: true,
    role: 'Opens fights by setting the enemy ablaze.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'burn', to: 'randomEnemy', stacks: 1, count: 2 }], text: 'Start of battle: apply {1} Burn to 2 random enemies.' },
    ],
    look: 'tiny fox-like critter with a crackling plasma tail and static-charged fur',
  },
  {
    id: 'bryobit', name: 'Bryobit', element: 'bio', class: 'swarm', rarity: 1, atk: 2, hp: 9, squad: 6,
    role: 'Each loss makes the rest of its squad stronger.',
    abilities: [
      { trigger: 'faint', effects: [{ kind: 'buff', to: 'squad', atk: 1, hp: 2 }], text: 'Faint: its squad-mates gain +{1}/+{2}.' },
    ],
    look: 'round mossy seed creature with leaf ears and a sprouting tuft',
  },
  {
    id: 'frostling', name: 'Frostling', element: 'cryo', class: 'vanguard', rarity: 1, atk: 2, hp: 15, squad: 6,
    role: 'Cheap frontline that slows whoever hits it.',
    abilities: [
      { trigger: 'hurt', effects: [{ kind: 'chill', to: 'target', seconds: 1 }], text: 'Hurt: Chill the attacker for 1s.' },
    ],
    look: 'small penguin-like creature with an ice crystal crest and frosty breath',
  },
  {
    id: 'boltbug', name: 'Boltbug', element: 'mech', class: 'swarm', rarity: 1, atk: 2, hp: 9, squad: 6,
    role: 'Upgrades your army and leaves scrap behind.',
    abilities: [
      { trigger: 'buy', effects: [{ kind: 'buff', to: 'randomAlly', atk: 1, hp: 2 }], text: 'Buy: give a random squad +{1}/+{2}.' },
      { trigger: 'faint', effects: [{ kind: 'summon', token: 'microbot', atk: 1, hp: 3 }], text: 'Faint: build a {1}/{3} Microbot.' },
    ],
    look: 'robotic beetle with glowing bolt antennae and a copper shell',
  },
  {
    id: 'nullmite', name: 'Nullmite', element: 'void', class: 'striker', rarity: 1, atk: 3, hp: 6, squad: 6,
    role: 'Glass cannon that refuses to stay dead.',
    abilities: [
      { trigger: 'faint', effects: [{ kind: 'summon', token: 'voidspawn', atk: 1, hp: 3 }], text: 'Faint: a {1}/{3} Voidspawn crawls out.' },
    ],
    look: 'shadowy mite with a single starry eye and tiny claws',
  },
  // ── Tier 2 ──────────────────────────────────────────────
  {
    id: 'ionix', name: 'Ionix', element: 'plasma', class: 'gunner', rarity: 2, atk: 2, hp: 17, squad: 4, ranged: true,
    role: 'Periodic chain lightning that softens whole groups.',
    abilities: [
      { trigger: 'timer', every: 3, effects: [{ kind: 'damage', to: 'randomEnemy', amount: 2, count: 3 }], text: 'Every 3s: chain lightning hits 3 random enemies for {2}.' },
    ],
    look: 'floating orb creature with orbiting electric rings',
  },
  {
    id: 'thornback', name: 'Thornback', element: 'bio', class: 'vanguard', rarity: 2, atk: 2, hp: 21, squad: 4,
    role: 'Punishes melee attackers.',
    abilities: [
      { trigger: 'hurt', effects: [{ kind: 'damage', to: 'target', amount: 1 }], text: 'Hurt: deal {1} damage back to the attacker.' },
    ],
    look: 'armadillo-like creature covered in thorny vines',
  },
  {
    id: 'cryomaw', name: 'Cryomaw', element: 'cryo', class: 'gunner', rarity: 2, atk: 4, hp: 12, squad: 4, ranged: true,
    role: 'Ranged control: every shot slows.',
    abilities: [
      { trigger: 'beforeAttack', effects: [{ kind: 'chill', to: 'target', seconds: 1.5 }], text: 'Attack: Chill the target for 1.5s.' },
      { trigger: 'startOfBattle', effects: [{ kind: 'buff', to: 'nearestEnemy', atk: -1, hp: 0 }], text: 'Start of battle: the nearest enemy loses {1} attack.' },
    ],
    look: 'shark-jawed lizard breathing frost',
  },
  {
    id: 'gearhound', name: 'Gearhound', element: 'mech', class: 'striker', rarity: 2, atk: 4, hp: 17, squad: 4,
    role: 'Grows every turn you keep it; shields up on kills.',
    abilities: [
      { trigger: 'endTurn', effects: [{ kind: 'buff', to: 'self', atk: 0, hp: 1 }], text: 'End turn: permanently gain +{1} health.' },
      { trigger: 'kill', effects: [{ kind: 'shield', to: 'self', amount: 3 }], text: 'Kill: gain a {3} Shield.' },
    ],
    look: 'loyal robot dog with gear-shaped ears',
  },
  {
    id: 'wraithling', name: 'Wraithling', element: 'void', class: 'gunner', rarity: 2, atk: 4, hp: 14, squad: 4, ranged: true,
    role: 'Its death curse finishes off the weakest enemy.',
    abilities: [
      { trigger: 'faint', effects: [{ kind: 'damage', to: 'lowestEnemy', amount: 4 }], text: 'Faint: deal {4} damage to the lowest-health enemy.' },
    ],
    look: 'ghostly wisp creature with a cosmic cloak',
  },
  // ── Tier 3 ──────────────────────────────────────────────
  {
    id: 'novaraptor', name: 'Novaraptor', element: 'plasma', class: 'striker', rarity: 3, atk: 7, hp: 18, squad: 3,
    role: 'Snowballs on kills and spreads fire.',
    abilities: [
      { trigger: 'kill', effects: [{ kind: 'buff', to: 'self', atk: 2, hp: 0 }, { kind: 'burn', to: 'aroundTarget', stacks: 1 }], text: 'Kill: gain +{2} attack and apply {1} Burn to enemies around the victim.' },
    ],
    look: 'sleek raptor with a burning solar-flare crest',
  },
  {
    id: 'verdantaur', name: 'Verdantaur', element: 'bio', class: 'mystic', rarity: 3, atk: 3, hp: 26, squad: 3,
    role: 'Army-wide health and steady healing.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'buff', to: 'allAllies', atk: 0, hp: 2 }], text: 'Start of battle: your whole army gains +{2} health.' },
      { trigger: 'timer', every: 5, effects: [{ kind: 'heal', to: 'lowestAlly', amount: 4, count: 3 }], text: 'Every 5s: heal the 3 most injured allies for {4}.' },
    ],
    look: 'gentle bull-like giant with a tree growing from its back',
  },
  {
    id: 'glacieron', name: 'Glacieron', element: 'cryo', class: 'mystic', rarity: 3, atk: 4, hp: 26, squad: 3,
    role: 'Keeps your front line alive with ice armor.',
    abilities: [
      { trigger: 'timer', every: 4, effects: [{ kind: 'shield', to: 'lowestAlly', amount: 5, count: 3 }], text: 'Every 4s: Shield the 3 most injured allies for {5}.' },
    ],
    look: 'majestic ice stag with glacier antlers',
  },
  {
    id: 'titanode', name: 'Titanode', element: 'mech', class: 'vanguard', rarity: 3, atk: 4, hp: 18, squad: 3,
    role: 'The Mech anchor: shields every machine on the field.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'allAllies', amount: 4, element: 'mech' }], text: 'Start of battle: every Mech ally gains a {4} Shield.' },
      { trigger: 'sell', effects: [{ kind: 'buff', to: 'allAllies', atk: 1, hp: 0 }], text: 'Sell: every squad gains +{1} attack.' },
    ],
    look: 'heavy mech golem with a glowing core',
  },
  {
    id: 'eclipsar', name: 'Eclipsar', element: 'void', class: 'striker', rarity: 3, atk: 7, hp: 18, squad: 3,
    role: 'Ramps up the longer it fights.',
    abilities: [
      { trigger: 'beforeAttack', effects: [{ kind: 'buff', to: 'self', atk: 1, hp: 0 }], text: 'Attack: gain +{1} attack.' },
      { trigger: 'kill', effects: [{ kind: 'heal', to: 'self', amount: 5 }], text: 'Kill: heal itself for {5}.' },
    ],
    look: 'panther made of night sky with an eclipse halo',
  },
  // ── Tier 4 ──────────────────────────────────────────────
  {
    id: 'quasarion', name: 'Quasarion', element: 'plasma', class: 'mystic', rarity: 4, atk: 10, hp: 29, squad: 2, ranged: true,
    role: 'Board-wide fire nukes. Pairs well with Mystics.',
    abilities: [
      { trigger: 'timer', every: 5, effects: [{ kind: 'damage', to: 'allEnemies', amount: 2 }, { kind: 'burn', to: 'allEnemies', stacks: 1 }], text: 'Every 5s: solar flare hits ALL enemies for {2} and applies {1} Burn.' },
    ],
    look: 'radiant dragon with a quasar jet for a tail',
  },
  {
    id: 'mechadon', name: 'Mechadon', element: 'mech', class: 'swarm', rarity: 4, atk: 8, hp: 38, squad: 2,
    role: 'A walking drone factory.',
    abilities: [
      { trigger: 'timer', every: 6, effects: [{ kind: 'summon', token: 'drone', atk: 3, hp: 9 }], text: 'Every 6s: launch a {3}/{9} Drone.' },
      { trigger: 'faint', effects: [{ kind: 'summon', token: 'drone', atk: 3, hp: 9, count: 2 }], text: 'Faint: launch 2 more Drones.' },
    ],
    look: 'armored robot dinosaur with drone bays on its back',
  },
  {
    id: 'glaciarch', name: 'Glaciarch', element: 'cryo', class: 'vanguard', rarity: 4, atk: 6, hp: 48, squad: 2,
    role: 'Freezes the whole enemy army at the start.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'chill', to: 'allEnemies', seconds: 3 }], text: 'Start of battle: Chill ALL enemies for 3s.' },
      { trigger: 'timer', every: 4, effects: [{ kind: 'shield', to: 'self', amount: 6 }], text: 'Every 4s: gain a {6} Shield.' },
    ],
    look: 'colossal ice titan beast with a glacier for a back and frozen horns',
  },
  {
    id: 'worldroot', name: 'Worldroot', element: 'bio', class: 'swarm', rarity: 4, atk: 5, hp: 43, squad: 2,
    role: 'Sprouts an endless stream of saplings.',
    abilities: [
      { trigger: 'timer', every: 4, effects: [{ kind: 'summon', token: 'sproutling', atk: 2, hp: 6 }], text: 'Every 4s: sprout a {2}/{6} Sproutling.' },
      { trigger: 'faint', effects: [{ kind: 'heal', to: 'allAllies', amount: 5 }], text: 'Faint: heal your whole army for {5}.' },
    ],
    look: 'ancient walking tree spirit with glowing seed pods and root legs',
  },
  {
    id: 'singularity', name: 'Singularity', element: 'void', class: 'striker', rarity: 4, atk: 11, hp: 34, squad: 2,
    role: 'Gravity crush hits everything near its target.',
    abilities: [
      { trigger: 'beforeAttack', effects: [{ kind: 'damage', to: 'aroundTarget', amount: 2 }], text: 'Attack: gravity crush deals {2} to enemies around the target.' },
      { trigger: 'kill', effects: [{ kind: 'buff', to: 'self', atk: 1, hp: 3 }], text: 'Kill: gain +{1}/+{3}.' },
    ],
    look: 'menacing black hole beast with a swirling accretion disk mane',
  },

  // ══ Expansion: more Commons, Uncommons, Rares and the Legendaries ══
  // ── Plasma ──────────────────────────────────────────────
  {
    id: 'emberpup', name: 'Emberpup', element: 'plasma', class: 'striker', rarity: 1, atk: 3, hp: 6, squad: 6,
    role: 'Cheap, fast biter that sets its target alight.',
    abilities: [{ trigger: 'beforeAttack', effects: [{ kind: 'burn', to: 'target', stacks: 1 }], text: 'Attack: apply {1} Burn to the target.' }],
    look: 'scrappy puppy with a smoldering ember mane and glowing paws',
  },
  {
    id: 'cinderling', name: 'Cinderling', element: 'plasma', class: 'swarm', rarity: 1, atk: 2, hp: 6, squad: 6,
    role: 'Living embers that pop when they fall.',
    abilities: [{ trigger: 'faint', effects: [{ kind: 'damage', to: 'aroundSelf', amount: 2 }, { kind: 'burn', to: 'aroundSelf', stacks: 1 }], text: 'Faint: explode for {2} damage and {1} Burn on nearby enemies.' }],
    look: 'tiny round coal creature with a flickering flame on its head',
  },
  {
    id: 'pyrolisk', name: 'Pyrolisk', element: 'plasma', class: 'vanguard', rarity: 2, atk: 2, hp: 25, squad: 4,
    role: 'A burning wall: hitting it hurts.',
    abilities: [{ trigger: 'hurt', effects: [{ kind: 'burn', to: 'target', stacks: 1 }], text: 'Hurt: apply {1} Burn to the attacker.' }],
    look: 'stocky lizard with molten rock scales and a lava-crack crest',
  },
  {
    id: 'magmaw', name: 'Magmaw', element: 'plasma', class: 'vanguard', rarity: 3, atk: 4, hp: 29, squad: 3,
    role: 'Erupts in the middle of the enemy line.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'self', amount: 6 }], text: 'Start of battle: gain a {6} Shield.' },
      { trigger: 'timer', every: 4, effects: [{ kind: 'damage', to: 'aroundSelf', amount: 2 }, { kind: 'burn', to: 'aroundSelf', stacks: 1 }], text: 'Every 4s: erupt for {2} damage and {1} Burn on nearby enemies.' },
    ],
    look: 'hulking volcano toad with a magma-filled mouth and rocky back',
  },
  {
    id: 'phoenyx', name: 'Phoenyx', element: 'plasma', class: 'striker', rarity: 5, atk: 23, hp: 94, squad: 1,
    role: 'LEGENDARY. Rises from its ashes and scorches the battlefield.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'buff', to: 'allAllies', atk: 1, hp: 0, element: 'plasma' }], text: 'Start of battle: every Plasma ally gains +{1} attack.' },
      { trigger: 'faint', effects: [{ kind: 'rebirth', hpPct: 0.5 }, { kind: 'burn', to: 'allEnemies', stacks: 2 }], text: 'Faint: reborn once at 50% health, applying {2} Burn to ALL enemies.' },
    ],
    look: 'majestic cosmic phoenix with plasma-fire wings and a starburst crown',
  },
  // ── Mech ────────────────────────────────────────────────
  {
    id: 'sentrybot', name: 'Sentrybot', element: 'mech', class: 'gunner', rarity: 1, atk: 2, hp: 9, squad: 6, ranged: true,
    role: 'Cheap armored turret line.',
    abilities: [{ trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'self', amount: 3 }], text: 'Start of battle: gain a {3} Shield.' }],
    look: 'small walking turret robot with a single lens eye and twin barrels',
  },
  {
    id: 'rivetrat', name: 'Rivetrat', element: 'mech', class: 'striker', rarity: 1, atk: 3, hp: 6, squad: 6,
    role: 'Scrappy brawler that grows with every kill.',
    abilities: [{ trigger: 'kill', effects: [{ kind: 'buff', to: 'self', atk: 1, hp: 2 }], text: 'Kill: gain +{1}/+{2}.' }],
    look: 'mechanical rat with rivet-studded armor and a buzzsaw tail',
  },
  {
    id: 'railhawk', name: 'Railhawk', element: 'mech', class: 'gunner', rarity: 2, atk: 4, hp: 12, squad: 4, ranged: true,
    role: 'Snipes the weakest enemy from the back.',
    abilities: [{ trigger: 'timer', every: 4, effects: [{ kind: 'damage', to: 'lowestEnemy', amount: 4 }], text: 'Every 4s: railgun the lowest-health enemy for {4}.' }],
    look: 'robotic hawk with a long railgun beak and steel feather blades',
  },
  {
    id: 'repairon', name: 'Repairon', element: 'mech', class: 'mystic', rarity: 3, atk: 3, hp: 22, squad: 3, ranged: true,
    role: 'Field medic: keeps the front line running.',
    abilities: [{ trigger: 'timer', every: 3, effects: [{ kind: 'heal', to: 'lowestAlly', amount: 3, count: 2 }], text: 'Every 3s: repair the 2 most injured allies for {3}.' }],
    look: 'friendly floating repair robot with wrench arms and a glowing plus-sign core',
  },
  {
    id: 'omegatron', name: 'Omegatron', element: 'mech', class: 'vanguard', rarity: 5, atk: 21, hp: 156, squad: 1,
    role: 'LEGENDARY. A walking fortress with an orbital laser.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'allAllies', amount: 5 }], text: 'Start of battle: your whole army gains a {5} Shield.' },
      { trigger: 'timer', every: 6, effects: [{ kind: 'damage', to: 'allEnemies', amount: 3 }], text: 'Every 6s: orbital laser hits ALL enemies for {3}.' },
    ],
    look: 'colossal battle mech titan with shoulder cannons and a glowing reactor chest',
  },
  // ── Cryo ────────────────────────────────────────────────
  {
    id: 'snowmite', name: 'Snowmite', element: 'cryo', class: 'swarm', rarity: 1, atk: 2, hp: 9, squad: 6,
    role: 'Bursts into a slowing frost cloud.',
    abilities: [{ trigger: 'faint', effects: [{ kind: 'chill', to: 'aroundSelf', seconds: 2 }], text: 'Faint: Chill nearby enemies for 2s.' }],
    look: 'fluffy snowball mite with tiny icicle legs',
  },
  {
    id: 'shardcub', name: 'Shardcub', element: 'cryo', class: 'striker', rarity: 1, atk: 3, hp: 9, squad: 6,
    role: 'Every bite slows its prey.',
    abilities: [{ trigger: 'beforeAttack', effects: [{ kind: 'chill', to: 'target', seconds: 1 }], text: 'Attack: Chill the target for 1s.' }],
    look: 'playful bear cub with crystal ice shards growing from its shoulders',
  },
  {
    id: 'blizzowl', name: 'Blizzowl', element: 'cryo', class: 'mystic', rarity: 2, atk: 2, hp: 24, squad: 4, ranged: true,
    role: 'Calls down blizzards on the enemy army.',
    abilities: [{ trigger: 'timer', every: 4, effects: [{ kind: 'chill', to: 'randomEnemy', seconds: 2, count: 3 }, { kind: 'damage', to: 'randomEnemy', amount: 1, count: 3 }], text: 'Every 4s: blizzard Chills 3 random enemies for 2s and hits 3 for {1}.' }],
    look: 'snowy owl with frost-crystal feathers and glowing blue eyes',
  },
  {
    id: 'frostfang', name: 'Frostfang', element: 'cryo', class: 'striker', rarity: 3, atk: 8, hp: 18, squad: 3,
    role: 'Apex hunter that grows on kills.',
    abilities: [
      { trigger: 'beforeAttack', effects: [{ kind: 'chill', to: 'target', seconds: 1 }], text: 'Attack: Chill the target for 1s.' },
      { trigger: 'kill', effects: [{ kind: 'buff', to: 'self', atk: 1, hp: 3 }], text: 'Kill: gain +{1}/+{3}.' },
    ],
    look: 'sleek saber-toothed ice wolf with frozen fangs and a frost mane',
  },
  {
    id: 'aurorath', name: 'Aurorath', element: 'cryo', class: 'gunner', rarity: 5, atk: 18, hp: 94, squad: 1, ranged: true,
    role: 'LEGENDARY. Freezes the whole sky.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'allAllies', amount: 6, element: 'cryo' }], text: 'Start of battle: every Cryo ally gains a {6} Shield.' },
      { trigger: 'timer', every: 5, effects: [{ kind: 'chill', to: 'allEnemies', seconds: 2 }, { kind: 'damage', to: 'allEnemies', amount: 2 }], text: 'Every 5s: aurora Chills ALL enemies for 2s and hits them for {2}.' },
    ],
    look: 'celestial ice dragon with shimmering aurora-light wings',
  },
  // ── Bio ─────────────────────────────────────────────────
  {
    id: 'pollenpuff', name: 'Pollenpuff', element: 'bio', class: 'gunner', rarity: 1, atk: 2, hp: 9, squad: 6, ranged: true,
    role: 'Healing spores with every shot.',
    abilities: [{ trigger: 'beforeAttack', effects: [{ kind: 'heal', to: 'lowestAlly', amount: 1 }], text: 'Attack: heal the most injured ally for {1}.' }],
    look: 'fluffy dandelion puffball creature with big sleepy eyes',
  },
  {
    id: 'vinesnap', name: 'Vinesnap', element: 'bio', class: 'striker', rarity: 1, atk: 2, hp: 9, squad: 6,
    role: 'Gets angrier the more it is hit.',
    abilities: [{ trigger: 'hurt', effects: [{ kind: 'buff', to: 'self', atk: 1, hp: 0 }], text: 'Hurt: gain +{1} attack.' }],
    look: 'venus flytrap creature with snapping jaws and leafy legs',
  },
  {
    id: 'sapsprite', name: 'Sapsprite', element: 'bio', class: 'mystic', rarity: 2, atk: 2, hp: 17, squad: 4, ranged: true,
    role: 'Steady group healing.',
    abilities: [{ trigger: 'timer', every: 4, effects: [{ kind: 'heal', to: 'lowestAlly', amount: 3, count: 4 }], text: 'Every 4s: heal the 4 most injured allies for {3}.' }],
    look: 'small glowing forest fairy made of amber tree sap and leaves',
  },
  {
    id: 'mantidra', name: 'Mantidra', element: 'bio', class: 'striker', rarity: 3, atk: 8, hp: 18, squad: 3,
    role: 'Duelist that feeds on its kills.',
    abilities: [{ trigger: 'kill', effects: [{ kind: 'heal', to: 'self', amount: 8 }, { kind: 'buff', to: 'self', atk: 1, hp: 0 }], text: 'Kill: heal itself for {8} and gain +{1} attack.' }],
    look: 'fierce green mantis warrior with scythe arms and leaf-blade wings',
  },
  {
    id: 'gaiadon', name: 'Gaiadon', element: 'bio', class: 'vanguard', rarity: 5, atk: 13, hp: 172, squad: 1,
    role: 'LEGENDARY. An island-sized guardian that heals everything.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'buff', to: 'allAllies', atk: 0, hp: 4 }], text: 'Start of battle: your whole army gains +{4} health.' },
      { trigger: 'timer', every: 3, effects: [{ kind: 'heal', to: 'allAllies', amount: 2 }], text: 'Every 3s: heal your whole army for {2}.' },
    ],
    look: 'gigantic ancient turtle with a lush forest and waterfall growing on its shell',
  },
  // ── Void ────────────────────────────────────────────────
  {
    id: 'gloomwisp', name: 'Gloomwisp', element: 'void', class: 'mystic', rarity: 1, atk: 2, hp: 6, squad: 6, ranged: true,
    role: 'Weakens the enemy before the fight.',
    abilities: [{ trigger: 'startOfBattle', effects: [{ kind: 'buff', to: 'randomEnemy', atk: -1, hp: 0, count: 2 }], text: 'Start of battle: 2 random enemies lose {1} attack.' }],
    look: 'small floating shadow wisp with a lantern-like violet glow',
  },
  {
    id: 'shadeling', name: 'Shadeling', element: 'void', class: 'swarm', rarity: 1, atk: 2, hp: 9, squad: 6,
    role: 'Grows stronger as allies fall.',
    abilities: [{ trigger: 'allyFaint', effects: [{ kind: 'buff', to: 'self', atk: 1, hp: 0 }], text: 'Ally faint: gain +{1} attack.' }],
    look: 'little shadow imp with glowing purple eyes and wispy smoke tail',
  },
  {
    id: 'riftwalker', name: 'Riftwalker', element: 'void', class: 'vanguard', rarity: 2, atk: 4, hp: 21, squad: 4,
    role: 'Shielded guard that collapses into a rift.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'self', amount: 6 }], text: 'Start of battle: gain a {6} Shield.' },
      { trigger: 'faint', effects: [{ kind: 'damage', to: 'aroundSelf', amount: 3 }], text: 'Faint: rift collapse deals {3} to nearby enemies.' },
    ],
    look: 'armored void knight creature with a cracked portal for a chest',
  },
  {
    id: 'voidmaw', name: 'Voidmaw', element: 'void', class: 'vanguard', rarity: 3, atk: 4, hp: 29, squad: 3,
    role: 'Devours the fallen to grow huge.',
    abilities: [{ trigger: 'allyFaint', effects: [{ kind: 'buff', to: 'self', atk: 1, hp: 3 }], text: 'Ally faint: devour, gaining +{1}/+{3}.' }],
    look: 'huge round void beast that is mostly a gaping starry mouth',
  },
  {
    id: 'nyxara', name: 'Nyxara', element: 'void', class: 'mystic', rarity: 5, atk: 18, hp: 86, squad: 1, ranged: true,
    role: 'LEGENDARY. Queen of the void; every death feeds her.',
    abilities: [
      { trigger: 'timer', every: 5, effects: [{ kind: 'summon', token: 'voidspawn', atk: 2, hp: 6, count: 2 }], text: 'Every 5s: summon two {2}/{6} Voidspawn.' },
      { trigger: 'allyFaint', effects: [{ kind: 'damage', to: 'randomEnemy', amount: 3 }], text: 'Ally faint: a void bolt hits a random enemy for {3}.' },
    ],
    look: 'regal cosmic moth queen with galaxy-patterned wings and a crescent crown',
  },

  // ══ Unlockable creatures (Commander Level rewards) ══
  // ── Plasma ──────────────────────────────────────────────
  {
    id: 'flarefly', name: 'Flarefly', element: 'plasma', class: 'gunner', rarity: 1, unlock: 2, atk: 2, hp: 9, squad: 6, ranged: true,
    role: 'Keeps a steady trickle of Burn on the enemy.',
    abilities: [{ trigger: 'timer', every: 3, effects: [{ kind: 'burn', to: 'randomEnemy', stacks: 1 }], text: 'Every 3s: drop {1} Burn on a random enemy.' }],
    look: 'glowing firefly creature with ember wings and a bright plasma tail-light',
  },
  {
    id: 'sparkplug', name: 'Sparkplug', element: 'plasma', class: 'swarm', rarity: 1, unlock: 3, atk: 2, hp: 6, squad: 6,
    role: 'ECONOMY. Banks gold for next turn.',
    abilities: [{ trigger: 'endTurn', effects: [{ kind: 'gold', amount: 1 }], text: 'End turn: bank {1} gold for next turn.' }],
    look: 'chubby little plasma battery creature with spark-plug horns and a happy grin',
  },
  {
    id: 'blazeback', name: 'Blazeback', element: 'plasma', class: 'vanguard', rarity: 2, unlock: 5, atk: 3, hp: 20, squad: 4,
    role: 'Opens with a big burning blast.',
    abilities: [{ trigger: 'startOfBattle', effects: [{ kind: 'burn', to: 'nearestEnemy', stacks: 3 }], text: 'Start of battle: blast the nearest enemy with {3} Burn.' }],
    look: 'armored boar beast with a volcanic back that vents fire',
  },
  {
    id: 'solarion', name: 'Solarion', element: 'plasma', class: 'mystic', rarity: 3, unlock: 7, atk: 6, hp: 22, squad: 3, ranged: true,
    role: 'Empowers every Plasma creature over time.',
    abilities: [{ trigger: 'timer', every: 5, effects: [{ kind: 'buff', to: 'allAllies', atk: 1, hp: 0, element: 'plasma' }], text: 'Every 5s: every Plasma ally gains +{1} attack.' }],
    look: 'radiant sun-priest creature with a halo of solar flares and golden robes of light',
  },
  {
    id: 'infernox', name: 'Infernox', element: 'plasma', class: 'striker', rarity: 4, unlock: 10, atk: 11, hp: 36, squad: 2,
    role: 'Cleaves through packed armies.',
    abilities: [{ trigger: 'beforeAttack', effects: [{ kind: 'damage', to: 'aroundTarget', amount: 3 }, { kind: 'burn', to: 'aroundTarget', stacks: 1 }], text: 'Attack: deal {3} and {1} Burn to enemies around the target.' }],
    look: 'towering infernal minotaur beast with blazing horns and a molten axe tail',
  },
  {
    id: 'supernova', name: 'Supernova', element: 'plasma', class: 'mystic', rarity: 5, unlock: 15, atk: 18, hp: 90, squad: 1, ranged: true,
    role: 'LEGENDARY. Opens with a flash and dies in a blaze.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'damage', to: 'allEnemies', amount: 4 }], text: 'Start of battle: flash ALL enemies for {4}.' },
      { trigger: 'faint', effects: [{ kind: 'damage', to: 'allEnemies', amount: 6 }], text: 'Faint: explodes for {6} on ALL enemies.' },
    ],
    look: 'living star creature with a blinding white-gold core and swirling corona tendrils',
  },
  // ── Mech ────────────────────────────────────────────────
  {
    id: 'scrapper', name: 'Scrapper', element: 'mech', class: 'swarm', rarity: 1, unlock: 2, atk: 2, hp: 9, squad: 6,
    role: 'ECONOMY. Sells for extra gold.',
    abilities: [{ trigger: 'sell', effects: [{ kind: 'gold', amount: 2 }], text: 'Sell: gain {2} extra gold.' }],
    look: 'scavenger robot made of mismatched scrap parts with a magnet hand',
  },
  {
    id: 'ticktock', name: 'Ticktock', element: 'mech', class: 'mystic', rarity: 1, unlock: 4, atk: 2, hp: 9, squad: 6, ranged: true,
    role: 'Clockwork shield generator.',
    abilities: [{ trigger: 'timer', every: 4, effects: [{ kind: 'shield', to: 'lowestAlly', amount: 3, count: 2 }], text: 'Every 4s: Shield the 2 most injured allies for {3}.' }],
    look: 'small clockwork owl robot with a ticking gear chest and brass feathers',
  },
  {
    id: 'hammerhead', name: 'Hammerhead', element: 'mech', class: 'striker', rarity: 2, unlock: 6, atk: 5, hp: 14, squad: 4,
    role: 'Every swing hits twice.',
    abilities: [{ trigger: 'beforeAttack', effects: [{ kind: 'damage', to: 'target', amount: 2 }], text: 'Attack: deal {2} extra damage to the target.' }],
    look: 'robotic hammerhead shark on mechanical legs with piston-powered jaws',
  },
  {
    id: 'dynamo', name: 'Dynamo', element: 'mech', class: 'swarm', rarity: 3, unlock: 8, atk: 4, hp: 20, squad: 3,
    role: 'ECONOMY. Powers your gold and your Mechs.',
    abilities: [
      { trigger: 'endTurn', effects: [{ kind: 'gold', amount: 1 }], text: 'End turn: bank {1} gold for next turn.' },
      { trigger: 'startOfBattle', effects: [{ kind: 'buff', to: 'allAllies', atk: 1, hp: 0, element: 'mech' }], text: 'Start of battle: every Mech ally gains +{1} attack.' },
    ],
    look: 'spinning generator robot with crackling tesla coils and a turbine body',
  },
  {
    id: 'warforge', name: 'Warforge', element: 'mech', class: 'vanguard', rarity: 4, unlock: 11, atk: 8, hp: 40, squad: 2,
    role: 'A mobile factory that shields Mechs and builds bots.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'allAllies', amount: 8, element: 'mech' }], text: 'Start of battle: every Mech ally gains an {8} Shield.' },
      { trigger: 'timer', every: 5, effects: [{ kind: 'summon', token: 'microbot', atk: 2, hp: 6, count: 2 }], text: 'Every 5s: build two {2}/{6} Microbots.' },
    ],
    look: 'massive walking forge robot with smokestacks, an anvil body and assembly arms',
  },
  {
    id: 'starbreaker', name: 'Starbreaker', element: 'mech', class: 'gunner', rarity: 5, unlock: 16, atk: 20, hp: 70, squad: 1, ranged: true,
    role: 'LEGENDARY. Precision artillery that picks off the weak.',
    abilities: [{ trigger: 'timer', every: 3, effects: [{ kind: 'damage', to: 'lowestEnemy', amount: 8, count: 2 }], text: 'Every 3s: snipe the 2 lowest-health enemies for {8}.' }],
    look: 'enormous sleek artillery mech with a planet-cracking cannon and star-map armor',
  },
  // ── Cryo ────────────────────────────────────────────────
  {
    id: 'flurrikit', name: 'Flurrikit', element: 'cryo', class: 'gunner', rarity: 1, unlock: 3, atk: 2, hp: 9, squad: 6, ranged: true,
    role: 'Cheap ranged slows.',
    abilities: [{ trigger: 'beforeAttack', effects: [{ kind: 'chill', to: 'target', seconds: 1 }], text: 'Attack: Chill the target for 1s.' }],
    look: 'fluffy arctic fox kit that shoots snowflakes from its tail',
  },
  {
    id: 'icewisp', name: 'Icewisp', element: 'cryo', class: 'mystic', rarity: 1, unlock: 5, atk: 2, hp: 9, squad: 6, ranged: true,
    role: 'Pre-battle ice armor for allies.',
    abilities: [{ trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'randomAlly', amount: 4, count: 2 }], text: 'Start of battle: Shield 2 random allies for {4}.' }],
    look: 'tiny floating ice spirit made of snowflake crystals with a gentle glow',
  },
  {
    id: 'tundrox', name: 'Tundrox', element: 'cryo', class: 'vanguard', rarity: 2, unlock: 4, atk: 3, hp: 22, squad: 4,
    role: 'Frozen bulwark that slows attackers.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'self', amount: 6 }], text: 'Start of battle: gain a {6} Shield.' },
      { trigger: 'hurt', effects: [{ kind: 'chill', to: 'target', seconds: 1 }], text: 'Hurt: Chill the attacker for 1s.' },
    ],
    look: 'woolly musk-ox beast covered in thick frost and icicle horns',
  },
  {
    id: 'snowmother', name: 'Snowmother', element: 'cryo', class: 'swarm', rarity: 3, unlock: 9, atk: 3, hp: 20, squad: 3,
    role: 'Keeps building Snowmites.',
    abilities: [{ trigger: 'timer', every: 4, effects: [{ kind: 'summon', token: 'snowmite', atk: 2, hp: 9 }], text: 'Every 4s: build a {2}/{9} Snowmite.' }],
    look: 'motherly yeti creature carrying a nest of little snowball creatures',
  },
  {
    id: 'glacilord', name: 'Glacilord', element: 'cryo', class: 'striker', rarity: 4, unlock: 12, atk: 10, hp: 34, squad: 2,
    role: 'Frozen executioner.',
    abilities: [
      { trigger: 'beforeAttack', effects: [{ kind: 'chill', to: 'target', seconds: 1.5 }], text: 'Attack: Chill the target for 1.5s.' },
      { trigger: 'kill', effects: [{ kind: 'buff', to: 'self', atk: 2, hp: 0 }], text: 'Kill: gain +{2} attack.' },
    ],
    look: 'armored ice knight beast with glacier blades for arms and a frozen crown',
  },
  {
    id: 'zerion', name: 'Zerion', element: 'cryo', class: 'mystic', rarity: 5, unlock: 17, atk: 16, hp: 90, squad: 1, ranged: true,
    role: 'LEGENDARY. Absolute zero: freezes the battlefield over and over.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'buff', to: 'allAllies', atk: 2, hp: 0, element: 'cryo' }], text: 'Start of battle: every Cryo ally gains +{2} attack.' },
      { trigger: 'timer', every: 6, effects: [{ kind: 'chill', to: 'allEnemies', seconds: 3 }, { kind: 'damage', to: 'allEnemies', amount: 3 }], text: 'Every 6s: Chill ALL enemies for 3s and hit them for {3}.' },
    ],
    look: 'ethereal crystal serpent of absolute zero with a frozen galaxy inside its body',
  },
  // ── Bio ─────────────────────────────────────────────────
  {
    id: 'budling', name: 'Budling', element: 'bio', class: 'swarm', rarity: 1, unlock: 9, atk: 1, hp: 9, squad: 6,
    role: 'Blooms into a Sproutling when it falls.',
    abilities: [{ trigger: 'faint', effects: [{ kind: 'summon', token: 'sproutling', atk: 2, hp: 6 }], text: 'Faint: a {2}/{6} Sproutling grows in its place.' }],
    look: 'tiny flower bud creature with petal ears and a leaf skirt',
  },
  {
    id: 'mossgrub', name: 'Mossgrub', element: 'bio', class: 'vanguard', rarity: 1, unlock: 6, atk: 2, hp: 14, squad: 6,
    role: 'Grows tougher every turn you keep it.',
    abilities: [{ trigger: 'endTurn', effects: [{ kind: 'buff', to: 'self', atk: 0, hp: 2 }], text: 'End turn: permanently gain +{2} health.' }],
    look: 'plump caterpillar grub covered in soft moss and tiny mushrooms',
  },
  {
    id: 'fungalord', name: 'Fungalord', element: 'bio', class: 'mystic', rarity: 2, unlock: 7, atk: 3, hp: 16, squad: 4, ranged: true,
    role: 'Spores that heal the whole army.',
    abilities: [{ trigger: 'timer', every: 5, effects: [{ kind: 'heal', to: 'allAllies', amount: 2 }], text: 'Every 5s: heal your whole army for {2}.' }],
    look: 'wise mushroom creature with a glowing spotted cap and a spore cloud aura',
  },
  {
    id: 'briarbeast', name: 'Briarbeast', element: 'bio', class: 'vanguard', rarity: 3, unlock: 10, atk: 5, hp: 25, squad: 3,
    role: 'Thorn armor that shreds attackers.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'self', amount: 6 }], text: 'Start of battle: gain a {6} Shield.' },
      { trigger: 'hurt', effects: [{ kind: 'damage', to: 'target', amount: 2 }], text: 'Hurt: deal {2} damage back to the attacker.' },
    ],
    look: 'hulking bear beast made of twisted briars and thorns with glowing green eyes',
  },
  {
    id: 'hydrabloom', name: 'Hydrabloom', element: 'bio', class: 'swarm', rarity: 4, unlock: 13, atk: 6, hp: 40, squad: 2,
    role: 'Cut one head, three more grow.',
    abilities: [
      { trigger: 'timer', every: 6, effects: [{ kind: 'summon', token: 'sproutling', atk: 2, hp: 6 }], text: 'Every 6s: sprout a {2}/{6} Sproutling.' },
      { trigger: 'faint', effects: [{ kind: 'summon', token: 'sproutling', atk: 3, hp: 9, count: 3 }], text: 'Faint: three {3}/{9} Sproutlings burst out.' },
    ],
    look: 'multi-headed flower hydra with each head a different blooming flower',
  },
  {
    id: 'yggdra', name: 'Yggdra', element: 'bio', class: 'mystic', rarity: 5, unlock: 18, atk: 12, hp: 110, squad: 1,
    role: 'LEGENDARY. The world tree: endless growth for the whole army.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'buff', to: 'allAllies', atk: 1, hp: 6 }], text: 'Start of battle: your whole army gains +{1}/+{6}.' },
      { trigger: 'timer', every: 4, effects: [{ kind: 'heal', to: 'allAllies', amount: 3 }], text: 'Every 4s: heal your whole army for {3}.' },
    ],
    look: 'colossal world-tree spirit with a cosmic canopy full of stars and glowing roots',
  },
  // ── Void ────────────────────────────────────────────────
  {
    id: 'hexling', name: 'Hexling', element: 'void', class: 'mystic', rarity: 1, unlock: 13, atk: 2, hp: 9, squad: 6, ranged: true,
    role: 'Its dying curse finds the weakest enemy.',
    abilities: [{ trigger: 'faint', effects: [{ kind: 'damage', to: 'lowestEnemy', amount: 3 }], text: 'Faint: curse the lowest-health enemy for {3}.' }],
    look: 'small hooded imp witch with a glowing purple hex sigil',
  },
  {
    id: 'leechling', name: 'Leechling', element: 'void', class: 'striker', rarity: 1, unlock: 12, atk: 3, hp: 6, squad: 6,
    role: 'Feeds and grows on every kill.',
    abilities: [{ trigger: 'kill', effects: [{ kind: 'buff', to: 'self', atk: 1, hp: 3 }], text: 'Kill: gain +{1}/+{3}.' }],
    look: 'slimy void leech creature with a round toothy mouth and starry skin',
  },
  {
    id: 'phantasm', name: 'Phantasm', element: 'void', class: 'striker', rarity: 2, unlock: 8, atk: 6, hp: 12, squad: 4,
    role: 'Assassin that opens on the weakest enemy.',
    abilities: [{ trigger: 'startOfBattle', effects: [{ kind: 'damage', to: 'lowestEnemy', amount: 4 }], text: 'Start of battle: strike the lowest-health enemy for {4}.' }],
    look: 'translucent phantom assassin with void daggers and a tattered shadow cloak',
  },
  {
    id: 'gravemind', name: 'Gravemind', element: 'void', class: 'swarm', rarity: 3, unlock: 11, atk: 4, hp: 20, squad: 3,
    role: 'Every fallen ally returns as Voidspawn.',
    abilities: [{ trigger: 'allyFaint', effects: [{ kind: 'summon', token: 'voidspawn', atk: 1, hp: 3 }], text: 'Ally faint: raise a {1}/{3} Voidspawn.' }],
    look: 'floating brain-like void entity with tendrils and many small glowing eyes',
  },
  {
    id: 'abyssal', name: 'Abyssal', element: 'void', class: 'vanguard', rarity: 4, unlock: 14, atk: 7, hp: 45, squad: 2,
    role: 'Swallows the fallen and keeps growing.',
    abilities: [
      { trigger: 'startOfBattle', effects: [{ kind: 'shield', to: 'self', amount: 10 }], text: 'Start of battle: gain a {10} Shield.' },
      { trigger: 'allyFaint', effects: [{ kind: 'buff', to: 'self', atk: 1, hp: 4 }], text: 'Ally faint: gain +{1}/+{4}.' },
    ],
    look: 'giant deep-sea anglerfish leviathan made of void with a glowing star lure',
  },
  {
    id: 'oblivion', name: 'Oblivion', element: 'void', class: 'striker', rarity: 5, unlock: 19, atk: 22, hp: 80, squad: 1,
    role: 'LEGENDARY. Erases everything around its target.',
    abilities: [
      { trigger: 'beforeAttack', effects: [{ kind: 'damage', to: 'aroundTarget', amount: 4 }], text: 'Attack: erase {4} from enemies around the target.' },
      { trigger: 'kill', effects: [{ kind: 'buff', to: 'self', atk: 2, hp: 8 }], text: 'Kill: gain +{2}/+{8}.' },
    ],
    look: 'terrifying void dragon with an event-horizon maw and wings of pure darkness',
  },
  // ── Tokens ──────────────────────────────────────────────
  { id: 'voidspawn', name: 'Voidspawn', element: 'void', class: 'swarm', rarity: 1, atk: 1, hp: 3, squad: 1, token: true, abilities: [], role: 'Summoned.', look: 'tiny wobbling blob of void' },
  { id: 'microbot', name: 'Microbot', element: 'mech', class: 'swarm', rarity: 1, atk: 1, hp: 3, squad: 1, token: true, abilities: [], role: 'Summoned.', look: 'tiny boxy scrap robot on two little legs' },
  { id: 'drone', name: 'Drone', element: 'mech', class: 'swarm', rarity: 1, atk: 3, hp: 9, squad: 1, token: true, abilities: [], role: 'Summoned.', look: 'small hovering combat drone' },
  { id: 'sproutling', name: 'Sproutling', element: 'bio', class: 'swarm', rarity: 1, atk: 2, hp: 6, squad: 1, token: true, abilities: [], role: 'Summoned.', look: 'small walking sapling with leaf hands' },
];

export const CREATURES: Record<string, CreatureDef> = Object.fromEntries(list.map((c) => [c.id, c]));

export const SHOP_POOL = list.filter((c) => !c.token);
/** Always available, no unlock needed. */
export const BASE_POOL = SHOP_POOL.filter((c) => !c.unlock);

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
