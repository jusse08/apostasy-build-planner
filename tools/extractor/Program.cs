using System.Diagnostics;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Extractor;

// Usage: dotnet run -c Release -- [MO2 instance dir] [profile] [output dir]
var instance = args.Length > 0 ? args[0] : @"C:\Games\Apostasy";
var profileName = args.Length > 1 ? args[1] : "Apostasy";
var outDir = args.Length > 2 ? args[2] : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../data"));

var sw = Stopwatch.StartNew();
var profile = Mo2Profile.Load(instance, profileName);
Console.WriteLine($"plugins in load order: {profile.Plugins.Count}");

using var game = GameData.Open(profile);
Console.WriteLine($"opened {game.Mods.Count} plugins in {sw.Elapsed.TotalSeconds:F0}s");

var perks = PerkExtractor.Extract(game);
perks["meta"] = new JsonObject
{
    ["profile"] = profileName,
    ["plugins"] = profile.Plugins.Count,
    ["generatedAt"] = DateTime.UtcNow.ToString("O"),
};

Directory.CreateDirectory(outDir);
var options = new JsonSerializerOptions { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
var outFile = Path.Combine(outDir, "perks.json");
File.WriteAllText(outFile, perks.ToJsonString(options));
Console.WriteLine($"wrote {outFile}: {perks["trees"]!.AsArray().Count} trees, {perks["perks"]!.AsObject().Count} perks ({sw.Elapsed.TotalSeconds:F0}s)");
