import type { Element } from './elements';
import type { CreatureClass } from './traits';

/**
 * Commanders: pick one before each run. Each has a single passive that bends
 * how you play. Effects are data; the run state (shop) and the battle sim
 * read the fields they care about.
 */
export interface CommanderEffects {
  // Shop / economy
  extraShopSlot?: number;
  freeRerollsPerTurn?: number;
  sellBonus?: number;
  goldEveryOtherRound?: number;
  startLives?: number;
  /** Creatures of this element cost less gold. */
  elementDiscount?: { element: Element; amount: number };
  /** Bonus stats given whenever you buy a creature of this element. */
  buyBonus?: { element: Element; atk: number; hp: number };
  // Battle
  burnBonus?: number;
  mechShield?: number;
  chillAllSeconds?: number;
  voidRiseChance?: number;
  swarmExtraUnits?: number;
  frontSquadHp?: number;
  timerPrecharge?: number;
  classAtk?: { cls: CreatureClass; atk: number };
}

export interface CommanderDef {
  id: string;
  name: string;
  title: string;
  /** Short line shown everywhere the commander appears. */
  passive: string;
  effects: CommanderEffects;
  /** Unlock: reached at this Commander Level, or bought earlier with Stardust. */
  unlockLevel: number;
  price: number;
  color: number;
  /** Feeds the portrait prompt. */
  look: string;
}

const list: CommanderDef[] = [
  {
    id: 'nova', name: 'Nova', title: 'Fleet Captain', unlockLevel: 1, price: 0, color: 0x4cc9f0,
    passive: 'Every other round, start the turn with +1 gold.',
    effects: { goldEveryOtherRound: 1 },
    look: 'confident young starship captain with a blue flight jacket, short silver hair and a holographic visor',
  },
  {
    id: 'rook', name: 'Rook', title: 'Iron Vanguard', unlockLevel: 1, price: 0, color: 0xf4a261,
    passive: 'Your front squad gets +6 health on every creature.',
    effects: { frontSquadHp: 6 },
    look: 'grizzled heavy-armored veteran soldier with a scarred face and a huge riot shield on his back',
  },
  {
    id: 'zix', name: 'Zix', title: 'Black-Market Broker', unlockLevel: 2, price: 250, color: 0xffd166,
    passive: 'First reroll each turn is free. Selling gives +1 gold.',
    effects: { freeRerollsPerTurn: 1, sellBonus: 1 },
    look: 'sly four-armed alien merchant with gold jewelry, a long coat and glowing amber eyes',
  },
  {
    id: 'pyra', name: 'Pyra', title: 'Warlord of Embers', unlockLevel: 3, price: 300, color: 0xff6a3d,
    passive: 'Every Burn you apply has +1 stack.',
    effects: { burnBonus: 1 },
    look: 'fierce warrior woman in crimson plasma armor with flaming hair and a burning greatsword',
  },
  {
    id: 'thalia', name: 'Dr. Thalia', title: 'Xenobotanist', unlockLevel: 4, price: 300, color: 0x52b788,
    passive: 'Bio creatures you buy get +1 attack and +4 health.',
    effects: { buyBonus: { element: 'bio', atk: 1, hp: 4 } },
    look: 'kind scientist in a green lab coat with vines and glowing flowers growing on her shoulders',
  },
  {
    id: 'bolt', name: 'Bolt', title: 'Chief Engineer', unlockLevel: 5, price: 350, color: 0x8d99ae,
    passive: 'Mech units start with +5 Shield. Mech creatures cost 1 gold less.',
    effects: { mechShield: 5, elementDiscount: { element: 'mech', amount: 1 } },
    look: 'cheerful stocky engineer with mechanical goggles, a robotic arm and a tool belt full of gadgets',
  },
  {
    id: 'kira', name: 'Kira', title: 'Frost Marshal', unlockLevel: 6, price: 350, color: 0x9bdcff,
    passive: 'Start of battle: Chill ALL enemies for 1.5s.',
    effects: { chillAllSeconds: 1.5 },
    look: 'stern marshal in white and ice-blue armor with a frost cape and a crystalline spear',
  },
  {
    id: 'hollow', name: 'The Hollow King', title: 'Void Sovereign', unlockLevel: 7, price: 400, color: 0x9d4edd,
    passive: 'When your creatures die, 25% chance a 2/4 Voidspawn rises.',
    effects: { voidRiseChance: 0.25 },
    look: 'mysterious hooded king with a starry void where his face should be and a cracked crown',
  },
  {
    id: 'hive', name: 'Matriarch Vessa', title: 'Hive Mother', unlockLevel: 8, price: 400, color: 0x90be6d,
    passive: 'Swarm squads field +2 extra creatures.',
    effects: { swarmExtraUnits: 2 },
    look: 'regal insectoid alien queen with iridescent wings and a staff topped with a glowing egg',
  },
  {
    id: 'orin', name: 'Orin', title: 'Grand Tactician', unlockLevel: 9, price: 450, color: 0xe0aaff,
    passive: 'Your shop always has 1 extra slot.',
    effects: { extraShopSlot: 1 },
    look: 'elderly strategist with a long braided beard, a tactical monocle and floating holographic maps',
  },
  {
    id: 'lumen', name: 'Lumen', title: 'Starseer', unlockLevel: 10, price: 450, color: 0xc77dff,
    passive: 'Timed abilities start every battle 60% charged.',
    effects: { timerPrecharge: 0.6 },
    look: 'serene mystic with glowing constellation tattoos, flowing robes and three floating star orbs',
  },
  {
    id: 'vex', name: 'Vex', title: 'Gunmaster', unlockLevel: 11, price: 500, color: 0xffb703,
    passive: 'Gunners get +2 attack.',
    effects: { classAtk: { cls: 'gunner', atk: 2 } },
    look: 'cocky bounty hunter with a long duster coat, cybernetic eye and twin plasma revolvers',
  },
  {
    id: 'kael', name: 'Kael', title: 'Blade Duelist', unlockLevel: 12, price: 500, color: 0xe63946,
    passive: 'Strikers get +2 attack.',
    effects: { classAtk: { cls: 'striker', atk: 2 } },
    look: 'agile masked duelist with a red scarf and an energy katana',
  },
  {
    id: 'prime', name: 'Overseer Prime', title: 'Ancient AI', unlockLevel: 14, price: 600, color: 0x06d6a0,
    passive: 'Start the run with 20 lives instead of 15.',
    effects: { startLives: 20 },
    look: 'ancient artificial intelligence shown as a floating chrome head with a glowing green core and cables',
  },
];

export const COMMANDERS: Record<string, CommanderDef> = Object.fromEntries(list.map((c) => [c.id, c]));
export const COMMANDER_LIST = list;
export const DEFAULT_COMMANDER = 'nova';

export function getCommander(id: string | undefined): CommanderDef {
  return (id && COMMANDERS[id]) || COMMANDERS[DEFAULT_COMMANDER];
}
