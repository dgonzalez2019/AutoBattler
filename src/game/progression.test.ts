import { describe, expect, it } from 'vitest';
import { COMMANDER_LIST } from '../data/commanders';
import { BASE_POOL, CREATURES, SHOP_POOL } from '../data/creatures';
import { rewardTrack, runRewards, xpToNext } from '../data/progression';
import { FieldBattle } from '../sim/field';
import { emptyModules } from './mothership';
import { newProfile, Profile } from './profile';
import { Run } from './run';

const fresh = () => new Profile(newProfile());
const army = (ids: string[], commander?: string) => ({
  name: 't', round: 5, wins: 0, lives: 5, modules: emptyModules(), commander,
  squads: ids.map((id) => ({ defId: id, atk: CREATURES[id].atk, hp: CREATURES[id].hp, level: 1 })),
});

describe('profile', () => {
  it('starts at level 1 with the base roster and starter commanders', () => {
    const p = fresh();
    expect(p.data.level).toBe(1);
    expect(p.shopPool()).toHaveLength(BASE_POOL.length);
    expect(p.hasCommander('nova')).toBe(true);
    expect(p.hasCommander('rook')).toBe(true);
    expect(p.hasCommander('prime')).toBe(false);
    expect(p.hasCreature('supernova')).toBe(false);
  });

  it('runs grant XP and Stardust, and level-ups unlock creatures and commanders', () => {
    const p = fresh();
    const res = p.finishRun({ wins: 10, rounds: 14, champion: true });
    expect(res.rewards.xp).toBe(runRewards({ wins: 10, rounds: 14, champion: true }).xp);
    expect(res.levelAfter).toBeGreaterThan(1);
    const unlockedCreatures = res.levelsGained.flatMap((l) => l.creatures.map((c) => c.id));
    expect(unlockedCreatures.length).toBeGreaterThan(0);
    for (const id of unlockedCreatures) expect(p.hasCreature(id)).toBe(true);
    expect(p.data.fresh.length).toBeGreaterThan(0);
    expect(p.data.stats.champions).toBe(1);
  });

  it('every unlockable creature and commander sits on the reward track', () => {
    const track = rewardTrack();
    const creatures = track.flatMap((t) => t.creatures.map((c) => c.id));
    expect(new Set(creatures).size).toBe(SHOP_POOL.length - BASE_POOL.length);
    const commanders = track.flatMap((t) => t.commanders);
    expect(commanders.length + COMMANDER_LIST.filter((c) => c.unlockLevel <= 1).length).toBe(COMMANDER_LIST.length);
  });

  it('XP curve grows with level', () => {
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1));
  });

  it('Stardust buys commanders and researches creatures', () => {
    const p = fresh();
    expect(p.buyCommander('zix')).toBe(false);
    p.data.stardust = 1000;
    expect(p.buyCommander('zix')).toBe(true);
    expect(p.hasCommander('zix')).toBe(true);
    const price = p.researchPrice('supernova')!;
    expect(p.research('supernova')).toBe(true);
    expect(p.data.stardust).toBe(1000 - 250 - price);
    expect(p.shopPool()).toContain('supernova');
  });
});

describe('commanders', () => {
  it('shop pool only rolls unlocked creatures', () => {
    const run = new Run({ seed: 3, pool: ['sparkit', 'bryobit'] });
    for (let i = 0; i < 20; i++) {
      run.gold = 99;
      run.reroll();
      for (const s of run.shop) expect(['sparkit', 'bryobit']).toContain(s!.unit.defId);
    }
  });

  it('economy passives: Zix free reroll + sell bonus, Orin extra slot, Prime lives, Nova gold', () => {
    const zix = new Run({ seed: 1, commander: 'zix' });
    const g = zix.gold;
    expect(zix.rerollCost).toBe(0);
    zix.reroll();
    expect(zix.gold).toBe(g);
    expect(zix.rerollCost).toBe(1);
    expect(new Run({ seed: 1, commander: 'orin' }).shopSize).toBe(4);
    expect(new Run({ seed: 1, commander: 'prime' }).lives).toBe(7);
    const nova = new Run({ seed: 1, commander: 'nova' });
    nova.finishBattle('win');
    expect(nova.gold).toBe(11);
  });

  it('economy creatures bank gold for next turn', () => {
    const run = new Run({ seed: 1, commander: 'rook' });
    run.team[0] = { defId: 'sparkplug', atk: 2, hp: 6, level: 2, xp: 2 };
    run.endTurn();
    expect(run.bankedGold).toBe(2);
    run.finishBattle('win');
    expect(run.gold).toBe(12);
  });

  it('Thalia buffs Bio creatures on buy', () => {
    const run = new Run({ seed: 1, commander: 'thalia' });
    run.shop = [{ unit: { defId: 'bryobit', atk: 2, hp: 9, level: 1, xp: 0 }, frozen: false }];
    run.buy(0, 0);
    expect(run.team[0]).toMatchObject({ atk: 3, hp: 13 });
  });

  it('battle passives apply: Rook front HP, Bolt mech shield, Kira opening chill, Vex gunner attack', () => {
    const rook = new FieldBattle([army(['gearhound', 'bryobit'], 'rook'), army(['bryobit'])], 1);
    expect(rook.units.find((u) => u.defId === 'gearhound')!.maxHp).toBe(CREATURES.gearhound.hp + 6);
    const bolt = new FieldBattle([army(['gearhound'], 'bolt'), army(['bryobit'])], 1);
    expect(bolt.units.find((u) => u.side === 0)!.shield).toBe(5);
    const kira = new FieldBattle([army(['gearhound'], 'kira'), army(['bryobit'])], 1);
    expect(kira.units.filter((u) => u.side === 1).every((u) => u.chill > 0)).toBe(true);
    const vex = new FieldBattle([army(['sparkit'], 'vex'), army(['bryobit'])], 1);
    expect(vex.units.find((u) => u.side === 0)!.atk).toBe(CREATURES.sparkit.atk + 2);
  });

  it('every commander can battle with every element without errors', () => {
    for (const c of COMMANDER_LIST) {
      const r = new FieldBattle([army(['sparkit', 'boltbug', 'frostling', 'bryobit', 'nullmite'], c.id), army(['emberpup', 'gearhound', 'shardcub'], 'hollow')], 7).runToEnd();
      expect(['win', 'lose', 'draw']).toContain(r);
    }
  });
});

describe('reward track layout', () => {
  it('no level unlocks more than 3 things', () => {
    for (const t of rewardTrack()) expect(t.creatures.length + t.commanders.length).toBeLessThanOrEqual(3);
  });
});
