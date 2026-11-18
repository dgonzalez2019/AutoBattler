import { COMMANDER_LIST } from './commanders';
import { SHOP_POOL, type CreatureDef } from './creatures';
import type { Rarity } from './rarity';

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return 80 + 20 * level;
}

export const MAX_LEVEL = 30;

export interface RunSummary {
  wins: number;
  rounds: number;
  champion: boolean;
}

export interface RunRewards {
  xp: number;
  stardust: number;
}

/** What a finished run is worth. Every run earns something, even a quick loss. */
export function runRewards(r: RunSummary): RunRewards {
  return {
    xp: 15 + r.wins * 12 + r.rounds * 4 + (r.champion ? 60 : 0),
    stardust: 10 + r.wins * 15 + (r.champion ? 100 : 0),
  };
}

/** Stardust earned for reaching each new level, on top of its unlocks. */
export const LEVEL_STARDUST = 50;

export interface LevelReward {
  level: number;
  creatures: CreatureDef[];
  commanders: string[];
  stardust: number;
}

/** The full reward track, built from unlock levels in the data. */
export function rewardTrack(): LevelReward[] {
  const track: LevelReward[] = [];
  for (let level = 2; level <= MAX_LEVEL; level++) {
    track.push({
      level,
      creatures: SHOP_POOL.filter((c) => c.unlock === level),
      commanders: COMMANDER_LIST.filter((c) => c.unlockLevel === level).map((c) => c.id),
      stardust: LEVEL_STARDUST,
    });
  }
  return track;
}

/** Stardust price to research a locked creature early. */
export const RESEARCH_PRICE: Record<Rarity, number> = { 1: 80, 2: 120, 3: 180, 4: 260, 5: 400 };
