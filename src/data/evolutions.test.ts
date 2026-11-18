import { describe, expect, it } from 'vitest';
import { Run } from '../game/run';
import { CREATURES, SHOP_POOL } from './creatures';
import { EVOLUTIONS, evolves, formName } from './evolutions';

describe('evolutions', () => {
  it('every non-legendary shop creature has two evolved forms; legendaries ascend', () => {
    for (const c of SHOP_POOL) {
      if (c.rarity === 5) {
        expect(evolves(c)).toBe(false);
        expect(formName(c, 2)).toBe(`Ascended ${c.name}`);
        expect(formName(c, 3)).toBe(`Exalted ${c.name}`);
      } else {
        expect(EVOLUTIONS[c.id]).toHaveLength(2);
        expect(formName(c, 1)).toBe(c.name);
        expect(formName(c, 2)).toBe(EVOLUTIONS[c.id][0]);
        expect(formName(c, 3)).toBe(EVOLUTIONS[c.id][1]);
      }
    }
  });

  it('evolution names are unique', () => {
    const names = Object.values(EVOLUTIONS).flat();
    expect(new Set(names).size).toBe(names.length);
  });

  it('merging to level 2 and 3 applies the evolution stat jumps', () => {
    const run = new Run({ seed: 1, commander: 'rook' });
    const base = CREATURES.bryobit;
    const copy = () => ({ defId: 'bryobit', atk: base.atk, hp: base.hp, level: 1, xp: 0 });
    run.team = [copy(), copy(), copy(), copy(), copy()];
    run.move(1, 0); // xp 1
    run.move(2, 0); // xp 2 -> level 2 (evolves)
    const lv2 = { ...run.team[0]! };
    expect(lv2.level).toBe(2);
    expect(lv2.atk).toBe(base.atk + 2 + 1); // two merges + evolution
    expect(lv2.hp).toBe(base.hp + 4 + 3);
    run.move(3, 0);
    run.move(4, 0); // xp 4, still level 2
    expect(run.team[0]!.level).toBe(2);
  });
});
