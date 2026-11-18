import { describe, expect, it } from 'vitest';
import { GAME_VERSION } from '../config';
import { generateOpponent } from './ai';
import type { ArmySnapshot } from './army';
import { OnlineOpponentSource, type Opponent, type OpponentSource } from './matchmaking';
import { emptyModules } from './mothership';
import { parseArmy } from './validate';

const aiFallback: OpponentSource = {
  findOpponent: async (round, seed) => ({ army: generateOpponent(round, seed), kind: 'ai' }),
  submit: async () => {},
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const row = {
  name: 'Rival',
  round: 3,
  wins: 2,
  lives: 4,
  army: { squads: [{ defId: 'gearhound', atk: 4, hp: 14, level: 2 }], modules: { armory: 1 } },
};

describe('parseArmy', () => {
  it('accepts a well-formed army and fills in missing modules', () => {
    const a = parseArmy(row)!;
    expect(a.name).toBe('Rival');
    expect(a.squads[0]).toEqual({ defId: 'gearhound', atk: 4, hp: 14, level: 2 });
    expect(a.modules).toEqual({ ...emptyModules(), armory: 1 });
  });

  it('rejects unknown creatures, tokens, bad levels and absurd stats', () => {
    const bad = (squad: object) => parseArmy({ ...row, army: { squads: [squad], modules: {} } });
    expect(bad({ defId: 'pikachu', atk: 1, hp: 1, level: 1 })).toBeNull();
    expect(bad({ defId: 'drone', atk: 1, hp: 1, level: 1 })).toBeNull();
    expect(bad({ defId: 'gearhound', atk: 1, hp: 1, level: 7 })).toBeNull();
    expect(bad({ defId: 'gearhound', atk: 99999, hp: 1, level: 1 })).toBeNull();
    expect(bad({ defId: 'gearhound', atk: 1.5, hp: 1, level: 1 })).toBeNull();
    expect(parseArmy({ ...row, army: { squads: [], modules: {} } })).toBeNull();
    expect(parseArmy('nonsense')).toBeNull();
  });

  it('clamps module levels to their max', () => {
    const a = parseArmy({ ...row, army: { ...row.army, modules: { barracks: 99, reactor: 1 } } })!;
    expect(a.modules.barracks).toBe(0);
    expect(a.modules.reactor).toBe(1);
  });
});

describe('OnlineOpponentSource', () => {
  it('returns an online opponent from find_opponent', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const src = new OnlineOpponentSource(aiFallback, async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init!.body)) });
      return json([row]);
    });
    const opp: Opponent = await src.findOpponent(3, 1);
    expect(opp.kind).toBe('online');
    expect(opp.army.name).toBe('Rival');
    expect(calls[0].url).toContain('/rest/v1/rpc/find_opponent');
    expect(calls[0].body).toMatchObject({ p_version: GAME_VERSION, p_round: 3 });
  });

  it('falls back to AI when nobody is online at this round', async () => {
    const src = new OnlineOpponentSource(aiFallback, async () => json([]));
    expect((await src.findOpponent(3, 1)).kind).toBe('ai');
  });

  it('falls back to AI on server errors, network failures and tampered armies', async () => {
    const err = new OnlineOpponentSource(aiFallback, async () => json({ message: 'boom' }, 500));
    expect((await err.findOpponent(2, 1)).kind).toBe('ai');
    expect(err.lastError).toContain('500');
    const down = new OnlineOpponentSource(aiFallback, async () => {
      throw new TypeError('fetch failed');
    });
    expect((await down.findOpponent(2, 1)).kind).toBe('ai');
    const tampered = new OnlineOpponentSource(aiFallback, async () =>
      json([{ ...row, army: { squads: [{ defId: 'gearhound', atk: 1e9, hp: 1, level: 1 }], modules: {} } }]),
    );
    expect((await tampered.findOpponent(2, 1)).kind).toBe('ai');
  });

  it('submits the army with version, round and record', async () => {
    let sent: Record<string, unknown> | null = null;
    const src = new OnlineOpponentSource(aiFallback, async (_url, init) => {
      sent = JSON.parse(String(init!.body));
      return new Response(null, { status: 201 });
    });
    const snap: ArmySnapshot = {
      name: 'Me',
      round: 4,
      wins: 1,
      lives: 3,
      squads: [{ defId: 'sparkit', atk: 2, hp: 6, level: 1 }],
      modules: emptyModules(),
    };
    await src.submit(snap);
    expect(sent).toMatchObject({ name: 'Me', version: GAME_VERSION, round: 4, wins: 1, lives: 3 });
    expect((sent as unknown as { army: { squads: unknown[] } }).army.squads).toHaveLength(1);
    expect(src.lastError).toBeNull();
  });
});
