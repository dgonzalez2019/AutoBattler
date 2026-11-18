import { COMMANDER_LIST, COMMANDERS, DEFAULT_COMMANDER } from '../data/commanders';
import { BASE_POOL, CREATURES, SHOP_POOL } from '../data/creatures';
import { MAX_LEVEL, RESEARCH_PRICE, runRewards, rewardTrack, xpToNext, type LevelReward, type RunSummary } from '../data/progression';

/**
 * Persistent meta progression: everything that carries over between runs.
 * Stored in the browser (localStorage) for now; the shape is plain JSON so it
 * can move to the online backend later.
 */
export interface ProfileData {
  version: 1;
  level: number;
  xp: number;
  stardust: number;
  commanders: string[];
  /** Creatures unlocked beyond the base roster. */
  creatures: string[];
  selectedCommander: string;
  stats: { runs: number; wins: number; champions: number; bestWins: number; bestEndless: number };
  /** Creatures unlocked since the player last opened the collection. */
  fresh: string[];
}

export interface RunResult {
  rewards: { xp: number; stardust: number };
  levelsGained: LevelReward[];
  levelBefore: number;
  levelAfter: number;
}

const KEY = 'autobattler.profile.v1';

export function newProfile(): ProfileData {
  return {
    version: 1,
    level: 1,
    xp: 0,
    stardust: 0,
    commanders: COMMANDER_LIST.filter((c) => c.unlockLevel <= 1).map((c) => c.id),
    creatures: [],
    selectedCommander: DEFAULT_COMMANDER,
    stats: { runs: 0, wins: 0, champions: 0, bestWins: 0, bestEndless: 0 },
    fresh: [],
  };
}

/** Repair anything missing or invalid (old saves, hand edits). */
function sanitize(raw: unknown): ProfileData {
  const p = newProfile();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Partial<ProfileData>;
  const num = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : d;
  p.level = num(r.level, 1, MAX_LEVEL, 1);
  p.xp = num(r.xp, 0, 1e7, 0);
  p.stardust = num(r.stardust, 0, 1e7, 0);
  if (Array.isArray(r.commanders)) p.commanders = [...new Set([...p.commanders, ...r.commanders.filter((c) => COMMANDERS[c])])];
  if (Array.isArray(r.creatures)) p.creatures = [...new Set(r.creatures.filter((c) => CREATURES[c]?.unlock))];
  if (Array.isArray(r.fresh)) p.fresh = r.fresh.filter((c) => CREATURES[c] || COMMANDERS[c]);
  if (typeof r.selectedCommander === 'string' && p.commanders.includes(r.selectedCommander)) p.selectedCommander = r.selectedCommander;
  const st = r.stats as ProfileData['stats'] | undefined;
  if (st) {
    p.stats = {
      runs: num(st.runs, 0, 1e7, 0),
      wins: num(st.wins, 0, 1e7, 0),
      champions: num(st.champions, 0, 1e7, 0),
      bestWins: num(st.bestWins, 0, 9999, 0),
      bestEndless: num(st.bestEndless, 0, 9999, 0),
    };
  }
  // Level unlocks are always granted, even if the save missed them.
  for (const reward of rewardTrack()) {
    if (reward.level > p.level) break;
    for (const c of reward.creatures) if (!p.creatures.includes(c.id)) p.creatures.push(c.id);
    for (const c of reward.commanders) if (!p.commanders.includes(c)) p.commanders.push(c);
  }
  return p;
}

export class Profile {
  data: ProfileData;

  constructor(data?: ProfileData) {
    this.data = data ?? Profile.load();
  }

  static load(): ProfileData {
    try {
      return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
    } catch {
      return newProfile();
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage blocked: progress lasts for this session only.
    }
  }

  get xpNeeded(): number {
    return xpToNext(this.data.level);
  }

  hasCommander(id: string): boolean {
    return this.data.commanders.includes(id);
  }

  hasCreature(id: string): boolean {
    const def = CREATURES[id];
    return !!def && (!def.unlock || this.data.creatures.includes(id));
  }

  /** Creature ids your shop can roll. */
  shopPool(): string[] {
    return [...BASE_POOL.map((c) => c.id), ...this.data.creatures];
  }

  selectCommander(id: string): boolean {
    if (!this.hasCommander(id)) return false;
    this.data.selectedCommander = id;
    this.save();
    return true;
  }

  buyCommander(id: string): boolean {
    const c = COMMANDERS[id];
    if (!c || this.hasCommander(id) || this.data.stardust < c.price) return false;
    this.data.stardust -= c.price;
    this.data.commanders.push(id);
    this.data.fresh.push(id);
    this.save();
    return true;
  }

  researchPrice(id: string): number | null {
    const c = CREATURES[id];
    if (!c?.unlock || this.hasCreature(id)) return null;
    return RESEARCH_PRICE[c.rarity];
  }

  research(id: string): boolean {
    const price = this.researchPrice(id);
    if (price === null || this.data.stardust < price) return false;
    this.data.stardust -= price;
    this.data.creatures.push(id);
    this.save();
    return true;
  }

  markSeen() {
    this.data.fresh = [];
    this.save();
  }

  /** Bank a finished run: XP, Stardust, level-ups and their unlocks. */
  finishRun(summary: RunSummary): RunResult {
    const d = this.data;
    const rewards = runRewards(summary);
    const levelBefore = d.level;
    d.stats.runs++;
    d.stats.wins += summary.wins;
    d.stats.bestWins = Math.max(d.stats.bestWins, summary.wins);
    if (summary.endlessWins) d.stats.bestEndless = Math.max(d.stats.bestEndless, summary.endlessWins);
    if (summary.champion) d.stats.champions++;
    d.stardust += rewards.stardust;
    d.xp += rewards.xp;
    const levelsGained: LevelReward[] = [];
    const track = rewardTrack();
    while (d.level < MAX_LEVEL && d.xp >= xpToNext(d.level)) {
      d.xp -= xpToNext(d.level);
      d.level++;
      const reward = track.find((t) => t.level === d.level)!;
      levelsGained.push(reward);
      d.stardust += reward.stardust;
      for (const c of reward.creatures) {
        if (!d.creatures.includes(c.id)) {
          d.creatures.push(c.id);
          d.fresh.push(c.id);
        }
      }
      for (const id of reward.commanders) {
        if (!d.commanders.includes(id)) {
          d.commanders.push(id);
          d.fresh.push(id);
        }
      }
    }
    if (d.level >= MAX_LEVEL) d.xp = 0;
    this.save();
    return { rewards, levelsGained, levelBefore, levelAfter: d.level };
  }
}

/** Shared instance for the scenes. */
let current: Profile | null = null;
export function profile(): Profile {
  current ??= new Profile();
  return current;
}

/** Locked creatures a player could research right now, cheapest first. */
export function researchable(p: Profile) {
  return SHOP_POOL.filter((c) => c.unlock && !p.hasCreature(c.id)).sort((a, b) => a.rarity - b.rarity || (a.unlock ?? 0) - (b.unlock ?? 0));
}
