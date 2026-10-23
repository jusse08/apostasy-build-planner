# ApoCharPlanner

Character planner for the [Apostasy](https://github.com/Oghma-Infinium/Apostasy) Skyrim modlist.
Plan race, class, standing stone, deity, skills and perks level by level; the planner applies the
modlist's own leveling rules and flags every level where a build doesn't add up. Builds are saved on
the server (SQLite) and shared with everyone who can reach it.

## Layout

- `tools/extractor` — C# / Mutagen tool that reads the local MO2 install and writes game data to `data/`.
- `data/` — extracted JSON, committed and baked into the Docker image.
- `web/` — SvelteKit app (Svelte 5, adapter-node) with the rules engine, API and SQLite storage.

## Running

Locally (needs Node 24 for `node:sqlite`):

```
cd web
npm install
npm run dev
```

On the home server:

```
docker compose up -d --build
```

The app listens on port 3000; builds are stored in the `planner-db` volume (`/var/lib/planner/builds.sqlite`).
Behind Caddy, `reverse_proxy localhost:3000` is enough: compose sets `PROTOCOL_HEADER` / `HOST_HEADER` so
SvelteKit sees the real `https://` origin (without them its cross-site check rejects deleting builds).
With those set the app expects to be reached through the proxy; for direct `http://host:3000` access remove them.

Tests: `cd web && npm test` (rules engine against the real data).

## Branches and remotes

- `dev` is developed on Forgejo: `ssh://git@forgejo.jusse.dev:222/jusseee/ApoCharPlanner.git` (remote `forgejo`).
- `main` is published on GitHub: `git@github.com:jusse08/apostasy-build-planner.git` (remote `github`).

Both branches contain both workflow files. Forgejo runs `.forgejo/workflows/build.yml`
for pushes and pull requests targeting `dev`. GitHub runs `.github/workflows/build.yml`
for pushes and pull requests targeting `main`, and release tags matching `v*`.

Work on `dev` and push with `git push forgejo dev`. To publish tested changes:

```sh
git switch main
git merge dev
# If documentation changed, resolve any README modify/delete conflicts by removing
# those files from main; keep README files on dev only.
git push github main
git switch dev
```

The stable branch has no tracked README files or `.claude` files; GitHub CI checks
this before publishing. README files remain on `dev` for development.
When pulling changes from `main` back into `dev`, preserve those documentation files.

## Container image publishing

Both workflows run type checks, tests and a Docker build. Pull requests only validate
the image; publishing happens after successful checks on branch pushes or release tags.

Forgejo publishes development images to `forgejo.jusse.dev/jusseee/apocharplanner`
with `:dev` and `:sha-<short-commit>` tags. Configure its Actions secrets:

- `REGISTRY_USERNAME` — registry login.
- `REGISTRY_TOKEN` — token with permission to push packages (`REGISTRY_PASSWORD` is also supported).

Optional Actions variables `REGISTRY` and `IMAGE_NAME` override the registry host and
image path. The runner needs the `docker` label and access to Docker/Buildx.

GitHub publishes stable images to `ghcr.io/jusse08/apostasy-build-planner`.
Pushes to `main` publish `:main`, `:latest` and `:sha-<short-commit>`.
A release tag such as `v1.2.3` publishes `:1.2.3`, `:1.2` and `:sha-<short-commit>`.
GitHub uses its automatic `GITHUB_TOKEN` with `packages: write`; no registry secret
is needed there. Push release tags explicitly to GitHub (`git push github v1.2.3`).

## Updating game data

Run on the machine with Apostasy installed (needs .NET 10 SDK):

```
cd tools/extractor
dotnet run -c Release -- "C:\Games\Apostasy" Apostasy
cd ../..
cd web && npm run fonts && npm run sky
```

Extractor arguments: MO2 instance folder, profile name, optional output folder (defaults to `data/`).
Reading all ~3400 plugins takes about 1.5–2 minutes. Commit `data/` and rebuild the image.
`--dump <plugin regex> <out file>` lists every record of matching plugins when investigating a mod.

`npm run fonts` copies Futura Book BT (Untarnished UI's font) from the install into `web/static/fonts`;
without it the UI falls back to Jost.
`npm run sky` converts the perk menu art of Skyrim SE Skill Interface Re-Texture (stars, lines, nebula) into
`web/static/sky`; the PNGs are committed like the font.

Skill ids everywhere are Papyrus actor value names (`OneHanded`, `Marksman`, `Speechcraft`, ...).
Apostasy repurposes `Lockpicking` as Hand to Hand and `Pickpocket` as Security.

## Rules the planner applies

| Rule | Source | Value |
|---|---|---|
| XP to next level | `fXPLevelUpBase` / `fXPLevelUpMult` (APO_Apostasy - Controller.esp) | 240 + 20 × level |
| Skill cap | Experience.ini `fSkillCapBase` / `fSkillCapMult` | 18 + 2.75 × level, max 100 |
| Skill points per level | Static Skill Leveling MCM settings | 15 + level, at most 60 stored |
| Skill level cost | Static Skill Leveling | 1 / 2 / 4 / 6 per level in 0–25 / 26–50 / 51–75 / 76–100 |
| Perks per level | SkyrimUncapper.ini `[PerksAtLevelUp]` | 1, 2 every fifth level, none after 50 (59 total) |
| Attribute per level | SkyrimUncapper.ini | +20 below level 3, then +10 |
| Starting skills | Nirn's Chosen class script | all 10, major 20, minors 15 (overwrites race boosts) |
| Extra perk points | Quests Award Perk Points (+ addons), Oghma Infinium, Vigilant, Unslaad, DAc0da, Imperial, Prisoner | ticked per build |

Perk requirements come from each perk's conditions (`GetBaseActorValue`, `HasPerk`; an OR flag joins a
condition with the next one). Dragonborn, Vampire Lord and Werewolf perks don't spend character perk points.

### Files in data/

- `perks.json` — `trees[]` (skills, Vampire Lord, Werewolf, Stormcrown's Dragonborn custom skill: node positions
  and links) and `perks{formKey}` (name, description, rank chain `nextPerk`, conditions).
- `races.json` — playable races (Nirn's Chosen): starting attributes, racial abilities.
- `classes.json` — Nirn's Chosen classes. Major/minor skills come from `APO_AddClassScript` properties;
  `warnings` lists where that disagrees with the class description (six classes do).
- `stones.json` — Stones of Sacrifice standing stones with their abilities.
- `religions.json` — Archon deities: blessing, acolyte, champion (requirements in conditions).
- `leveling.json` — XP game settings, Experience / Static Skill Leveling / Skyrim Uncapper final config,
  quest and scripted perk point sources, Vampire Lord / Werewolf perk caps.
- `shouts.json` — Stormcrown shouts, Dragonborn perks, meditations (text from the mod page: the game has none).
- `mods.json` — cached Nexus descriptions of the key mods, for reference.
- `manual.json` — facts not in the plugins (Paragon notes, civil war quest names).
