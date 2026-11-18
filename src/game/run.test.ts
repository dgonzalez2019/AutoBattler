import { describe, expect, it } from 'vitest';
import { levelForXp, Run, START_GOLD } from './run';

describe('Run', () => {
  it('buys into an empty slot and spends gold', () => {
    const run = new Run(1);
    expect(run.buy(0, 0)).toBe(true);
    expect(run.gold).toBe(START_GOLD - 3); // round 1 shop is all Commons (3g)
    expect(run.team[0]).not.toBeNull();
    expect(run.shop[0]).toBeNull();
  });

  it('merges duplicates and levels up', () => {
    const run = new Run(1);
    run.team[0] = { defId: 'gearhound', atk: 3, hp: 3, level: 1, xp: 0 };
    run.team[1] = { defId: 'gearhound', atk: 3, hp: 3, level: 1, xp: 0 };
    run.team[2] = { defId: 'gearhound', atk: 3, hp: 3, level: 1, xp: 0 };
    run.move(1, 0);
    run.move(2, 0);
    expect(run.team[0]).toMatchObject({ level: 2, xp: 2, atk: 6, hp: 10 }); // merges +2/+4, evolution +1/+3
    expect(run.team[1]).toBeNull();
  });

  it('cannot buy onto a different creature or without gold', () => {
    const run = new Run(1);
    run.team[0] = { defId: 'drone', atk: 1, hp: 1, level: 1, xp: 0 };
    expect(run.buy(0, 0)).toBe(false);
    run.gold = 0;
    expect(run.buy(0, 1)).toBe(false);
  });

  it('frozen shop slots survive a reroll', () => {
    const run = new Run(2);
    const kept = run.shop[1]!.unit.defId;
    run.toggleFreeze(1);
    run.reroll();
    expect(run.shop[0]!.unit.defId).toBe(kept);
    expect(run.shop[0]!.frozen).toBe(true);
  });

  it('sell refunds gold by level', () => {
    const run = new Run(1);
    run.team[0] = { defId: 'drone', atk: 1, hp: 1, level: 2, xp: 2 };
    run.gold = 0;
    run.sell(0);
    expect(run.gold).toBe(2); // level 2 Common
  });

  it('tracks wins, lives and game end', () => {
    const run = new Run(1);
    run.finishBattle('lose');
    expect(run.lives).toBe(4);
    for (let i = 0; i < 10; i++) run.finishBattle('win');
    expect(run.status).toBe('won');
  });

  it('level thresholds', () => {
    expect([0, 1, 2, 4, 5].map(levelForXp)).toEqual([1, 1, 2, 2, 3]);
  });
});

describe('Mothership', () => {
  it('buys and maxes modules', () => {
    const run = new Run(1);
    run.gold = 100;
    expect(run.buyModule('reactor')).toBe(true);
    expect(run.buyModule('reactor')).toBe(true);
    expect(run.buyModule('reactor')).toBe(true);
    expect(run.buyModule('reactor')).toBe(false);
    expect(run.modules.reactor).toBe(3);
    expect(run.gold).toBe(100 - 3 - 5 - 7);
  });

  it('reactor adds gold each turn', () => {
    const run = new Run({ seed: 1, commander: 'rook' }); // Rook has no gold perk
    run.modules.reactor = 1;
    run.gold = 0;
    run.finishBattle('win'); // base 7 + win 1 + reactor 1
    expect(run.gold).toBe(9);
  });

  it('snapshot lists squads front first with modules', () => {
    const run = new Run(1);
    run.team[2] = { defId: 'drone', atk: 1, hp: 1, level: 1, xp: 0 };
    run.team[0] = { defId: 'gearhound', atk: 3, hp: 3, level: 1, xp: 0 };
    run.modules.armory = 1;
    const snap = run.snapshot('me');
    expect(snap.squads.map((s) => s.defId)).toEqual(['gearhound', 'drone']);
    expect(snap.modules.armory).toBe(1);
    expect(snap.round).toBe(1);
  });
});

describe('Scanner', () => {
  it('shop rolls rarer creatures sooner and gains a slot at level 2', async () => {
    const { Rng } = await import('../sim/rng');
    const { getDef } = await import('../data/creatures');
    const avg = (scanner: number) => {
      let total = 0;
      for (let s = 0; s < 60; s++) {
        const run = new Run({ seed: s, commander: 'rook' });
        run.round = 3;
        run.modules.scanner = scanner;
        run.gold = 99;
        run.reroll();
        total += run.shop.reduce((a, slot) => a + getDef(slot!.unit.defId).rarity, 0) / run.shop.length;
      }
      void Rng;
      return total / 60;
    };
    expect(avg(3)).toBeGreaterThan(avg(0) + 0.3);
    const run = new Run({ seed: 1, commander: 'rook' });
    run.round = 3;
    const before = run.shopSize;
    run.modules.scanner = 2;
    expect(run.shopSize).toBe(before + 1);
  });
});
