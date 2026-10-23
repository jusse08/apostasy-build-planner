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
            // Quest groups Quests Award Perk Points can switch off (1 = awards enabled).
            ["questPerkToggles"] = new JsonObject
            {
                ["Daedric"] = d.Global("ANDR_QAPP_GLOB_Daedric_Toggle"),
                ["DBDestroy"] = d.Global("ANDR_QAPP_GLOB_DBDestroy_Toggle"),
            },
        };
    }

    // Quests Award Perk Points: one spell whose effects each fire once a quest stage is done.
    private static JsonArray QuestPerks(GameData game, Describe d)
    {
        var quests = game.Winning<IQuestGetter>();
        var arr = new JsonArray();
        var spell = d.SpellByEditorId("ANDR_QAPP_SPEL");
        if (spell == null) return arr;
        var effects = game.Winning<IMagicEffectGetter>();
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
            arr.Add(new JsonObject
            {
                ["id"] = id,
                ["quests"] = questRefs,
                ["conditions"] = Json.Conditions(e.Conditions.Concat(mgef?.Conditions ?? [])),
            });
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
