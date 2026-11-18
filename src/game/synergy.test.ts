import { describe, expect, it } from 'vitest';
import { CREATURES, SHOP_POOL } from '../data/creatures';
import { FieldBattle } from '../sim/field';
import type { ArmySnapshot, SquadSpec } from './army';
import { squadCount } from './army';
import { computeTraits } from './synergy';

const sq = (defId: string, level = 1): SquadSpec => ({ defId, atk: CREATURES[defId].atk, hp: CREATURES[defId].hp, level });
const army = (squads: SquadSpec[]): ArmySnapshot => ({ name: 't', round: 1, wins: 0, lives: 5, squads });

describe('computeTraits', () => {
  it('counts distinct species and activates tiers', () => {
    const t = computeTraits([sq('sparkit'), sq('ionix'), sq('sparkit')]);
    expect(t.counts.plasma).toBe(2);
    expect(t.counts.gunner).toBe(2);
    expect(t.levels.plasma).toBe(1);
    expect(t.levels.gunner).toBe(1);
    const t3 = computeTraits([sq('sparkit'), sq('ionix'), sq('novaraptor')]);
    expect(t3.levels.plasma).toBe(2);
  });

  it('every shop creature has a class, role and at least one ability', () => {
    for (const c of SHOP_POOL) {
      expect(c.class).toBeTruthy();
      expect(c.role.length).toBeGreaterThan(5);
      expect(c.abilities.length).toBeGreaterThan(0);
    }
  });
});

describe('synergies in battle', () => {
  it('Mech 2 gives Mech units a starting shield', () => {
    const b = new FieldBattle([army([sq('boltbug'), sq('gearhound')]), army([sq('bryobit')])], 1);
    expect(b.units.filter((u) => u.side === 0).every((u) => u.shield > 0)).toBe(true);
  });

  it('Vanguard 2 reduces damage taken', () => {
    const b = new FieldBattle([army([sq('frostling'), sq('thornback')]), army([sq('bryobit')])], 1);
    expect(b.units.find((u) => u.side === 0)!.damageTaken).toBeCloseTo(0.85);
  });

  it('Swarm 2 adds units to swarm squads', () => {
    expect(squadCount('bryobit', 1, 1)).toBe(8);
    const b = new FieldBattle([army([sq('bryobit'), sq('boltbug')]), army([sq('frostling')])], 1);
    expect(b.aliveCount(0)).toBe(16);
  });

  it('Plasma attacks burn and Void lifesteals', () => {
    const plasma = new FieldBattle([army([sq('sparkit'), sq('ionix')]), army([sq('glaciarch')])], 3);
    let burned = false;
    for (let i = 0; i < 400 && !plasma.result; i++) {
      plasma.step();
      if (plasma.units.some((u) => u.side === 1 && u.burn > 0)) burned = true;
    }
    expect(burned).toBe(true);
    const v = new FieldBattle([army([sq('nullmite'), sq('wraithling')]), army([sq('bryobit')])], 1);
    expect(v.units.find((u) => u.side === 0)!.lifesteal).toBe(0.35);
  });

  it('timed abilities fire (Worldroot sprouts saplings)', () => {
    const b = new FieldBattle([army([sq('worldroot')]), army([sq('glaciarch')])], 1);
    for (let i = 0; i < 200 && !b.result; i++) b.step();
    expect(b.units.some((u) => u.defId === 'sproutling')).toBe(true);
  });
});
