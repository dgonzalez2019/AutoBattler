import type { Element } from './elements';

export type CreatureClass = 'vanguard' | 'striker' | 'gunner' | 'mystic' | 'swarm';
export type TraitId = Element | CreatureClass;

export const CLASSES: CreatureClass[] = ['vanguard', 'striker', 'gunner', 'mystic', 'swarm'];

export interface TraitDef {
  id: TraitId;
  name: string;
  kind: 'element' | 'class';
  /** Number of DIFFERENT squads needed for each tier. */
  thresholds: number[];
  /** One line per tier. */
  tiers: string[];
  blurb: string;
  color: number;
}

/**
 * Synergies. A trait counts distinct creature species in your army
 * (two squads of the same creature count once), so variety is rewarded.
 */
export const TRAITS: Record<TraitId, TraitDef> = {
  // ── Elements ───────────────────────────────────────────
  plasma: {
    id: 'plasma', name: 'Plasma', kind: 'element', thresholds: [2, 3], color: 0xff6a3d,
    blurb: 'Set the battlefield on fire. Burn deals its stacks as damage every second, losing a stack every 2 seconds.',
    tiers: [
      'Plasma attacks apply 1 Burn.',
      'Plasma attacks apply 2 Burn. Burning enemies take 25% more damage from everything.',
    ],
  },
  mech: {
    id: 'mech', name: 'Mech', kind: 'element', thresholds: [2, 3], color: 0x8d99ae,
    blurb: 'Armored and hard to crack.',
    tiers: [
      'Mech units start with a Shield worth 25% of their max health.',
      'Shield worth 50% of max health. When a Mech shield breaks, that unit gains +2 attack.',
    ],
  },
  cryo: {
    id: 'cryo', name: 'Cryo', kind: 'element', thresholds: [2, 3], color: 0x4cc9f0,
    blurb: 'Freeze the enemy in their tracks.',
    tiers: [
      'Cryo attacks Chill for 2s (enemies move and attack 40% slower).',
      'Chill is 55% slower, and Chilled enemies deal 25% less damage.',
    ],
  },
  bio: {
    id: 'bio', name: 'Bio', kind: 'element', thresholds: [2, 3], color: 0x52b788,
    blurb: 'Outlast everything.',
    tiers: [
      'Bio units Regenerate 1 health per second.',
      'Bio units Regenerate 2 per second, and all other allies Regenerate 1.',
    ],
  },
  void: {
    id: 'void', name: 'Void', kind: 'element', thresholds: [2, 3], color: 0x9d4edd,
    blurb: 'Feed on the fallen.',
    tiers: [
      'Void units heal for 35% of the damage they deal (Lifesteal).',
      '60% Lifesteal. Whenever a Void creature dies, a 2/3 Voidspawn rises in its place.',
    ],
  },
  // ── Classes ────────────────────────────────────────────
  vanguard: {
    id: 'vanguard', name: 'Vanguard', kind: 'class', thresholds: [2, 3], color: 0xf4a261,
    blurb: 'Hold the line.',
    tiers: [
      'Vanguards take 15% less damage.',
      'Vanguards take 30% less damage, and every ally starts with a 4 Shield.',
    ],
  },
  striker: {
    id: 'striker', name: 'Striker', kind: 'class', thresholds: [2, 3], color: 0xe63946,
    blurb: 'Hit fast, hit hard.',
    tiers: [
      'Strikers attack 30% faster and charge 30% faster.',
      'Strikers attack 60% faster, charge 50% faster, and have a 25% chance to Crit (double damage).',
    ],
  },
  gunner: {
    id: 'gunner', name: 'Gunner', kind: 'class', thresholds: [2, 3], color: 0xffd166,
    blurb: 'Rain fire from the back line.',
    tiers: [
      'Gunners gain +1 attack.',
      'Gunner shots also splash 35% damage onto nearby enemies.',
    ],
  },
  mystic: {
    id: 'mystic', name: 'Mystic', kind: 'class', thresholds: [2, 3], color: 0xc77dff,
    blurb: 'Abilities are the real weapons.',
    tiers: [
      'Every ability in your army is 50% stronger.',
      'Every ability is 100% stronger, and timed abilities recharge 25% faster.',
    ],
  },
  swarm: {
    id: 'swarm', name: 'Swarm', kind: 'class', thresholds: [2, 3], color: 0x90be6d,
    blurb: 'Strength in numbers.',
    tiers: [
      'Swarm squads field +2 units. Summoned units get +1/+3.',
      'Swarm squads field +4 units. Summoned units get +2/+6.',
    ],
  },
};

export const CLASS_INFO: Record<CreatureClass, { name: string }> = {
  vanguard: { name: 'Vanguard' },
  striker: { name: 'Striker' },
  gunner: { name: 'Gunner' },
  mystic: { name: 'Mystic' },
  swarm: { name: 'Swarm' },
};

/** Active tier index per trait: 0 = inactive, 1 = first threshold, 2 = second. */
export type TraitLevels = Record<TraitId, number>;
