using System.Text.Json.Nodes;
using Mutagen.Bethesda.Skyrim;

namespace Extractor;

/// <summary>
/// Shouts (Stormcrown): each shout's words and spells, Stormcrown's Dragonborn perks (bought with
/// dragon souls) and the per-shout meditations offered by Paarthurnax.
/// </summary>
public static class ShoutExtractor
{
    public static JsonObject Extract(GameData game, Describe d, Mo2Profile profile)
    {
        // Meditation effects have no in-game text; Stormcrown's mod page lists them.
        var page = ModPages.Description(profile, "Stormcrown - A Shout Overhaul");
        var pageMeditations = ModPages.Section(page, "Meditations", "Epistolary Acumen");
        var pageAcumen = ModPages.Section(page, "Epistolary Acumen", "Notes");
        var words = game.Winning<IWordOfPowerGetter>();
        // Topic overrides usually carry no responses, so take each topic from every plugin that has lines.
        var topics = game.Mods.SelectMany(m => m.DialogTopics)
            .Where(t => t.EditorID?.StartsWith("MAG_Meditation", StringComparison.Ordinal) == true && t.Responses.Count > 0)
            .GroupBy(t => t.EditorID!).ToDictionary(g => g.Key, g => g.Last());

        var shouts = new JsonArray();
        foreach (var (shout, from) in game.Winning<IShoutGetter>().Values)
        {
            if (shout.EditorID?.StartsWith("MAG_", StringComparison.Ordinal) != true) continue; // Stormcrown's player shouts
            var levels = new JsonArray();
            foreach (var w in shout.WordsOfPower)
            {
                var word = words.TryGetValue(w.Word.FormKey, out var wo) ? wo.Record : null;
                levels.Add(new JsonObject
                {
                    ["word"] = word?.Name?.String,
                    ["translation"] = word?.Translation?.String,
                    ["cooldown"] = w.RecoveryTime,
                    ["spell"] = w.Spell.IsNull ? null : d.Spell(w.Spell.FormKey),
                });
            }

            var id = shout.EditorID!["MAG_".Length..].Replace("Shout", "").Replace("DLC2", "");
            shouts.Add(new JsonObject
            {
                ["id"] = id,
                ["formKey"] = Json.Key(shout.FormKey),
                ["name"] = shout.Name?.String,
                ["description"] = d.Text(shout.Description?.String),
                ["plugin"] = from.FileName.String,
                ["words"] = levels,
                ["meditation"] = Meditation(d, topics, id) is { } med
                    ? AddPageText(med, pageMeditations.GetValueOrDefault(shout.Name?.String ?? ""))
                    : null,
            });
        }

        // Rank chains MAG_X01 -> MAG_X02; only perks with player-facing text.
        var dragonborn = new JsonArray();
        // Other mods share the MAG_ prefix, so only perks that originate in Stormcrown.esp.
        foreach (var p in d.PerksByEditorIdPrefix("MAG_").Where(p => p.FormKey.ModKey.FileName == "Stormcrown.esp"
                     && !p.EditorID!.StartsWith("MAG_Meditation")
                     && !string.IsNullOrWhiteSpace(p.Description?.String)).OrderBy(p => p.EditorID))
        {
            var o = d.Perk(p.FormKey)!;
            o["nextPerk"] = Json.Key(p.NextPerk);
            o["conditions"] = Json.Conditions(p.Conditions);
            dragonborn.Add(o);
        }

        // Black Book: Epistolary Acumen offers one of three Dragon Aspect buffs.
        var acumen = new JsonArray(pageAcumen.Select(kv => (JsonNode)new JsonObject
        {
            ["name"] = kv.Key, ["description"] = kv.Value, ["source"] = "nexus",
        }).ToArray());

        return new JsonObject
        {
            ["shouts"] = shouts,
            ["epistolaryAcumen"] = acumen,
            ["dragonbornPerks"] = dragonborn,
            ["dragonbornSettings"] = new JsonObject
            {
                ["maxPerks"] = d.Global("MAG_DragonbornMaxPerks"),
                ["requiredSouls"] = new JsonArray(
                    d.Global("MAG_DragonbornRequiredSouls01"), d.Global("MAG_DragonbornRequiredSouls02"),
                    d.Global("MAG_DragonbornRequiredSouls03")),
                ["maxMeditations"] = d.Global("MAG_MeditationMaxGlobal"),
            },
        };
    }

    private static JsonObject AddPageText(JsonObject meditation, string? text)
    {
        meditation["description"] = text;
        meditation["descriptionSource"] = text != null ? "nexus" : null;
        return meditation;
    }

    // Meditation perk plus what Paarthurnax says about it (the perk itself has no description).
    private static JsonObject? Meditation(Describe d, Dictionary<string, IDialogTopicGetter> topics, string id)
    {
        var perk = d.PerksByEditorIdPrefix($"MAG_Meditation{id}Perk").FirstOrDefault();
        if (perk == null) return null;
        var topic = topics.GetValueOrDefault($"MAG_Meditation{id}Topic");
        var lines = topic?.Responses.SelectMany(r => r.Responses).Select(r => r.Text?.String).Where(s => !string.IsNullOrWhiteSpace(s)) ?? [];
        // Most meditations work by gating extra effects on the shout spells with HasPerk(meditation).
        var gated = new JsonArray();
        foreach (var (spell, _) in d.Spells.Values)
            foreach (var e in spell.Effects)
                if (e.Conditions.Any(c => c.Data is IHasPerkConditionDataGetter hp && hp.Perk.Link.FormKey == perk.FormKey)
                    && d.Spell(spell.FormKey) is { } so)
                {
                    var effect = so["effects"]!.AsArray().FirstOrDefault(x => x?["name"]?.ToString() == d.EffectName(e.BaseEffect.FormKey));
                    gated.Add(new JsonObject
                    {
                        ["spell"] = spell.Name?.String,
                        ["effect"] = d.EffectName(e.BaseEffect.FormKey),
                        ["description"] = effect?["description"]?.DeepClone(),
                        ["magnitude"] = e.Data?.Magnitude,
                        ["duration"] = e.Data?.Duration,
                    });
                }
        return new JsonObject
        {
            ["perk"] = d.Perk(perk.FormKey),
            ["text"] = lines.Any() ? string.Join(" ", lines) : null,
            ["unlocksEffects"] = gated,
        };
    }
}
