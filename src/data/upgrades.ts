/**
 * Permanent upgrades, bought with Stardust in Command HQ between runs.
 * They apply to every future run (meta progression, outside the game).
 */
export type UpgradeId = 'warchest' | 'reinforcements' | 'interest' | 'reroll' | 'weapons' | 'bioarmor' | 'scout' | 'salvage';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** What the upgrade does in total at each level (index 0 = level 1). */
  levels: string[];
  /** Stardust price to reach level i+1. */
  costs: number[];
  color: number;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'warchest', name: 'War Chest', color: 0xffd166, costs: [150, 300, 500],
    levels: ['Start every run with +1 gold', '+2 starting gold', '+3 starting gold'],
  },
  {
    id: 'interest', name: 'Compound Interest', color: 0xffb703, costs: [300, 600],
    levels: ['Max interest +1 (up to +4 a turn)', 'Max interest +2 (up to +5 a turn)'],
  },
  {
    id: 'reroll', name: 'Quick Reroll', color: 0x3a86ff, costs: [250, 600],
    levels: ['First reroll each turn is free', 'First 2 rerolls each turn are free'],
  },
  {
    id: 'salvage', name: 'Salvage', color: 0x8d99ae, costs: [300],
    levels: ['Selling a squad gives +1 gold'],
  },
  {
    id: 'scout', name: 'Talent Scout', color: 0x9bf6ff, costs: [900],
    levels: ['Your shop always has 1 extra slot'],
  },
  {
    id: 'reinforcements', name: 'Reinforcements', color: 0xef476f, costs: [400, 800],
    levels: ['+2 lives every run', '+4 lives every run'],
  },
  {
    id: 'weapons', name: 'Weapons Lab', color: 0xff8c42, costs: [100, 200, 350, 550, 800],
    levels: ['+2% attack for all creatures', '+4% attack', '+6% attack', '+8% attack', '+10% attack'],
  },
  {
    id: 'bioarmor', name: 'Bio-Armor', color: 0x52b788, costs: [100, 200, 350, 550, 800],
    levels: ['+2% health for all creatures', '+4% health', '+6% health', '+8% health', '+10% health'],
  },
];

export type UpgradeLevels = Partial<Record<UpgradeId, number>>;

/** Everything the upgrades change about a run. */
export interface MetaBonuses {
  startGold: number;
  extraLives: number;
  interestCap: number;
  freeRerolls: number;
  sellBonus: number;
  shopSlots: number;
  atkPct: number;
  hpPct: number;
}

export const NO_BONUSES: MetaBonuses = {
  startGold: 0,
  extraLives: 0,
  interestCap: 0,
  freeRerolls: 0,
  sellBonus: 0,
  shopSlots: 0,
  atkPct: 0,
  hpPct: 0,
};

export function metaBonuses(levels: UpgradeLevels): MetaBonuses {
  const l = (id: UpgradeId) => levels[id] ?? 0;
  return {
    startGold: l('warchest'),
    extraLives: 2 * l('reinforcements'),
    interestCap: l('interest'),
    freeRerolls: l('reroll'),
    sellBonus: l('salvage'),
    shopSlots: l('scout'),
    atkPct: 0.02 * l('weapons'),
    hpPct: 0.02 * l('bioarmor'),
  };
}

export const upgradeDef = (id: UpgradeId) => UPGRADES.find((u) => u.id === id)!;
