using System.Diagnostics;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Extractor;

// Usage: dotnet run -c Release -- [MO2 instance dir] [profile] [output dir]
//        dotnet run -c Release -- --dump <plugin regex> <out file>
if (args is ["--dump", var pattern, var dumpFile])
{
    using var dumpGame = GameData.Open(Mo2Profile.Load(@"C:\Games\Apostasy", "Apostasy"));
    Dump.Run(dumpGame, pattern, dumpFile);
    return;
}

var instance = args.Length > 0 ? args[0] : @"C:\Games\Apostasy";
var profileName = args.Length > 1 ? args[1] : "Apostasy";
var outDir = args.Length > 2 ? args[2] : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../data"));

var sw = Stopwatch.StartNew();
var profile = Mo2Profile.Load(instance, profileName);
Console.WriteLine($"plugins in load order: {profile.Plugins.Count}");

using var game = GameData.Open(profile);
Console.WriteLine($"opened {game.Mods.Count} plugins in {sw.Elapsed.TotalSeconds:F0}s");

var d = new Describe(game);
var meta = new JsonObject
{
    ["profile"] = profileName,
    ["plugins"] = profile.Plugins.Count,
    ["generatedAt"] = DateTime.UtcNow.ToString("O"),
};

Directory.CreateDirectory(outDir);
var options = new JsonSerializerOptions { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

void Write(string name, JsonNode content)
{
    var root = content as JsonObject ?? new JsonObject { ["items"] = content };
    root["meta"] = meta.DeepClone();
    File.WriteAllText(Path.Combine(outDir, name), root.ToJsonString(options));
    Console.WriteLine($"wrote {name} ({sw.Elapsed.TotalSeconds:F0}s)");
}

Write("perks.json", PerkExtractor.Extract(game, d));
Write("races.json", CharacterExtractor.Races(game, d));
Write("classes.json", CharacterExtractor.Classes(game, d));
Write("stones.json", CharacterExtractor.Stones(game, d));
Write("religions.json", CharacterExtractor.Religions(game, d));
Write("leveling.json", LevelingExtractor.Extract(game, profile, d));
