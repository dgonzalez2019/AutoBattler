import { describe, expect, it } from 'vitest';
import { CREATURES } from '../data/creatures';
import { FieldBattle, GROW_CAP } from '../sim/field';
import { Run, type TeamUnit } from './run';

const unit = (defId: string, level = 1): TeamUnit => ({ defId, atk: CREATURES[defId].atk, hp: CREATURES[defId].hp, level, xp: level === 2 ? 2 : 0 });
const army = (squads: TeamUnit[]) => ({ name: 't', round: 5, wins: 0, lives: 5, squads: squads.map(({ defId, atk, hp, level }) => ({ defId, atk, hp, level })) });

describe('Shop growth (permanent buffs while shopping)', () => {
  it('Start of turn: Cinderling grows every turn', () => {
    const run = new Run({ seed: 1, commander: 'rook' });
    run.team[0] = unit('cinderling');
    run.finishBattle('win');
    run.finishBattle('win');
    expect(run.team[0]!.atk).toBe(CREATURES.cinderling.atk + 2);
    expect(run.team[0]!.grownAtk).toBe(2);
  });

  it('Sell: Sparkit buffs the squads next to it', () => {
    const run = new Run({ seed: 1, commander: 'rook' });
    run.team = [unit('bryobit'), unit('sparkit'), unit('frostling'), null, null];
    run.sell(1);
    expect(run.team[0]!.atk).toBe(CREATURES.bryobit.atk + 1);
    expect(run.team[2]!.atk).toBe(CREATURES.frostling.atk + 1);
  });

  it('Ally bought: Budling grows when you recruit', () => {
    const run = new Run({ seed: 1, commander: 'rook' });
    run.team[0] = unit('budling');
    run.gold = 50;
    run.shop = [{ unit: unit('sparkit'), frozen: false }];
    run.buy(0, 1);
    expect(run.team[0]!.hp).toBe(CREATURES.budling.hp + 1);
  });
});

describe('Battle growth (kept after the fight)', () => {
  it('Kill growth is recorded per squad and capped per battle', () => {
    const b = new FieldBattle([army([unit('shardcub', 3)]), army([unit('bryobit'), unit('nullmite')])], 4);
    b.runToEnd();
    const g = b.growth[0].get(0);
    expect(g).toBeDefined();
    expect(g!.times).toBeLessThanOrEqual(GROW_CAP);
    expect(g!.atk).toBe(g!.times * 3); // +1 attack per growth, x3 at level 3
  });

  it('Battle won: survivors of the winning army grow', () => {
    const b = new FieldBattle([army([unit('thornback', 3)]), army([unit('sparkit')])], 2);
    expect(b.runToEnd()).toBe('win');
    expect(b.growth[0].get(0)!.hp).toBeGreaterThan(0);
  });

  it('the run applies battle growth to the right army slot', () => {
    const run = new Run({ seed: 1, commander: 'rook' });
    run.team = [null, unit('frostling'), null, unit('shardcub'), null];
    // Lineup is front-first without gaps: squad 1 = the Shardcub in slot 3
    const report = run.applyBattleGrowth(new Map([[1, { atk: 2, hp: 0 }]]));
    expect(run.team[3]!.atk).toBe(CREATURES.shardcub.atk + 2);
    expect(run.team[3]!.grownAtk).toBe(2);
    expect(report).toEqual([{ defId: 'shardcub', level: 1, atk: 2, hp: 0 }]);
  });
});

describe('Evolve growth', () => {
  it('Evolve: Bryobit buffs your Bio squads when it evolves', () => {
    const run = new Run({ seed: 1, commander: 'rook' });
    run.team = [unit('bryobit'), unit('bryobit'), unit('bryobit'), unit('thornback'), null];
    run.move(1, 0);
    run.move(2, 0); // level 2: evolves
    expect(run.team[0]!.level).toBe(2);
    // Evolve at level 2 gives Bio squads +2/+2 (+1/+1 scaled by the new level)
    expect(run.team[3]!.atk).toBe(CREATURES.thornback.atk + 2);
    expect(run.team[3]!.grownHp).toBe(2);
  });
});
