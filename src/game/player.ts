import { Rng, randomSeed } from '../sim/rng';
import { botName } from './ai';

const ID_KEY = 'autobattler.playerId';
const NAME_KEY = 'autobattler.playerName';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: identity just won't persist between visits.
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const h = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20)}`;
}

let cachedId: string | null = null;
let cachedName: string | null = null;

/** Anonymous id so matchmaking never pairs you against your own armies. */
export function playerId(): string {
  cachedId ??= read(ID_KEY) ?? (() => {
    const id = uuid();
    write(ID_KEY, id);
    return id;
  })();
  return cachedId;
}

export const NAME_MAX = 20;

export function cleanName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N} _.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

/** Commander name shown to opponents. Starts as a random one. */
export function playerName(): string {
  cachedName ??= read(NAME_KEY) ?? (() => {
    const name = botName(new Rng(randomSeed()));
    write(NAME_KEY, name);
    return name;
  })();
  return cachedName;
}

export function setPlayerName(raw: string): string {
  const name = cleanName(raw);
  if (!name) return playerName();
  cachedName = name;
  write(NAME_KEY, name);
  return name;
}
