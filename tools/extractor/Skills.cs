namespace Extractor;

/// <summary>
/// One id per skill across all data files. Uses the Papyrus actor value names (what scripts pass
/// to SetActorValue); plugins, Mutagen enums and AVIF editor ids each spell some skills differently.
/// Note Apostasy repurposes Lockpicking as Hand to Hand and Pickpocket as Security.
/// </summary>
public static class Skills
{
    public static readonly string[] Ids =
    [
        "OneHanded", "TwoHanded", "Marksman", "Block", "Smithing", "HeavyArmor", "LightArmor", "Pickpocket",
        "Lockpicking", "Sneak", "Alchemy", "Speechcraft", "Alteration", "Conjuration", "Destruction", "Illusion",
        "Restoration", "Enchanting",
    ];

    private static readonly Dictionary<string, string> Aliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Archery"] = "Marksman",
        ["Speech"] = "Speechcraft",
        ["Mysticism"] = "Illusion", // AVIF editor id of Illusion is AVMysticism
    };

    /// <summary>Canonical id for a Mutagen enum name / AVIF editor id / script string, or null if not a skill.</summary>
    public static string? Normalize(string? name)
    {
        if (string.IsNullOrEmpty(name)) return null;
        if (name.StartsWith("AV", StringComparison.Ordinal) && name.Length > 2 && char.IsUpper(name[2])) name = name[2..];
        if (Aliases.TryGetValue(name, out var alias)) return alias;
        return Ids.FirstOrDefault(i => string.Equals(i, name, StringComparison.OrdinalIgnoreCase));
    }
}
