import { describe, expect, it } from 'vitest';
import { typeMultiplier } from '../data/elements';
import { generateOpponent } from '../game/ai';
import { squadCount, type ArmySnapshot, type SquadSpec } from '../game/army';
import { emptyModules } from '../game/mothership';
import { FieldBattle } from './field';

const army = (squads: SquadSpec[], modules = emptyModules()): ArmySnapshot => ({
  name: 'test',
  round: 1,
  wins: 0,
  lives: 5,
  squads,
  modules,
});
const sq = (defId: string, atk: number, hp: number, level = 1): SquadSpec => ({ defId, atk, hp, level });

describe('type wheel', () => {
  it('each element beats the next', () => {
    expect(typeMultiplier('plasma', 'mech')).toBe(1.5);
    expect(typeMultiplier('mech', 'plasma')).toBe(0.75);
    expect(typeMultiplier('void', 'plasma')).toBe(1.5);
    expect(typeMultiplier('plasma', 'cryo')).toBe(1);
  });
});

describe('squads', () => {
  it('size grows with level and barracks', () => {
    expect(squadCount('bryobit', 1)).toBe(6);
    expect(squadCount('bryobit', 2)).toBe(9);
    expect(squadCount('bryobit', 3)).toBe(12);
    expect(squadCount('bryobit', 1, 2)).toBe(9); // Barracks 2: +50%
    expect(squadCount('phoenyx', 1, 3)).toBe(1); // Legendaries stay solo
    expect(squadCount('mechadon', 1)).toBe(2);
  });

  it('deploys every creature in every squad', () => {
    const b = new FieldBattle([army([sq('bryobit', 2, 3), sq('gearhound', 3, 3)]), army([sq('drone', 1, 1)])], 1);
    expect(b.aliveCount(0)).toBe(10);
    expect(b.aliveCount(1)).toBe(1);
  });
});

describe('FieldBattle', () => {
  it('is deterministic for the same seed', () => {
    const a = army([sq('sparkit', 2, 2), sq('bryobit', 2, 3)]);
    const e = army([sq('nullmite', 3, 1), sq('frostling', 1, 4)]);
    const run = () => {
      const b = new FieldBattle([a, e], 42);
      const r = b.runToEnd();
      return { r, t: b.time, alive: b.units.filter((u) => u.alive).map((u) => [u.id, u.hp, u.x.toFixed(3)]) };
    };
    expect(run()).toEqual(run());
  });

  it('a much stronger army wins, an empty army loses', () => {
    expect(new FieldBattle([army([sq('gearhound', 10, 10)]), army([sq('bryobit', 1, 1)])], 1).runToEnd()).toBe('win');
    expect(new FieldBattle([army([]), army([sq('bryobit', 1, 1)])], 1).runToEnd()).toBe('lose');
  });

  it('mirror matches are close', () => {
    let wins = 0;
    let losses = 0;
    for (let s = 0; s < 20; s++) {
      const r = new FieldBattle([army([sq('gearhound', 3, 3)]), army([sq('gearhound', 3, 3)])], s).runToEnd();
      if (r === 'win') wins++;
      if (r === 'lose') losses++;
    }
    expect(Math.abs(wins - losses)).toBeLessThanOrEqual(10);
  });

  it('mothership armory and shields boost units', () => {
    const mods = { ...emptyModules(), armory: 2, shields: 2 };
    const b = new FieldBattle([army([sq('gearhound', 10, 30)], mods), army([sq('gearhound', 10, 30)])], 1);
    const mine = b.units.find((u) => u.side === 0)!;
    const theirs = b.units.find((u) => u.side === 1)!;
    expect(mine.atk).toBe(13); // Armory 2: +30%
    expect(mine.shield - theirs.shield).toBe(9); // Shield Bay 2: 30% of 30 health
  });

  it('faint summons tokens onto the field', () => {
    const b = new FieldBattle([army([sq('nullmite', 1, 1)]), army([sq('mechadon', 5, 30)])], 1);
    b.runToEnd();
    expect(b.units.some((u) => u.defId === 'voidspawn')).toBe(true);
  });

  it('every round of AI armies resolves without errors', () => {
    for (let round = 1; round <= 14; round++) {
      for (let s = 0; s < 6; s++) {
        const b = new FieldBattle([generateOpponent(round, s * 31 + round), generateOpponent(round, s * 17 + 5)], s);
        expect(['win', 'lose', 'draw']).toContain(b.runToEnd());
      }
    }
  });
});

describe('Mothership weapons', () => {
  it('Orbital Cannon strikes enemies every 6s; Med Bay heals every 5s', () => {
    const mods = { ...emptyModules(), orbital: 2, medbay: 1 };
    const b = new FieldBattle([army([sq('glaciarch', 1, 400)], mods), army([sq('glaciarch', 1, 400), sq('thornback', 1, 400)])], 1);
    let strikes = 0;
    let heals = 0;
    for (let i = 0; i < 260 && !b.result; i++) {
      b.step();
      for (const e of b.events) {
        if (e.t === 'orbital' && e.side === 0) strikes += e.ids.length;
        if (e.t === 'medbay' && e.side === 0) heals++;
      }
      b.events = [];
    }
    expect(strikes).toBeGreaterThanOrEqual(3 * 2); // ~13s: two volleys of 3
    expect(heals).toBeGreaterThanOrEqual(1);
  });
});
