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
- **Merging:** drop a duplicate squad onto its twin. Each merge gives +1/+1 per unit. Level 2 makes the squad x1.5 bigger, and level 3 makes it x2. A squad's ability numbers multiply by its level.
- **Battle:** both armies charge across a real-time battlefield. Melee units close in, and ranged units fire from range. Abilities trigger per unit at start of battle, on attack, when hurt and on faint.
- **Mothership:** your home base, upgraded with shop gold. Upgrades last the whole run.
  - Barracks: bigger squads.
  - Armory: more attack.
  - Shield Bay: more health.
  - Reactor: more gold each turn.
- **Matchmaking:** this works like Super Auto Pets. At round N you fight an army saved at round N, and every army you send into battle is saved to the pool. You have 5 lives and win the run at 10 wins.
  - The pool currently lives in your own browser and is mixed with AI-built armies (`src/game/matchmaking.ts`).
  - Online PvP means implementing `OpponentSource` against a backend.
- **Types:** Plasma beats Mech, Mech beats Cryo, Cryo beats Bio, Bio beats Void, and Void beats Plasma. A super effective attack does x1.5 damage; a resisted one does x0.75.

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

## Deploy

`.github/workflows/deploy.yml` builds the game and publishes it to GitHub Pages on every push to `main`. Turn this on once under **Settings → Pages → Source: GitHub Actions**.
