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

### data/perks.json

- `trees[]` — every actor value with a perk tree (skills, Vampire Lord, Werewolf): node grid positions and links.
- `perks{formKey}` — name, description, rank chain (`nextPerk`) and raw conditions
  (`GetBaseActorValue` skill requirements, `HasPerk` prerequisites; `or` binds to the next condition).
