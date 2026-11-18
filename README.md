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

- **Shop:** you get 10 gold every turn. Creatures cost 3, a reroll costs 1, and selling one refunds its level in gold. You can freeze a shop slot to keep it after a reroll and into the next round.
- **Merging:** drop a duplicate creature onto its twin. Each merge gives +1/+1. Merging 3 copies reaches level 2, and 6 copies reaches level 3. A creature's ability numbers multiply by its level.
- **Battle:** the two front creatures hit each other at the same time. Abilities fire on triggers: start of battle, before attack, hurt and faint.
- **Types:** Plasma beats Mech, Mech beats Cryo, Cryo beats Bio, Bio beats Void, and Void beats Plasma. A super effective hit does x1.5 damage; a resisted hit does x0.75.
- **Unlocks:** a higher creature tier unlocks every 2 rounds, and the shop grows to 4 slots from round 5.

## Project layout

| Path | What it holds |
|---|---|
| `src/data/` | Creature roster (`creatures.ts`) and the type wheel (`elements.ts`). Balance changes go here. |
| `src/sim/` | Deterministic battle simulator. Same teams and seed always give the same battle. It has no rendering code, so it can also run on a server for PvP later. |
| `src/game/` | Run state (shop, gold, lives, merging) and AI opponents. |
| `src/scenes/` | Phaser screens: Title, Shop, Battle and GameOver. |
| `src/ui/` | Shared widgets and the `CreatureView` sprite with its stat badges. |
| `src/art/` | Art loader. |
| `src/assets/creatures/` | Creature art. |

## Art

Put `<creature-id>.png` (or `.webp`) in `src/assets/creatures/`. It is picked up automatically, with no code changes. Images should be square (256×256 or larger), on a transparent background, with the creature facing **right**. Any creature without a file falls back to a procedurally drawn placeholder.

## Deploy

`.github/workflows/deploy.yml` builds the game and publishes it to GitHub Pages on every push to `main`. Turn this on once under **Settings → Pages → Source: GitHub Actions**.
