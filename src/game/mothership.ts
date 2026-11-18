/**
 * Mothership: your home base. Upgrades bought in the shop last for the whole run.
 * Seven modules across economy, shop, army stats and two active weapons that
 * act during battles (and show on the battlefield).
 */
export type ModuleId = 'reactor' | 'scanner' | 'barracks' | 'armory' | 'shields' | 'orbital' | 'medbay';

export interface ModuleDef {
  id: ModuleId;
  name: string;
  kind: 'Economy' | 'Shop' | 'Army' | 'Weapon';
  /** What each level does (index 0 = level 1). */
  levels: string[];
  /** Gold cost to reach level i+1. */
  costs: number[];
  color: number;
}

export const MODULES: ModuleDef[] = [
  {
    id: 'reactor', name: 'Reactor', kind: 'Economy', costs: [3, 5, 7], color: 0xffd166,
    levels: ['+1 gold every turn', '+2 gold every turn', '+4 gold every turn'],
  },
  {
    id: 'scanner', name: 'Scanner', kind: 'Shop', costs: [3, 5, 7], color: 0x9bf6ff,
    levels: [
      'Shop rolls as if 1 round later (rarer creatures sooner)',
      'Shop rolls 2 rounds ahead, +1 shop slot',
      'Shop rolls 3 rounds ahead, +1 shop slot',
    ],
  },
  {
    id: 'barracks', name: 'Barracks', kind: 'Army', costs: [3, 5, 7], color: 0x06d6a0,
    levels: ['+25% squad size (min +1)', '+50% squad size (min +2)', '+75% squad size (min +3)'],
  },
  {
    id: 'armory', name: 'Armory', kind: 'Army', costs: [3, 5, 7], color: 0xff8c42,
    levels: ['+15% attack for all creatures', '+30% attack', '+45% attack'],
  },
  {
    id: 'shields', name: 'Shield Bay', kind: 'Army', costs: [3, 5, 7], color: 0x4cc9f0,
    levels: ['Creatures start with a Shield of 15% max health', 'Shield of 30% max health', 'Shield of 45% max health'],
  },
  {
    id: 'orbital', name: 'Orbital Cannon', kind: 'Weapon', costs: [3, 5, 7], color: 0xef476f,
    levels: ['Every 5s: laser strikes 3 random enemies for 6', 'Strikes 4 enemies for 9', 'Strikes 5 enemies for 12'],
  },
  {
    id: 'medbay', name: 'Med Bay', kind: 'Weapon', costs: [3, 5, 7], color: 0x52b788,
    levels: ['Every 4s: heal your 4 most injured creatures for 5', 'Heal 6 creatures for 8', 'Heal 8 creatures for 11'],
  },
];

export type ModuleLevels = Record<ModuleId, number>;

export const emptyModules = (): ModuleLevels => ({ reactor: 0, scanner: 0, barracks: 0, armory: 0, shields: 0, orbital: 0, medbay: 0 });

export const moduleDef = (id: ModuleId) => MODULES.find((m) => m.id === id)!;

// ── Numbers (index = level) ───────────────────────────────

export const REACTOR_GOLD = [0, 1, 2, 4];
export const SCANNER_ROUNDS = [0, 1, 2, 3];
export const SCANNER_SLOTS = [0, 0, 1, 1];
export const BARRACKS_PCT = [0, 0.25, 0.5, 0.75];
export const ARMORY_PCT = [0, 0.15, 0.3, 0.45];
export const SHIELD_PCT = [0, 0.15, 0.3, 0.45];
export const ORBITAL = { every: 5, targets: [0, 3, 4, 5], damage: [0, 6, 9, 12] };
export const MEDBAY = { every: 4, targets: [0, 4, 6, 8], heal: [0, 5, 8, 11] };

/** Short summary of a module at a level, for UI. */
export function moduleText(def: ModuleDef, level: number): string {
  return level > 0 ? def.levels[Math.min(level, def.levels.length) - 1] : 'Not built';
}
