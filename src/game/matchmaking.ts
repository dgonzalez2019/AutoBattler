import { GAME_VERSION, onlineEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import { Rng } from '../sim/rng';
import { generateOpponent } from './ai';
import type { ArmySnapshot } from './army';
import { playerId } from './player';
import { parseArmy } from './validate';

/** Where an opponent came from, shown in the battle intro. */
export type OpponentKind = 'online' | 'ghost' | 'ai';

export interface Opponent {
  army: ArmySnapshot;
  kind: OpponentKind;
}

/**
 * Matchmaking works like Super Auto Pets: at round N you fight an army
 * another player saved at round N. Implementations must never throw;
 * the game always gets an opponent.
 */
export interface OpponentSource {
  findOpponent(round: number, seed: number): Promise<Opponent>;
  submit(snapshot: ArmySnapshot): Promise<void>;
}

// ── Local: your own past armies + AI ──────────────────────

const STORAGE_KEY = 'autobattler.ghosts.v1';
const PER_ROUND = 25;
const GHOST_CHANCE = 0.5;

type Pool = Record<string, unknown[]>;

function load(): Pool {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Pool;
  } catch {
    return {};
  }
}

function save(pool: Pool) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pool));
  } catch {
    // Storage blocked or full: matchmaking still works with AI armies.
  }
}

export class LocalOpponentSource implements OpponentSource {
  async findOpponent(round: number, seed: number): Promise<Opponent> {
    const rng = new Rng(seed);
    const ghosts = (load()[round] ?? []).map(parseArmy).filter((a): a is ArmySnapshot => !!a);
    if (ghosts.length && rng.next() < GHOST_CHANCE) {
      const g = rng.pick(ghosts);
      return { army: { ...g, name: `${g.name} (ghost)` }, kind: 'ghost' };
    }
    return { army: generateOpponent(round, seed), kind: 'ai' };
  }

  async submit(snapshot: ArmySnapshot): Promise<void> {
    const pool = load();
    const list = (pool[snapshot.round] ??= []);
    list.push(snapshot);
    if (list.length > PER_ROUND) list.splice(0, list.length - PER_ROUND);
    save(pool);
  }
}

// ── Online: Supabase ──────────────────────────────────────

const TIMEOUT_MS = 4000;

async function call(fetchImpl: typeof fetch, path: string, body: unknown, prefer?: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }
}

export class OnlineOpponentSource implements OpponentSource {
  /** Last network problem, for the UI and debugging. */
  lastError: string | null = null;

  constructor(
    private readonly fallback: OpponentSource = new LocalOpponentSource(),
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  async findOpponent(round: number, seed: number): Promise<Opponent> {
    try {
      const res = await call(this.fetchImpl, 'rpc/find_opponent', {
        p_version: GAME_VERSION,
        p_round: round,
        p_player: playerId(),
      });
      if (!res.ok) throw new Error(`find_opponent ${res.status}`);
      const rows = (await res.json()) as unknown[];
      const army = Array.isArray(rows) && rows.length ? parseArmy(rows[0]) : null;
      this.lastError = null;
      if (army) return { army, kind: 'online' };
    } catch (e) {
      this.lastError = String(e);
    }
    // Nobody online at this round yet (or offline): AI / local ghosts.
    return this.fallback.findOpponent(round, seed);
  }

  async submit(snapshot: ArmySnapshot): Promise<void> {
    void this.fallback.submit(snapshot);
    if (!snapshot.squads.length) return;
    try {
      const res = await call(
        this.fetchImpl,
        'armies',
        {
          player_id: playerId(),
          name: snapshot.name.slice(0, 24),
          version: GAME_VERSION,
          round: snapshot.round,
          wins: snapshot.wins,
          lives: snapshot.lives,
          army: { squads: snapshot.squads, modules: snapshot.modules },
        },
        'return=minimal',
      );
      if (!res.ok) throw new Error(`submit ${res.status}`);
      this.lastError = null;
    } catch (e) {
      this.lastError = String(e);
    }
  }
}

export const opponents: OpponentSource = onlineEnabled() ? new OnlineOpponentSource() : new LocalOpponentSource();
