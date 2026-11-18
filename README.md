# AutoBattler

A browser autobattler with sci-fi alien creatures. Build a team in the shop, then watch it fight on its own. Win 10 battles before you run out of lives. Plays on desktop and on phones held in landscape.

## Run it

```bash
npm install
npm run dev      # local dev server with hot reload
npm test         # battle and shop logic tests
npm run playtest # bots play hundreds of full runs vs the AI and report win rates per round
npm run build    # production build into dist/
```

## How it plays

- **Roster:** 75 creatures, 15 per element. 45 are available from the start, and 30 unlock through progression.
- **Rarities:**

  | Rarity | Cost | Units per squad | Per element (base + unlockable) |
  |---|---|---|---|
  | Common | 3g | 6 | 3 + 2 |
  | Uncommon | 4g | 4 | 2 + 1 |
  | Rare | 5g | 3 | 2 + 1 |
  | Epic | 6g | 2 | 1 + 1 |
  | Legendary | 8g | 1 powerhouse | 1 + 1 |

- **Squads:** each shop purchase is a squad. Your army has 5 squad slots, and the front slot deploys closest to the enemy.
- **Economy:** gold carries over between turns.
  - Each turn you earn **base income** (10 on round 1, then 7 rising to 10 by round 8) plus **interest**: +1 for every 5 gold you saved, up to +3.
  - Winning a battle pays +1.
  - Some commanders, permanent upgrades and economy creatures add more.
  - The shop shows what next turn will pay and how much more you need to save for the next interest step.
- **Shop:** a reroll costs 1, and selling refunds `level + rarity - 1` gold. You can freeze a shop slot to keep it for later.
  - The shop has 3 slots at first, 4 from round 3 and 5 from round 7.
  - Odds shift toward rarer creatures each round. Round 1 is all Commons; by round 11 it's 20 / 25 / 30 / 18 / 7%. See `src/data/rarity.ts`.
- **Merging:** drop a duplicate squad onto its twin. Each merge gives +1 attack and +2 health per unit. Level 2 makes the squad x1.5 bigger, and level 3 makes it x2. Ability numbers multiply by level.
- **Battle:** both armies charge across a real-time battlefield. Abilities trigger on start of battle, attack, hurt, faint, kill or a timer ("every 4s"). Some trigger in the shop instead: on buy, sell or end of turn.
- **Winning and Endless Mode:** reaching 10 wins ends the game as a victory, with your rewards banked on the spot. You can then optionally carry on with the same army in Endless Mode.
  - Endless is a bonus mode with a hard cap at round 50, which is not meant to be reached.
  - Losses cost 2 lives, and from round 14 AI enemies gain +8% attack and health per round (`endlessPower` in `src/game/ai.ts`).
  - Endless pays its own extra rewards when it ends.
  - In the playtest, no Endless run got past round 40.
- **Opponents:** AI armies are built through the real shop with the same gold you have, so they're always armies a player could have at that round. Rounds 1 to 3 are easier: the AI plays loosely and some early opponents spend less of their gold. In the playtest, rounds 1 and 2 are won about 75% of the time, round 3 about 55%.
- **Matchmaking:** this works like Super Auto Pets. At round N you fight an army another player saved at round N. You have 5 lives and win the run at 10 wins. See [Online matchmaking](#online-matchmaking).

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
| `src/game/` | Run state (shop, gold, lives, merging), army snapshots, profile and permanent upgrades, matchmaking and AI armies. |
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

## Commanders and meta progression

Progress carries over between runs (`src/game/profile.ts`, stored in the browser for now).

- **Commanders:** you pick one of 14 in **Command HQ** before each run (`src/data/commanders.ts`). Each has one passive that changes how you play. Some examples:
  - Zix: first reroll each turn is free, and selling pays +1 gold.
  - Pyra: every Burn you apply has +1 stack.
  - Orin: +1 shop slot.
  - The Hollow King: fallen creatures may rise as Voidspawn.
  - Overseer Prime: start with 7 lives.
- **Commander Level and XP:** earned from every run, based on wins, rounds survived and championships.
- **Reward track:** each level grants 50 Stardust and unlocks creatures or commanders (Command HQ, Level Rewards tab).
- **Stardust:** buy commanders before their level, or research a locked creature early (80 to 400 depending on rarity).
- **Permanent upgrades** (Command HQ, Upgrades tab, `src/data/upgrades.ts`) are bought with Stardust and apply to every future run:
  - War Chest: +1 to +3 starting gold.
  - Compound Interest: max interest +1 / +2.
  - Quick Reroll: 1 or 2 free rerolls a turn.
  - Salvage: +1 gold per sale.
  - Talent Scout: +1 shop slot.
  - Reinforcements: +1 / +2 lives.
  - Weapons Lab and Bio-Armor: up to +10% attack / health.
  - The attack and health boost travels with your army online (capped by validation).
- **Collection:** all 75 creatures by element and rarity, with lock state and details.
- **Unlocks are sidegrades:** they add options rather than raw power, so online matches stay fair between new and veteran players. Your shop only rolls creatures you've unlocked, but opponents can field anything.
- **Economy creatures:** Sparkplug, Dynamo and Scrapper bank or earn gold. End-of-turn gold carries into the next turn.

## Online matchmaking

Each time you press Battle, your army is uploaded to Supabase with its round. The game then asks for a random recent army from a *different* player at the same round. It falls back to your own past armies and AI armies when nobody is available or the network is down, so the game never blocks.

- **Database:** `supabase/schema.sql` creates one `armies` table and one `find_opponent()` function.
  - With the public (anon) key, a client can only insert an army or call `find_opponent`. Reads, updates and deletes are blocked by row-level security.
  - The function returns no player ids.
- **Validation:** every army from the network goes through `parseArmy()` (`src/game/validate.ts`). Unknown creatures, tokens, bad levels and absurd stats are rejected, and a rejected army is replaced with an AI opponent.
- **Versions:** `GAME_VERSION` in `src/config.ts` separates the pools. Bump it when a balance change would make old armies unfair.
- **Identity:** players are anonymous. Each browser gets a random id, so you never match yourself, and a commander name you can change on the title screen.

### Setup

1. Create a free project at supabase.com.
2. Run `supabase/schema.sql` in **SQL Editor → New query → Run**.
3. Copy the **Project URL** and the **anon / publishable key** from **Project Settings → API**. Never use the `service_role` key.
4. Put them in one of two places:
   - `DEFAULT_URL` / `DEFAULT_ANON_KEY` in `src/config.ts`. The anon key is meant to be public.
   - Repository variables `SUPABASE_URL` / `SUPABASE_ANON_KEY`, which the deploy workflow passes to the build.

The title screen then shows "Online matchmaking". With no config, the game runs offline against AI.

## Deploy

`.github/workflows/deploy.yml` builds the game and publishes it to GitHub Pages on every push to `main`. Turn this on once under **Settings → Pages → Source: GitHub Actions**.
