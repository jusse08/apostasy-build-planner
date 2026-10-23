using Mutagen.Bethesda;
using Mutagen.Bethesda.Plugins;
using Mutagen.Bethesda.Plugins.Records;
using Mutagen.Bethesda.Skyrim;

namespace Extractor;

/// <summary>
/// All enabled plugins opened as read-only overlays, plus "winning override" lookups
/// (the last plugin in load order that touches a record decides its final state).
/// </summary>
public sealed class GameData : IDisposable
{
    private readonly List<ISkyrimModDisposableGetter> _mods = [];

    public IReadOnlyList<ISkyrimModDisposableGetter> Mods => _mods;

    public static GameData Open(Mo2Profile profile)
    {
        var data = new GameData();
        var loaded = new List<IModMasterStyledGetter>();
        foreach (var (name, path) in profile.Plugins)
        {
            try
            {
                var mod = SkyrimMod.Create(SkyrimRelease.SkyrimSE)
                    .FromPath(new ModPath(ModKey.FromFileName(name), path))
                    .WithLoadOrder(loaded)
                    // Strings files / BSAs for localized plugins sit next to the plugin itself.
                    .WithDataFolder(Path.GetDirectoryName(path)!)
                    .Construct();
                data._mods.Add(mod);
                loaded.Add(mod);
            }
            catch (Exception e)
            {
                Console.Error.WriteLine($"warn: failed to open {name}: {e.Message}");
            }
        }
        return data;
    }

    /// <summary>Winning version of every record of type T, keyed by FormKey, plus the plugin it won from.</summary>
    public Dictionary<FormKey, (T Record, ModKey From)> Winning<T>()
        where T : class, ISkyrimMajorRecordGetter
    {
        var result = new Dictionary<FormKey, (T, ModKey)>();
        foreach (var mod in _mods)
            foreach (var rec in mod.EnumerateMajorRecords<T>())
                result[rec.FormKey] = (rec, mod.ModKey);
        return result;
    }

    public void Dispose()
    {
        foreach (var mod in _mods) mod.Dispose();
    }
}
