export type Element = 'plasma' | 'mech' | 'cryo' | 'bio' | 'void';

export const ELEMENTS: Element[] = ['plasma', 'mech', 'cryo', 'bio', 'void'];

/**
 * Type wheel: each element is strong against the next one in the cycle.
 *   Plasma > Mech > Cryo > Bio > Void > Plasma
 */
const BEATS: Record<Element, Element> = {
  plasma: 'mech',
  mech: 'cryo',
  cryo: 'bio',
  bio: 'void',
  void: 'plasma',
};

export const SUPER_EFFECTIVE = 1.5;
export const NOT_EFFECTIVE = 0.75;

export function typeMultiplier(attacker: Element, defender: Element): number {
  if (BEATS[attacker] === defender) return SUPER_EFFECTIVE;
  if (BEATS[defender] === attacker) return NOT_EFFECTIVE;
  return 1;
}

export const ELEMENT_INFO: Record<Element, { name: string; color: number; accent: number }> = {
  plasma: { name: 'Plasma', color: 0xff6a3d, accent: 0xffd166 },
  mech: { name: 'Mech', color: 0x8d99ae, accent: 0x4cc9f0 },
  cryo: { name: 'Cryo', color: 0x4cc9f0, accent: 0xe0fbfc },
  bio: { name: 'Bio', color: 0x52b788, accent: 0xd8f3dc },
  void: { name: 'Void', color: 0x7b2cbf, accent: 0xe0aaff },
};
