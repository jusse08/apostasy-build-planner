using System.Text;
using System.Text.RegularExpressions;
using Mutagen.Bethesda.Plugins.Aspects;
using Mutagen.Bethesda.Plugins.Records;

namespace Extractor;

/// <summary>
/// Investigation helper: lists every record of matching plugins (type, FormKey, EditorID, name,
/// description) to a text file, to find where a mod keeps its data before writing an extractor.
/// </summary>
public static class Dump
{
    public static void Run(GameData game, string pluginPattern, string outFile)
    {
        var re = new Regex(pluginPattern, RegexOptions.IgnoreCase);
        var sb = new StringBuilder();
        foreach (var mod in game.Mods.Where(m => re.IsMatch(m.ModKey.FileName)))
        {
            sb.AppendLine($"##### {mod.ModKey.FileName}");
            foreach (var rec in mod.EnumerateMajorRecords())
            {
                var name = (rec as INamedGetter)?.Name;
                var desc = rec.GetType().GetProperty("Description")?.GetValue(rec)?.ToString();
                sb.Append($"{rec.Registration.Name,-28} {rec.FormKey,-36} {rec.EditorID}");
                if (!string.IsNullOrEmpty(name)) sb.Append($" | {name}");
                if (!string.IsNullOrEmpty(desc)) sb.Append($" | {desc.ReplaceLineEndings(" ")}");
                sb.AppendLine();
            }
        }
        File.WriteAllText(outFile, sb.ToString());
        Console.WriteLine($"dumped to {outFile}");
    }
}
