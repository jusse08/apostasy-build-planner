using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Mutagen.Bethesda.Skyrim;

namespace Extractor;

/// <summary>
/// Character creation choices: races (Nirn's Chosen), classes (Nirn's Chosen),
/// standing stones (Stones of Sacrifice) and deities (Archon).
/// </summary>
public static class CharacterExtractor
{
    private static readonly string[] RaceIds =
        ["Argonian", "Breton", "DarkElf", "HighElf", "Imperial", "Khajiit", "Nord", "Orc", "Redguard", "WoodElf"];

    // Nirn's Chosen has no CLAS records; each class is a set of records named after it.
    private static readonly string[] ClassIds =
    [
        "Assassin", "Barbarian", "Bard", "Battlemage", "Crusader", "Hero", "Mage", "Monk", "Nightblade",
        "Prisoner", "Rogue", "Soldier", "Sorcerer", "Summoner", "Vagabond", "WitchHunter",
    ];

    private static readonly string[] StoneIds =
        ["Apprentice", "Atronach", "Lady", "Lord", "Lover", "Mage", "Ritual", "Serpent", "Shadow", "Steed", "Thief", "Tower", "Warrior"];

    // Grouping as documented in Apostasy's GAMEPLAY.md.
    private static readonly (string Group, string[] Ids)[] Deities =
    [
        ("Nine Divines", ["Akatosh", "Arkay", "Dibella", "Julianos", "Kynareth", "Mara", "Stendarr", "Talos", "Zenithar"]),
        ("Daedra", ["Azura", "Boethiah", "ClavicusVile", "HermaeusMora", "Hircine", "Jyggalag", "Malacath", "MehrunesDagon",
            "Mephala", "Meridia", "MolagBal", "Namira", "Nocturnal", "Peryite", "Sanguine", "Sheogorath", "Vaermina"]),
        ("Miscellaneous", ["Auriel", "Magnus", "Sithis"]),
    ];

    // Apostasy Framework traits assigned to races (Living, Regenerative, ...).
    private static readonly string[] TraitIds = ["Alert", "Intelligent", "SunlightSensitivity", "Living", "NonLiving", "Regenerative"];

    public static JsonObject Races(GameData game, Describe d)
    {
        var races = game.Winning<IRaceGetter>();
        var arr = new JsonArray();
        foreach (var id in RaceIds)
        {
            var (race, from) = races.Values.First(r => r.Record.EditorID == id + "Race");
            var boosts = new JsonObject();
            foreach (var b in new[] { race.SkillBoost0, race.SkillBoost1, race.SkillBoost2, race.SkillBoost3, race.SkillBoost4, race.SkillBoost5, race.SkillBoost6 })
                if (b.Boost != 0) boosts[Skills.Normalize(b.Skill.ToString()) ?? b.Skill.ToString()] = b.Boost;

            var abilities = new JsonArray();
            foreach (var link in race.ActorEffect ?? [])
                if (d.Spell(link.FormKey) is { } s && s["effects"]!.AsArray().Count > 0) abilities.Add(s);

            arr.Add(new JsonObject
            {
                ["id"] = id,
                ["formKey"] = Json.Key(race.FormKey),
                ["name"] = race.Name?.String,
                ["description"] = d.Text(race.Description?.String),
                ["plugin"] = from.FileName.String,
                ["start"] = new JsonObject(race.Starting.Select(kv => KeyValuePair.Create(kv.Key.ToString(), (JsonNode?)kv.Value))),
                ["regen"] = new JsonObject(race.Regen.Select(kv => KeyValuePair.Create(kv.Key.ToString(), (JsonNode?)kv.Value))),
                ["baseCarryWeight"] = race.BaseCarryWeight,
                ["skillBoosts"] = boosts,
                ["abilities"] = abilities,
            });
        }

        var traits = new JsonArray();
        foreach (var t in TraitIds)
            if (d.Spell($"APO_Trait{t}Ab") is { } s) traits.Add(s);

        return new JsonObject { ["races"] = arr, ["traits"] = traits };
    }

    private static readonly Regex StartGear = new(@"begin the game with (?<gear>.+?)\.\s", RegexOptions.IgnoreCase);

    private static readonly Regex MajorMinor = new(
        @"major skill bonus to (?<major>.+?) and minor skill bonuses to (?<minor>.+?)\.", RegexOptions.IgnoreCase);

    public static JsonObject Classes(GameData game, Describe d)
    {
        // Skill display name ("Hand to Hand", "One-handed") -> canonical id, from the perk trees.
        var byDisplayName = game.Winning<IActorValueInformationGetter>().Values
            .Where(a => Skills.Normalize(a.Record.EditorID) != null && a.Record.Name?.String != null)
            .ToDictionary(a => a.Record.Name!.String!, a => Skills.Normalize(a.Record.EditorID)!, StringComparer.OrdinalIgnoreCase);

        var arr = new JsonArray();
        foreach (var id in ClassIds)
        {
            var selector = d.SpellByEditorId($"APO_ClassSelector{id}");
            var description = d.Text(selector?.Description?.String) ?? "";
            var gear = StartGear.Match(description + " ");
            // APO_AddClassScript sets every skill to the base value, then adds the major/minor
            // bonus to the skills named in its properties (Papyrus actor value names).
            var props = selector != null ? d.ScriptProperties(selector, "APO_AddClassScript") : [];
            var major = Skills.Normalize(props.GetValueOrDefault("MajorSkill") as string);
            var minors = Enumerable.Range(1, 5)
                .Select(i => Skills.Normalize(props.GetValueOrDefault($"MinorSkill{i}") as string))
                .Where(s => s != null).Select(s => (JsonNode)s!).ToArray();

            // The scripts are what the game does; flag where they disagree with the description.
            var warnings = new JsonArray();
            var mm = MajorMinor.Match(description);
            if (mm.Success)
            {
                var descMajor = byDisplayName.GetValueOrDefault(mm.Groups["major"].Value.Trim());
                var descMinors = Regex.Split(mm.Groups["minor"].Value, @",\s*(?:and\s+)?|\s+and\s+")
                    .Select(x => byDisplayName.GetValueOrDefault(x.Trim())).Where(x => x != null).ToHashSet();
                var scriptMinors = minors.Select(m => m!.GetValue<string>()).ToHashSet();
                if (descMajor != major)
                    warnings.Add($"Description says major skill {descMajor}, script gives {major ?? "none"}.");
                foreach (var s in descMinors.Except(scriptMinors))
                    warnings.Add($"Description lists minor skill {s}, script does not raise it.");
                foreach (var s in scriptMinors.Except(descMinors!))
                    warnings.Add($"Script raises {s} as a minor skill, description does not list it.");
            }

            var perks = new JsonArray();
            foreach (var p in d.PerksByEditorIdPrefix($"APO_Class{id}Perk").OrderBy(p => p.EditorID))
                if (d.Perk(p.FormKey) is { } po) perks.Add(po);

            arr.Add(new JsonObject
            {
                ["id"] = id,
                ["name"] = selector?.Name?.String ?? id,
                ["description"] = description,
                ["majorSkill"] = major,
                ["minorSkills"] = new JsonArray(minors),
                // Raw script properties, to compare against what the description claims.
                ["scriptProperties"] = new JsonObject(props
                    .Select(kv => KeyValuePair.Create(kv.Key, kv.Value switch
                    {
                        string s => JsonValue.Create(s),
                        int i => JsonValue.Create(i),
                        float f => JsonValue.Create(f),
                        bool b => (JsonNode?)JsonValue.Create(b),
                        _ => null,
                    }))
                    .Where(kv => kv.Value != null)),
                ["warnings"] = warnings,
                ["startingGear"] = gear.Success ? gear.Groups["gear"].Value : null,
                ["ability"] = d.Spell($"APO_ClassAbility{id}"),
                ["perks"] = perks,
            });
        }

        return new JsonObject
        {
            ["classes"] = arr,
            // At level 1 the class script SETS every skill to base, major to base+major, minors to
            // base+minor — this replaces the race skill boosts. Values are Nirn's Chosen globals.
            ["skillBonus"] = new JsonObject
            {
                ["base"] = d.Global("APO_BaseSkillGlobal"),
                ["major"] = d.Global("APO_MajorSkillGlobal"),
                ["minor"] = d.Global("APO_MinorSkillGlobal"),
            },
        };
    }

    public static JsonArray Stones(GameData game, Describe d)
    {
        var messages = game.Winning<IMessageGetter>().Values.Select(m => m.Record)
            .Where(m => m.EditorID != null).ToDictionary(m => m.EditorID!, StringComparer.OrdinalIgnoreCase);
        var arr = new JsonArray();
        foreach (var id in StoneIds)
        {
            var abilities = new JsonArray();
            foreach (var (s, _) in d.Spells.Values.Where(s => s.Record.EditorID is { } e
                         && e.StartsWith($"APO_doom{id}", StringComparison.OrdinalIgnoreCase) && e.EndsWith("Ability")))
                if (d.Spell(s.FormKey) is { } so) abilities.Add(so);

            arr.Add(new JsonObject
            {
                ["id"] = id,
                ["name"] = $"The {id} Stone",
                ["description"] = messages.TryGetValue($"doom{id}MSG", out var msg)
                    ? d.Text(msg.Description?.String)?.Replace("You may only have one sign blessing at a time.", "").Trim()
                    : null,
                ["abilities"] = abilities,
            });
        }
        return arr;
    }

    public static JsonArray Religions(GameData game, Describe d)
    {
        var arr = new JsonArray();
        foreach (var (group, ids) in Deities)
            foreach (var id in ids)
                arr.Add(new JsonObject
                {
                    ["id"] = id,
                    ["name"] = Regex.Replace(id, "(?<=[a-z])(?=[A-Z])", " "),
                    ["group"] = group,
                    ["blessing"] = d.Spell($"APO_AltarAb{id}"),
                    ["acolyte"] = d.Spell($"APO_Acolyte{id}"),
                    ["champion"] = d.Spell($"APO_Champion{id}"),
                });
        return arr;
    }
}
