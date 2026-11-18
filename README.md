# AutoBattler

A browser autobattler with sci-fi alien creatures. Build a team in the shop, then watch it fight on its own. Win 10 battles before you run out of lives. Plays on desktop and on phones held in landscape.

## Run it

```bash
npm install
npm run dev      # local dev server with hot reload
npm test         # battle and shop logic tests
npm run build    # production build into dist/
```

## How it plays

- **Squads:** each shop purchase is a squad of creatures. Tier 1 squads field 6 units and tier 4 squads field 2. Your army has 5 squad slots, and the front slot deploys closest to the enemy.
- **Shop:** you get 10 gold every turn. A squad costs 3, a reroll costs 1, and selling a squad refunds its level in gold. You can freeze a shop slot to keep it for later.
- **Merging:** drop a duplicate squad onto its twin. Each merge gives +1 attack and +2 health per unit. Level 2 makes the squad x1.5 bigger, and level 3 makes it x2. Ability numbers multiply by level.
- **Battle:** both armies charge across a real-time battlefield. Abilities trigger on start of battle, attack, hurt, faint, kill or a timer ("every 4s"). Some trigger in the shop instead: on buy, sell or end of turn.
- **Mothership:** your home base, upgraded with shop gold for the whole run.
  - Barracks: bigger squads.
  - Armory: more attack.
  - Shield Bay: more health.
  - Reactor: more gold each turn.
- **Matchmaking:** this works like Super Auto Pets. At round N you fight an army saved at round N. You have 5 lives and win the run at 10 wins.
  - The pool currently lives in your own browser and is mixed with AI-built armies (`src/game/matchmaking.ts`).
  - Online PvP means implementing `OpponentSource` against a backend.

### Synergies

Every creature has an **element** and a **class**. Fielding 2 or 3 *different* creatures that share one unlocks its bonus. Two squads of the same creature count once. The full text lives in `src/data/traits.ts`.

| Synergy | (2) | (3) |
|---|---|---|
| Plasma | Attacks apply 1 Burn | 2 Burn; burning enemies take +25% damage |
| Mech | Start with a Shield worth 25% of max health | 50%; breaking it gives +2 attack |
| Cryo | Attacks Chill (40% slower) | 55% slower; Chilled enemies deal 25% less damage |
| Bio | Regenerate 1 health per second | 2 per second; every other ally regenerates 1 |
| Void | 35% Lifesteal | 60%; fallen Void creatures rise as Voidspawn |
| Vanguard | Take 15% less damage | 30%; whole army starts with a 4 Shield |
| Striker | Attack and charge 30% faster | 60% faster attacks, 50% faster charge, 25% Crit |
| Gunner | +1 attack | Shots splash 35% damage onto nearby enemies |
| Mystic | Abilities are 50% stronger | 100% stronger; timers recharge 25% faster |
| Swarm | Swarm squads field +2 units; summons get +1/+3 | +4 units; summons get +2/+6 |

**Status effects:**
- **Burn:** deals its stacks as damage every second and loses a stack every 2 seconds.
- **Chill:** slows movement and attacks.
- **Shield:** absorbs damage before health does.
- **Regenerate:** heals over time.
- **Lifesteal:** heals for a share of the damage dealt.

Elements also form a type wheel: Plasma > Mech > Cryo > Bio > Void > Plasma. A super effective attack does x1.5 damage; a resisted one does x0.75.

## Project layout

| Path | What it holds |
|---|---|
| `src/data/` | Creature roster (`creatures.ts`) and the type wheel (`elements.ts`). Balance changes go here. |
| `src/sim/` | Deterministic real-time battlefield simulator (`field.ts`). It uses a fixed 20 Hz tick and resolves all hits in a tick together. Same armies and seed always give the same battle. It has no rendering code, so it can also run on a server to validate PvP results. |
| `src/game/` | Run state (shop, gold, lives, merging), army snapshots, the Mothership, matchmaking and AI armies. |
| `src/scenes/` | Phaser screens: Title, Shop, Battle and GameOver. |
| `src/ui/` | Shared widgets and the `CreatureView` sprite with its stat badges. |
| `src/art/` | Art loader. |
| `src/assets/creatures/` | Creature art. |

## Art

Put `<creature-id>.png` (or `.webp`) in `src/assets/creatures/`. It is picked up automatically, with no code changes. Images should be square (256×256 or larger), on a transparent background, with the creature facing **right**. Any creature without a file falls back to a procedurally drawn placeholder.

To generate the art with the OpenAI Images API, run:

```bash
OPENAI_API_KEY=sk-... npm run art               # every creature that has no art yet
OPENAI_API_KEY=sk-... npm run art -- sparkit    # one creature
OPENAI_API_KEY=sk-... npm run art -- --force    # regenerate everything
```

The prompts are built from each creature's `look`, element and tier in `src/data/creatures.ts`. A shared style line keeps the whole roster consistent. Full-size originals are saved to `art-source/`, which git ignores.

## Deploy

`.github/workflows/deploy.yml` builds the game and publishes it to GitHub Pages on every push to `main`. Turn this on once under **Settings → Pages → Source: GitHub Actions**.
