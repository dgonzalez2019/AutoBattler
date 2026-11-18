export type Rarity = 1 | 2 | 3 | 4 | 5;

export interface RarityInfo {
  name: string;
  cost: number;
  color: number;
}

export const RARITY: Record<Rarity, RarityInfo> = {
  1: { name: 'Common', cost: 3, color: 0xadb5bd },
  2: { name: 'Uncommon', cost: 4, color: 0x52b788 },
  3: { name: 'Rare', cost: 5, color: 0x4cc9f0 },
  4: { name: 'Epic', cost: 6, color: 0xc77dff },
  5: { name: 'Legendary', cost: 8, color: 0xffd166 },
};

export const RARITIES: Rarity[] = [1, 2, 3, 4, 5];

/** Shop odds (%) per rarity, by round. Later rounds lean rarer. */
const ODDS: { from: number; odds: [number, number, number, number, number] }[] = [
  { from: 1, odds: [100, 0, 0, 0, 0] },
  { from: 3, odds: [70, 30, 0, 0, 0] },
  { from: 5, odds: [50, 35, 15, 0, 0] },
  { from: 7, odds: [35, 35, 22, 8, 0] },
  { from: 9, odds: [25, 30, 27, 15, 3] },
  { from: 11, odds: [20, 25, 30, 18, 7] },
];

export function shopOdds(round: number): [number, number, number, number, number] {
  let o = ODDS[0].odds;
  for (const row of ODDS) if (round >= row.from) o = row.odds;
  return o;
}

/** Roll a rarity with the round's odds. `r` is a uniform random number in [0, 1). */
export function rollRarity(round: number, r: number): Rarity {
  const odds = shopOdds(round);
  let acc = 0;
  for (let i = 0; i < odds.length; i++) {
    acc += odds[i];
    if (r * 100 < acc) return (i + 1) as Rarity;
  }
  return 1;
}

/** Gold back when selling: grows with rarity and level. */
export function sellValue(rarity: Rarity, level: number): number {
  return level + rarity - 1;
}

export const hexColor = (c: number) => '#' + c.toString(16).padStart(6, '0');
