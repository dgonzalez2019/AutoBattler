import { describe, expect, it } from 'vitest';
import { emptyModules } from '../game/mothership';
import { Run, rollCreature } from '../game/run';
import { FieldBattle } from '../sim/field';
import { Rng } from '../sim/rng';
import { CREATURES, SHOP_POOL } from './creatures';
import { ELEMENTS } from './elements';
import { RARITY, rollRarity, sellValue, shopOdds } from './rarity';

const army = (squads: { defId: string; level?: number }[]) => ({
  name: 't', round: 1, wins: 0, lives: 5, modules: emptyModules(),
  squads: squads.map((s) => ({ defId: s.defId, atk: CREATURES[s.defId].atk, hp: CREATURES[s.defId].hp, level: s.level ?? 1 })),
});

describe('rarity', () => {
  it('odds always add up to 100% and get rarer over time', () => {
    for (let r = 1; r <= 20; r++) expect(shopOdds(r).reduce((a, b) => a + b)).toBe(100);
    expect(shopOdds(1)[0]).toBe(100);
    expect(shopOdds(12)[4]).toBeGreaterThan(0);
  });

  it('rollRarity follows the odds', () => {
    expect(rollRarity(1, 0.999)).toBe(1);
    expect(rollRarity(11, 0.999)).toBe(5);
    expect(rollRarity(11, 0)).toBe(1);
  });

  it('each element has 3 Common, 2 Uncommon, 2 Rare, 1 Epic, 1 Legendary', () => {
    for (const el of ELEMENTS) {
      const counts = [1, 2, 3, 4, 5].map((r) => SHOP_POOL.filter((c) => c.element === el && c.rarity === r).length);
      expect(counts).toEqual([3, 2, 2, 1, 1]);
    }
    expect(SHOP_POOL.length).toBe(45);
  });

  it('round 1 shops only roll Commons; late shops can roll Legendaries', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 200; i++) expect(rollCreature(rng, 1).rarity).toBe(1);
    const late = [...Array(2000)].map(() => rollCreature(rng, 12).rarity);
    expect(late).toContain(5);
  });

  it('prices and refunds follow rarity', () => {
    const run = new Run(1);
    run.round = 11;
    run.shop = [{ unit: { defId: 'phoenyx', atk: 9, hp: 36, level: 1, xp: 0 }, frozen: false }];
    run.gold = 7;
    expect(run.buy(0, 0)).toBe(false);
    run.gold = 8;
    expect(run.buy(0, 0)).toBe(true);
    expect(run.gold).toBe(0);
    expect(RARITY[5].cost).toBe(8);
    expect(sellValue(5, 1)).toBe(5);
    run.sell(0);
    expect(run.gold).toBe(5);
  });

  it('shop grows from 3 to 4 to 5 slots', () => {
    const run = new Run(1);
    expect(run.shopSize).toBe(3);
    run.round = 3;
    expect(run.shopSize).toBe(4);
    run.round = 7;
    expect(run.shopSize).toBe(5);
  });
});

describe('new mechanics', () => {
  it('Phoenyx is reborn exactly once', () => {
    const b = new FieldBattle([army([{ defId: 'phoenyx' }]), army([{ defId: 'omegatron', level: 3 }, { defId: 'glaciarch', level: 3 }])], 1);
    b.runToEnd();
    expect(b.units.filter((u) => u.defId === 'phoenyx')).toHaveLength(2);
  });

  it('ally-faint creatures grow when allies die', () => {
    const b = new FieldBattle([army([{ defId: 'voidmaw' }, { defId: 'nullmite' }]), army([{ defId: 'mechadon', level: 2 }])], 2);
    const start = b.units.find((u) => u.defId === 'voidmaw')!.atk;
    for (let i = 0; i < 600 && !b.result; i++) b.step();
    const maw = b.units.find((u) => u.defId === 'voidmaw')!;
    expect(maw.atk).toBeGreaterThan(start);
  });

  it('every creature can fight every other without errors', () => {
    for (const a of SHOP_POOL) {
      const r = new FieldBattle([army([{ defId: a.id }]), army([{ defId: SHOP_POOL[(a.id.length * 7) % SHOP_POOL.length].id }])], a.id.length).runToEnd();
      expect(['win', 'lose', 'draw']).toContain(r);
    }
  });
});
