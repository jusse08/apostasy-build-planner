namespace Extractor;

/// <summary>
/// Resolves the effective load order of an MO2 portable instance: which plugins are enabled,
/// in what order, and which mod folder each plugin file physically comes from.
/// </summary>
public sealed class Mo2Profile
{
    // Implicitly loaded before anything in plugins.txt; MO2 does not list them.
    private static readonly string[] ImplicitMasters =
        ["Skyrim.esm", "Update.esm", "Dawnguard.esm", "HearthFires.esm", "Dragonborn.esm"];

    public required string InstanceDir { get; init; }
    public required string ProfileName { get; init; }

    /// <summary>Enabled plugins in load order, mapped to their absolute file path.</summary>
    public required IReadOnlyList<(string Name, string Path)> Plugins { get; init; }

    /// <summary>Folders that make up the virtual Data folder, highest priority first.</summary>
    public required IReadOnlyList<string> SearchDirs { get; init; }

    /// <summary>Path of the file the game would actually see at a Data-relative path, or null.</summary>
    public string? ResolveFile(string relativePath) =>
        SearchDirs.Select(d => Path.Combine(d, relativePath)).FirstOrDefault(File.Exists);

    public static Mo2Profile Load(string instanceDir, string profileName)
    {
        var profileDir = Path.Combine(instanceDir, "profiles", profileName);
        var stockData = Path.Combine(instanceDir, "Stock Game", "Data");

        // modlist.txt: first line = highest priority. '+' enabled, '-' disabled, '*' unmanaged.
        // Search order for a file: overwrite, then mods from highest to lowest priority, then the game.
        var searchDirs = new List<string> { Path.Combine(instanceDir, "overwrite") };
        foreach (var line in File.ReadLines(Path.Combine(profileDir, "modlist.txt")))
        {
            if (line.Length < 2 || line[0] != '+' || line.EndsWith("_separator")) continue;
            searchDirs.Add(Path.Combine(instanceDir, "mods", line[1..]));
        }
        searchDirs.Add(stockData);

        // Index root-level plugin files of every folder; first hit in search order wins.
        var fileIndex = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var dir in searchDirs)
        {
            if (!Directory.Exists(dir)) continue;
            foreach (var file in Directory.EnumerateFiles(dir))
            {
                var ext = Path.GetExtension(file).ToLowerInvariant();
                if (ext is not (".esm" or ".esp" or ".esl")) continue;
                fileIndex.TryAdd(Path.GetFileName(file), file);
            }
        }

        var names = new List<string>(ImplicitMasters);
        foreach (var raw in File.ReadLines(Path.Combine(profileDir, "plugins.txt")))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line[0] == '#' || line[0] != '*') continue; // only enabled
            var name = line[1..];
            if (!names.Contains(name, StringComparer.OrdinalIgnoreCase)) names.Add(name);
        }

        var plugins = new List<(string, string)>();
        foreach (var name in names)
        {
            if (fileIndex.TryGetValue(name, out var path)) plugins.Add((name, path));
            else Console.Error.WriteLine($"warn: plugin not found on disk: {name}");
        }

        return new Mo2Profile
        {
            InstanceDir = instanceDir, ProfileName = profileName, Plugins = plugins, SearchDirs = searchDirs,
        };
    }
}
