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


