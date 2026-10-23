# ApoCharPlanner

Character planner for the [Apostasy](https://github.com/Oghma-Infinium/Apostasy) Skyrim modlist.

## Layout

- `tools/extractor` — C# / Mutagen tool that reads the local MO2 install and writes game data to `data/`.
- `data/` — extracted JSON, committed and baked into the web image.
- `web/` — SvelteKit app + SQLite for saved builds (coming next).

## Updating game data

Run on the machine with Apostasy installed (needs .NET 10 SDK):

```
cd tools/extractor
dotnet run -c Release -- "C:\Games\Apostasy" Apostasy
```

Arguments: MO2 instance folder, profile name, optional output folder (defaults to `data/`).
Reading all ~3400 plugins takes about 1.5–2 minutes.

Use `--dump <plugin regex> <out file>` to list every record of matching plugins when investigating a mod.

Skill ids everywhere are Papyrus actor value names (`OneHanded`, `Marksman`, `Speechcraft`, ...).
Apostasy repurposes `Lockpicking` as Hand to Hand and `Pickpocket` as Security.

### Files in data/

- `perks.json` — `trees[]` (skills, Vampire Lord, Werewolf: node grid positions and links) and
  `perks{formKey}` (name, description, rank chain `nextPerk`, conditions: `GetBaseActorValue`
  skill requirements, `HasPerk` prerequisites; `or` binds to the next condition).
- `races.json` — playable races (Nirn's Chosen): starting attributes, racial abilities, Apostasy traits.
  Race skill boosts are listed but overwritten at level 1 by the class script.
- `classes.json` — Nirn's Chosen classes. Major/minor skills come from `APO_AddClassScript` properties
  (what the game applies: all skills = base, major = base + major, minors = base + minor);
  `warnings` lists where that disagrees with the class description.
- `stones.json` — Stones of Sacrifice standing stones with their abilities.
- `religions.json` — Archon deities: blessing, acolyte (tiers by quests completed), champion (requirements in conditions).
- `leveling.json` — XP game settings, Experience / Static Skill Leveling / Skyrim Uncapper final config
  (perks per level, attribute gains, skill caps) and quests that award perk points.
