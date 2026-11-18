import { describe, expect, it } from 'vitest';
import { SHOP_POOL } from '../data/creatures';
import { typeMultiplier } from '../data/elements';
import { generateOpponent } from '../game/ai';
import { simulateBattle, type UnitSpec } from './battle';

const u = (defId: string, atk: number, hp: number, level = 1): UnitSpec => ({ defId, atk, hp, level });

describe('type wheel', () => {
  it('each element beats the next', () => {
    expect(typeMultiplier('plasma', 'mech')).toBe(1.5);
    expect(typeMultiplier('mech', 'plasma')).toBe(0.75);
    expect(typeMultiplier('void', 'plasma')).toBe(1.5);
    expect(typeMultiplier('plasma', 'cryo')).toBe(1);
  });
});

describe('simulateBattle', () => {
  it('is deterministic for the same seed', () => {
    const a = [u('sparkit', 2, 2), u('bryobit', 2, 3)];
    const b = [u('nullmite', 3, 1), u('frostling', 1, 4)];
    expect(simulateBattle(a, b, 7)).toEqual(simulateBattle(a, b, 7));
  });

  it('stronger team wins, empty team loses', () => {
    expect(simulateBattle([u('gearhound', 10, 10)], [u('gearhound', 1, 1)], 1).result).toBe('win');
    expect(simulateBattle([], [u('gearhound', 1, 1)], 1).result).toBe('lose');
  });

  it('mutual knockout is a draw', () => {
    expect(simulateBattle([u('gearhound', 3, 3)], [u('gearhound', 3, 3)], 1).result).toBe('draw');
  });

  it('applies type advantage to attacks', () => {
    // Plasma (Sparkit) vs Mech (Gearhound): 2 * 1.5 = 3 damage.
    const log = simulateBattle([u('ionix', 2, 10)], [u('gearhound', 1, 3)], 1);
    const hit = log.events.find((e) => e.t === 'damage' && e.eff === 'super');
    expect(hit && hit.t === 'damage' && hit.amount).toBe(3);
    expect(log.result).toBe('win');
  });

  it('faint summons a token in the vacated slot', () => {
    const log = simulateBattle([u('nullmite', 1, 1)], [u('gearhound', 1, 5)], 1);
    const summon = log.events.find((e) => e.t === 'summon');
    expect(summon && summon.t === 'summon' && summon.unit.defId).toBe('voidspawn');
  });

  it('ability numbers scale with level', () => {
    const log = simulateBattle([u('sparkit', 1, 50, 3)], [u('gearhound', 1, 50)], 3);
    const zap = log.events.find((e) => e.t === 'damage');
    expect(zap && zap.t === 'damage' && zap.amount).toBe(3);
  });

  it('every creature can battle every round without errors', () => {
    for (let round = 1; round <= 15; round++) {
      for (let s = 0; s < 20; s++) {
        const a = generateOpponent(round, s * 31 + round);
        const b = generateOpponent(round, s * 17 + 5);
        const log = simulateBattle(a, b, s);
        expect(['win', 'lose', 'draw']).toContain(log.result);
      }
    }
    expect(SHOP_POOL.length).toBeGreaterThanOrEqual(15);
  });
});
