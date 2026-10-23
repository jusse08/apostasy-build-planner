using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Extractor;

/// <summary>
/// Nexus mod page descriptions that MO2 caches in each mod's meta.ini (nexusDescription), as plain
/// text. Used as reference and to fill gaps the plugins have no text for.
/// </summary>
public static class ModPages
{
    // Mods whose pages explain systems the planner shows.
    private static readonly string[] Wanted =
    [
        "Paragon - A Modern Perk Overhaul", "Adamant - A Perk Overhaul", "Nirn's Chosen - Enhanced Races and Classes",
        "Stones of Sacrifice - Double Edged Standing Stones", "Archon - Faiths of Tamriel", "Stormcrown - A Shout Overhaul",
        "Sacrilege - Minimalistic Vampires of Skyrim", "Growl - Werebeasts of Skyrim", "Experience",
        "Static Skill Leveling Rewritten", "Quests Award Perk Points", "Ascension", "Apothecary - An Alchemy Overhaul",
        "Thaumaturgy - An Enchanting Overhaul", "Artificer - An Artifact Overhaul", "Mysticism - A Magic Overhaul",
        "Hand to Hand - Trainers and Skill Books Addon",
    ];

    public static string? Description(Mo2Profile profile, string mod)
    {
        var meta = Path.Combine(profile.InstanceDir, "mods", mod, "meta.ini");
        if (!File.Exists(meta)) return null;
        var line = File.ReadLines(meta).FirstOrDefault(l => l.StartsWith("nexusDescription="));
        if (line == null) return null;
        var raw = line["nexusDescription=".Length..];
        if (raw.StartsWith('"')) raw = JsonSerializer.Deserialize<string>(raw) ?? raw;
        return Clean(raw);
    }

    private static string Clean(string s)
    {
        s = Regex.Replace(s, @"<br\s*/?>", "\n", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, @"\[\*\]", "• ");
        s = Regex.Replace(s, @"\[/?[a-z]+(=[^\]]*)?\]", "", RegexOptions.IgnoreCase); // BBCode
        s = s.Replace(" ", " ").Replace("﻿", "");
        s = Regex.Replace(s, @"[ \t]+\n", "\n");
        s = Regex.Replace(s, @"\n{3,}", "\n\n");
        return s.Trim();
    }

    public static JsonArray Extract(Mo2Profile profile)
    {
        var arr = new JsonArray();
        foreach (var mod in Wanted)
        {
            var meta = Path.Combine(profile.InstanceDir, "mods", mod, "meta.ini");
            if (!File.Exists(meta)) continue;
            string? Get(string key) => File.ReadLines(meta).FirstOrDefault(l => l.StartsWith(key + "="))?[(key.Length + 1)..];
            arr.Add(new JsonObject
            {
                ["name"] = mod,
                ["nexusId"] = int.TryParse(Get("modid"), out var id) ? id : null,
                ["url"] = Get("url"),
                ["version"] = Get("version"),
                ["description"] = Description(profile, mod),
            });
        }
        return arr;
    }

    /// <summary>"Name: effect" lines of a section in a mod description (e.g. Stormcrown's Meditations).</summary>
    public static Dictionary<string, string> Section(string? description, string heading, string nextHeading)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (description == null) return result;
        var start = description.IndexOf("\n" + heading + "\n", StringComparison.Ordinal);
        if (start < 0) return result;
        var end = description.IndexOf("\n" + nextHeading, start + 1, StringComparison.Ordinal);
        var body = description[start..(end < 0 ? description.Length : end)];
        foreach (var line in body.Split('\n'))
        {
            var m = Regex.Match(line.Trim(), @"^([A-Z][\w' ’]+?):\s+(.+)$");
            if (m.Success) result[m.Groups[1].Value.Replace('’', '\'')] = m.Groups[2].Value.Trim();
        }
        return result;
    }
}
