using System.Globalization;
using System.Text.Json.Nodes;
using Mutagen.Bethesda.Skyrim;

namespace Extractor;

/// <summary>
/// Leveling rules: game settings from plugins plus the final INI / MCM values of
/// Experience and Static Skill Leveling, and the quests that award perk points.
/// </summary>
public static class LevelingExtractor
{
    private static readonly string[] GameSettings = ["fXPLevelUpBase", "fXPLevelUpMult", "iAVDSkillStart", "iAVDhmsLevelUp"];

    public static JsonObject Extract(GameData game, Mo2Profile profile, Describe d)
    {
        var gmst = new JsonObject();
        foreach (var (g, from) in game.Winning<IGameSettingGetter>().Values)
        {
            if (g.EditorID == null || !GameSettings.Contains(g.EditorID)) continue;
            gmst[g.EditorID] = new JsonObject
            {
                ["value"] = g switch
                {
                    IGameSettingFloatGetter f => f.Data,
                    IGameSettingIntGetter i => i.Data,
                    _ => null,
                },
                ["plugin"] = from.FileName.String,
            };
        }

        return new JsonObject
        {
            ["gameSettings"] = gmst,
            ["experience"] = Ini(profile, @"SKSE\Plugins\Experience.ini"),
            // Perks / attribute points per level-up and skill caps.
            ["uncapper"] = Ini(profile, @"SKSE\Plugins\SkyrimUncapper.ini"),
            // MCM Helper: defaults from MCM\Config, overridden by the saved MCM\Settings file.
            ["staticSkillLeveling"] = Merge(
                Ini(profile, @"MCM\Config\StaticSkillLeveling\settings.ini"),
                Ini(profile, @"MCM\Settings\StaticSkillLeveling.ini")),
            ["questPerks"] = QuestPerks(game, d),
            ["otherPerkPoints"] = ScriptedPerkPoints(game),
            // Vampire Lord / Werewolf trees fill from kills and feeding, separately from character perks.
            ["transformationPerks"] = new JsonObject
            {
                ["vampireLordMaxPerks"] = d.Global("DLC1VampireMaxPerks"),
                ["werewolfMaxPerks"] = d.Global("DLC1WerewolfMaxPerksFeeding"),
            },
            // Quest groups Quests Award Perk Points can switch off (1 = awards enabled).
            ["questPerkToggles"] = new JsonObject
            {
                ["Daedric"] = d.Global("ANDR_QAPP_GLOB_Daedric_Toggle"),
                ["DBDestroy"] = d.Global("ANDR_QAPP_GLOB_DBDestroy_Toggle"),
            },
            ["trainers"] = Trainers(game),
        };
    }

    // Highest level a trainer can raise each skill to. The rank lives on the trainer's class
    // (Journeyman 50, Expert 75, Master 90), so individual trainers don't matter.
    private static JsonObject Trainers(GameData game)
    {
        var max = new JsonObject();
        var classes = game.Winning<IClassGetter>().Values
            .Where(c => c.Record.MaxTrainingLevel > 0 && c.Record.EditorID?.Contains("Trainer", StringComparison.OrdinalIgnoreCase) == true);
        foreach (var (c, _) in classes)
        {
            // Mutagen's Skill enum is offset; the raw value indexes the skills in actor value order.
            var i = (int)c.Teaches;
            if (i < 0 || i >= Skills.Ids.Length) continue;
            var id = Skills.Ids[i];
            max[id] = Math.Max(max[id]?.GetValue<int>() ?? 0, c.MaxTrainingLevel);
        }
        return max;
    }

    // Quests Award Perk Points (+ its addon plugins): spells whose effects each fire once a quest stage is done.
    private static JsonArray QuestPerks(GameData game, Describe d)
    {
        var quests = game.Winning<IQuestGetter>();
        var arr = new JsonArray();
        var effects = game.Winning<IMagicEffectGetter>();
        var spells = d.Spells.Values.Where(s => s.Record.EditorID?.StartsWith("ANDR_QAPP_SPEL", StringComparison.Ordinal) == true);
        foreach (var (spell, from) in spells)
        foreach (var e in spell.Effects)
        {
            var mgef = effects.TryGetValue(e.BaseEffect.FormKey, out var m) ? m.Record : null;
            var questRefs = new JsonArray();
            foreach (var c in e.Conditions.Concat(mgef?.Conditions ?? []))
            {
                var link = c.Data.GetType().GetProperty("Quest")?.GetValue(c.Data);
                var key = (link?.GetType().GetProperty("Link")?.GetValue(link) as Mutagen.Bethesda.Plugins.IFormLinkGetter)?.FormKey;
                if (key is { } k && quests.TryGetValue(k, out var q))
                    questRefs.Add(new JsonObject
                    {
                        ["formKey"] = Json.Key(k),
                        ["editorId"] = q.Record.EditorID,
                        ["name"] = q.Record.Name?.String,
                    });
            }
            var id = mgef?.EditorID?.Replace("ANDR_QAPP_MGEF_", "");
            var name = questRefs.FirstOrDefault()?["name"]?.ToString();
            arr.Add(new JsonObject
            {
                ["id"] = id,
                // Civil war quest names are text aliases filled at runtime; use GAMEPLAY.md's names.
                ["name"] = id switch
                {
                    "CWObj" => "Liberation of Skyrim / Reunification of Skyrim",
                    "CWSiegeObj" => "Battle for Whiterun (Imperial or Stormcloak)",
                    _ => name,
                },
                ["plugin"] = from.FileName.String,
                ["quests"] = questRefs,
                ["conditions"] = Json.Conditions(e.Conditions.Concat(mgef?.Conditions ?? [])),
            });
        }
        return arr;
    }

    // Scripts that call Game.AddPerkPoints outside Quests Award Perk Points, found by scanning every
    // .pex in the modlist's archives; amounts read from their bytecode.
    private static readonly (string Script, string PluginPattern, int Points, string Note)[] PerkPointScripts =
    [
        ("OghmaInfiniumScript", "^Artificer", 2, "Reading the Oghma Infinium (Artificer), whichever path is chosen."),
        ("DcdAlchAddPerkPointsScript", "^DAc0da", 1, "DAc0da reward."),
        ("CRBSQ01_TIF__0302299C", "^Unslaad", 1, "Dialogue reward in Unslaad."),
        ("aoMapConvertObjScript", "^Vigilant", 1, "One of the conversion choices (Vigilant)."),
        ("chAlchStatusUpEffectScript", "^Vigilant", 1, "Only the perk point variant of the status-up items (Vigilant)."),
    ];

    private static int? TypeProperty(IAVirtualMachineAdapterGetter vmad, string script) =>
        vmad.Scripts.FirstOrDefault(s => string.Equals(s.Name, script, StringComparison.OrdinalIgnoreCase))?
            .Properties.OfType<IScriptIntPropertyGetter>().FirstOrDefault(p => p.Name == "Type")?.Data;

    private static bool HasScript(IAVirtualMachineAdapterGetter? vmad, string script) =>
        vmad?.Scripts.Any(s => string.Equals(s.Name, script, StringComparison.OrdinalIgnoreCase)) == true
        || (vmad is IDialogResponsesAdapterGetter dr && string.Equals(dr.ScriptFragments?.FileName, script, StringComparison.OrdinalIgnoreCase))
        || (vmad is IQuestAdapterGetter qa && string.Equals(qa.FileName, script, StringComparison.OrdinalIgnoreCase));

    // Records of the owning plugins that carry the script (any record type), plus anything using a
    // scripted magic effect (potions, scrolls, spells...) and the quest owning a scripted dialogue line.
    private static JsonArray ScriptedPerkPoints(GameData game)
    {
        var arr = new JsonArray();
        foreach (var (script, pattern, points, note) in PerkPointScripts)
        {
            var re = new System.Text.RegularExpressions.Regex(pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            var mods = game.Mods.Where(m => re.IsMatch(m.ModKey.FileName)).ToList();
            var sources = new JsonArray();
            var seen = new HashSet<string>();
            void Add(string type, Mutagen.Bethesda.Plugins.Records.IMajorRecordGetter r, string plugin, string? extra = null)
            {
                if (!seen.Add(type + r.FormKey)) return;
                sources.Add(new JsonObject
                {
                    ["type"] = type,
                    ["formKey"] = Json.Key(r.FormKey),
                    ["editorId"] = r.EditorID,
                    ["name"] = (r as Mutagen.Bethesda.Plugins.Aspects.INamedGetter)?.Name ?? extra,
                    ["plugin"] = plugin,
                });
            }

            var scriptedEffects = new HashSet<Mutagen.Bethesda.Plugins.FormKey>();
            foreach (var mod in mods)
            {
                foreach (var rec in mod.EnumerateMajorRecords())
                {
                    var vmad = rec.GetType().GetProperty("VirtualMachineAdapter")?.GetValue(rec) as IAVirtualMachineAdapterGetter;
                    if (!HasScript(vmad, script)) continue;
                    // Vigilant's status-up script handles several item kinds; Type 3 is the perk point one.
                    if (rec is IMagicEffectGetter && TypeProperty(vmad!, script) is null or 3) scriptedEffects.Add(rec.FormKey);
                    else if (rec is IMagicEffectGetter) continue;
                    else if (rec is not IDialogResponsesGetter) Add(rec.Registration.Name.ToLowerInvariant(), rec, mod.ModKey.FileName);
                }
                foreach (var topic in mod.DialogTopics)
                    foreach (var r in topic.Responses)
                        if (HasScript(r.VirtualMachineAdapter, script))
                            Add("dialogue", topic, mod.ModKey.FileName,
                                $"{Json.Names.GetValueOrDefault(topic.Quest.FormKey)}: \"{topic.Name?.String}\"");
            }
            if (scriptedEffects.Count > 0)
                foreach (var mod in mods)
                    foreach (var rec in mod.EnumerateMajorRecords())
                    {
                        var effects = rec.GetType().GetProperty("Effects")?.GetValue(rec) as IEnumerable<IEffectGetter>;
                        if (effects?.Any(e => scriptedEffects.Contains(e.BaseEffect.FormKey)) == true)
                            Add(rec.Registration.Name.ToLowerInvariant(), rec, mod.ModKey.FileName);
                    }

            arr.Add(new JsonObject { ["script"] = script, ["points"] = points, ["note"] = note, ["sources"] = sources });
        }
        return arr;
    }

    private static JsonObject Ini(Mo2Profile profile, string relativePath)
    {
        var result = new JsonObject();
        var path = profile.ResolveFile(relativePath);
        if (path == null) return result;
        result["_source"] = Path.GetRelativePath(profile.InstanceDir, path);
        string section = "";
        foreach (var raw in File.ReadLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line[0] is ';' or '#') continue;
            if (line[0] == '[') { section = line.Trim('[', ']'); continue; }
            var eq = line.IndexOf('=');
            if (eq < 0) continue;
            var key = line[..eq].Trim();
            var value = line[(eq + 1)..].Trim();
            var sec = result[section] as JsonObject ?? (JsonObject)(result[section] = new JsonObject());
            sec[key] = ParseValue(value);
        }
        return result;
    }

    private static JsonNode? ParseValue(string v)
    {
        if (bool.TryParse(v, out var b)) return b;
        if (double.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out var n)) return n;
        return v;
    }

    private static JsonObject Merge(JsonObject defaults, JsonObject overrides)
    {
        var result = JsonNode.Parse(defaults.ToJsonString())!.AsObject();
        result["_source"] = new JsonArray(defaults["_source"]?.DeepClone(), overrides["_source"]?.DeepClone());
        foreach (var (section, values) in overrides)
        {
            if (values is not JsonObject vo) continue;
            var target = result[section] as JsonObject ?? (JsonObject)(result[section] = new JsonObject());
            foreach (var (k, v) in vo) target[k] = v?.DeepClone();
        }
        return result;
    }
}
