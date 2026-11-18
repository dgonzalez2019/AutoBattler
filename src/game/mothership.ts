/** Mothership: your home base. Upgrades bought in the shop last for the whole run. */
export type ModuleId = 'barracks' | 'armory' | 'shields' | 'reactor';

export interface ModuleDef {
  id: ModuleId;
  name: string;
  /** Description per level, {n} is the total bonus at that level. */
  text: string;
  maxLevel: number;
  /** Gold cost to reach level i+1. */
  costs: number[];
  color: number;
}

export const MODULES: ModuleDef[] = [
  { id: 'barracks', name: 'Barracks', text: '+{n}% squad size', maxLevel: 3, costs: [4, 6, 8], color: 0x06d6a0 },
  { id: 'armory', name: 'Armory', text: '+{n} attack for all units', maxLevel: 3, costs: [5, 7, 9], color: 0xff8c42 },
  { id: 'shields', name: 'Shield Bay', text: '+{n} health for all units', maxLevel: 3, costs: [4, 6, 8], color: 0x4cc9f0 },
  { id: 'reactor', name: 'Reactor', text: '+{n} gold every turn', maxLevel: 2, costs: [5, 8], color: 0xffd166 },
];

export type ModuleLevels = Record<ModuleId, number>;

export const emptyModules = (): ModuleLevels => ({ barracks: 0, armory: 0, shields: 0, reactor: 0 });

export function moduleBonus(id: ModuleId, level: number): number {
  switch (id) {
    case 'barracks':
      return level * 25;
    case 'armory':
      return level;
    case 'shields':
      return level * 2;
    case 'reactor':
      return level;
  }
}

export function moduleText(def: ModuleDef, level: number): string {
  return def.text.replace('{n}', String(moduleBonus(def.id, level)));
}
