using System.Text.Json.Nodes;
using Mutagen.Bethesda.Plugins;
using Mutagen.Bethesda.Skyrim;

namespace Extractor;

/// <summary>
/// Perk trees: every actor value with a perk tree (skills plus Vampire Lord / Werewolf),
/// its node layout, and every perk reachable from those nodes (including rank chains).
/// </summary>
public static class PerkExtractor
{
    public static JsonObject Extract(GameData game, Describe d)
    {
        var avifs = game.Winning<IActorValueInformationGetter>();
        var perks = game.Winning<IPerkGetter>();
        var globals = game.Winning<IGlobalGetter>();

        var trees = new JsonArray();
        var wanted = new Queue<FormKey>();

        foreach (var (avif, from) in avifs.Values.Where(a => a.Record.PerkTree.Count > 0))
        {
            var nodes = new JsonArray();
            foreach (var n in avif.PerkTree.OrderBy(n => n.Index))
            {
                nodes.Add(new JsonObject
                {
                    ["index"] = n.Index,
                    ["perk"] = Json.Key(n.Perk),
                    ["gridX"] = n.PerkGridX,
                    ["gridY"] = n.PerkGridY,
                    ["x"] = n.HorizontalPosition,
                    ["y"] = n.VerticalPosition,
                    ["links"] = new JsonArray(n.ConnectionLineToIndices.Select(i => (JsonNode)i).ToArray()),
                });
                if (!n.Perk.IsNull) wanted.Enqueue(n.Perk.FormKey);
            }
            trees.Add(new JsonObject
            {
                ["id"] = avif.EditorID,
                // Canonical skill id; null for the Vampire Lord / Werewolf trees.
                ["skill"] = Skills.Normalize(avif.EditorID),
                ["formKey"] = Json.Key(avif.FormKey),
                ["name"] = avif.Name?.String,
                ["description"] = avif.Description?.String,
                ["plugin"] = from.FileName.String,
                ["nodes"] = nodes,
            });
        }

        // Walk rank chains (NextPerk) and HasPerk prerequisites so the web app can resolve them.
        var perkOut = new JsonObject();
        var usedGlobals = new HashSet<FormKey>();
        var seen = new HashSet<FormKey>();
        while (wanted.TryDequeue(out var key))
        {
            if (!seen.Add(key) || !perks.TryGetValue(key, out var entry)) continue;
            var (perk, from) = entry;

            var conditions = Json.Conditions(perk.Conditions);
            foreach (var c in perk.Conditions)
            {
                if (c.Data is IHasPerkConditionDataGetter hp && !hp.Perk.Link.IsNull) wanted.Enqueue(hp.Perk.Link.FormKey);
                if (c is IConditionGlobalGetter g && !g.ComparisonValue.IsNull) usedGlobals.Add(g.ComparisonValue.FormKey);
            }
            if (!perk.NextPerk.IsNull) wanted.Enqueue(perk.NextPerk.FormKey);

            perkOut[Json.Key(key)] = new JsonObject
            {
                ["editorId"] = perk.EditorID,
                ["name"] = perk.Name?.String,
                ["description"] = d.Text(perk.Description?.String),
                ["plugin"] = from.FileName.String,
                ["playable"] = perk.Playable,
                ["hidden"] = perk.Hidden,
                ["numRanks"] = perk.NumRanks,
                ["nextPerk"] = Json.Key(perk.NextPerk),
                ["conditions"] = conditions,
            };
        }

        var globalOut = new JsonObject();
        foreach (var key in usedGlobals)
        {
            if (!globals.TryGetValue(key, out var g)) continue;
            globalOut[Json.Key(key)] = new JsonObject
            {
                ["editorId"] = g.Record.EditorID,
                ["value"] = g.Record switch
                {
                    IGlobalFloatGetter f => f.Data,
                    IGlobalIntGetter i => i.Data,
                    IGlobalShortGetter s => s.Data,
                    _ => null,
                },
            };
        }

        return new JsonObject { ["trees"] = trees, ["perks"] = perkOut, ["globals"] = globalOut };
    }
}
