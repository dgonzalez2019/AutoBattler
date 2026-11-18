import type { CreatureDef } from './creatures';

/**
 * Evolutions: merging a creature to level 2 and level 3 evolves it into a new
 * named form with its own art (src/assets/creatures/<id>@2.webp, <id>@3.webp).
 * Legendaries don't evolve; they Ascend (same name, golden aura).
 */
export const EVOLUTIONS: Record<string, [string, string]> = {
  // Plasma
  sparkit: ['Voltvix', 'Plasmafox'],
  emberpup: ['Blazehound', 'Pyrewolf'],
  cinderling: ['Coalbloat', 'Magmacore'],
  flarefly: ['Flarewing', 'Solarmoth'],
  sparkplug: ['Ampling', 'Megavolt'],
  ionix: ['Ionode', 'Ionarch'],
  pyrolisk: ['Pyrodrake', 'Pyrokhan'],
  blazeback: ['Blazetusk', 'Volcaboar'],
  novaraptor: ['Novaclaw', 'Novarex'],
  magmaw: ['Magmaul', 'Magmagnus'],
  solarion: ['Solarch', 'Helion'],
  quasarion: ['Quasarus', 'Quasarex'],
  infernox: ['Infernaur', 'Hellhorn'],
  // Mech
  boltbug: ['Voltbeetle', 'Dynabeetle'],
  sentrybot: ['Sentrion', 'Bastionix'],
  rivetrat: ['Riveteer', 'Sawfang'],
  scrapper: ['Scrapjack', 'Junkgolem'],
  ticktock: ['Chronowl', 'Chronarch'],
  gearhound: ['Cogwolf', 'Gearbeast'],
  railhawk: ['Railfalcon', 'Railgryph'],
  hammerhead: ['Hammerjaw', 'Megahammer'],
  titanode: ['Titanex', 'Colossode'],
  repairon: ['Mendron', 'Restorix'],
  dynamo: ['Turbodyne', 'Gigadyne'],
  mechadon: ['Mechasaur', 'Megadon'],
  warforge: ['Forgeheart', 'Forgelord'],
  // Cryo
  frostling: ['Frostbill', 'Emperice'],
  snowmite: ['Snowbeetle', 'Avalanchite'],
  shardcub: ['Shardbear', 'Crystalgrizz'],
  flurrikit: ['Flurrifox', 'Blizzarvix'],
  icewisp: ['Rimewisp', 'Aurorawisp'],
  cryomaw: ['Cryojaw', 'Cryotyrant'],
  blizzowl: ['Hailhoot', 'Tempestowl'],
  tundrox: ['Tundrabull', 'Permafrox'],
  glacieron: ['Rimestag', 'Glaciking'],
  frostfang: ['Frostlupus', 'Fimbulfang'],
  snowmother: ['Snowmatron', 'Blizzamatron'],
  glaciarch: ['Glaciarchon', 'Icetitan'],
  glacilord: ['Hailwarden', 'Frostsovereign'],
  // Bio
  bryobit: ['Bryosprout', 'Bryogrove'],
  pollenpuff: ['Pollenpouf', 'Dandelaire'],
  vinesnap: ['Snaptrap', 'Vinetyrant'],
  budling: ['Bloomkin', 'Floraqueen'],
  mossgrub: ['Mosscoon', 'Mossmoth'],
  thornback: ['Thornshell', 'Thornfortress'],
  sapsprite: ['Sapfaerie', 'Amberqueen'],
  fungalord: ['Mycelord', 'Sporemonarch'],
  verdantaur: ['Verdaurus', 'Verdantitan'],
  mantidra: ['Scythantis', 'Mantikaiser'],
  briarbeast: ['Briarbear', 'Briarbehemoth'],
  worldroot: ['Elderoot', 'Worldancient'],
  hydrabloom: ['Hydrafloria', 'Hydragarden'],
  // Void
  nullmite: ['Nullarach', 'Nullweaver'],
  gloomwisp: ['Gloomlantern', 'Gloomreaper'],
  shadeling: ['Shadefiend', 'Shadelord'],
  hexling: ['Hexmage', 'Hexarch'],
  leechling: ['Leechmaw', 'Leechleviathan'],
  wraithling: ['Wraithcloak', 'Wraithlord'],
  riftwalker: ['Riftknight', 'Riftsovereign'],
  phantasm: ['Phantomblade', 'Phantasmora'],
  eclipsar: ['Umbrapanther', 'Totalipse'],
  voidmaw: ['Voidgulper', 'Voidglutton'],
  gravemind: ['Gravecortex', 'Graveoverlord'],
  singularity: ['Darkstar', 'Eventhorizon'],
  abyssal: ['Abyssangler', 'Abyssking'],
};

/** Stats gained the moment a creature evolves (on top of the normal merge bonus). */
export const EVOLVE_BONUS: Record<number, { atk: number; hp: number }> = {
  2: { atk: 1, hp: 3 },
  3: { atk: 2, hp: 6 },
};

export function evolves(def: CreatureDef): boolean {
  return !!EVOLUTIONS[def.id];
}

/** Name of a creature at a given level (its evolved form's name, or "Ascended X" for legendaries). */
export function formName(def: CreatureDef, level: number): string {
  const evo = EVOLUTIONS[def.id];
  if (evo && level >= 2) return evo[Math.min(level, 3) - 2];
  if (!evo && def.rarity === 5 && level >= 2) return `${level === 3 ? 'Exalted' : 'Ascended'} ${def.name}`;
  return def.name;
}
