using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Mutagen.Bethesda.Plugins;
using Mutagen.Bethesda.Skyrim;

namespace Extractor;

/// <summary>
/// Turns spells / perks into player-facing text the way the game shows it: magic effect
/// descriptions with &lt;mag&gt;/&lt;dur&gt; filled in, &lt;Global=X&gt; tokens resolved.
/// </summary>
public sealed class Describe
{
    private readonly Dictionary<FormKey, (ISpellGetter Record, ModKey From)> _spells;
    private readonly Dictionary<FormKey, (IMagicEffectGetter Record, ModKey From)> _effects;
    private readonly Dictionary<FormKey, (IPerkGetter Record, ModKey From)> _perks;
    private readonly Dictionary<string, float> _globalsByEditorId;

    public Describe(GameData game)
    {
        _spells = game.Winning<ISpellGetter>();
        _effects = game.Winning<IMagicEffectGetter>();
        _perks = game.Winning<IPerkGetter>();
        _globalsByEditorId = new(StringComparer.OrdinalIgnoreCase);
        foreach (var (g, _) in game.Winning<IGlobalGetter>().Values)
            if (g.EditorID != null && GlobalValue(g) is { } v) _globalsByEditorId[g.EditorID] = v;

        // Names for condition args: quest / perk / spell / race / faction names, else editor id.
        var names = new Dictionary<FormKey, string>();
        void Add<T>(Dictionary<FormKey, (T Record, ModKey From)> recs) where T : ISkyrimMajorRecordGetter
        {
            foreach (var (k, (r, _)) in recs)
            {
                var n = (r as Mutagen.Bethesda.Plugins.Aspects.INamedGetter)?.Name;
                names[k] = string.IsNullOrEmpty(n) ? r.EditorID ?? "" : n;
            }
        }
        Add(game.Winning<IQuestGetter>());
        Add(_perks);
        Add(_spells);
        Add(game.Winning<IRaceGetter>());
        Add(game.Winning<IFactionGetter>());
        Add(game.Winning<IKeywordGetter>());
        Add(game.Winning<IGlobalGetter>());
        Json.Names = names;
    }

    public IReadOnlyDictionary<FormKey, (ISpellGetter Record, ModKey From)> Spells => _spells;
    public IReadOnlyDictionary<FormKey, (IPerkGetter Record, ModKey From)> Perks => _perks;

    public static float? GlobalValue(IGlobalGetter g) => g switch
    {
        IGlobalFloatGetter f => f.Data,
        IGlobalIntGetter i => i.Data,
        IGlobalShortGetter s => s.Data,
        _ => null,
    };

    public float? Global(string editorId) => _globalsByEditorId.TryGetValue(editorId, out var v) ? v : null;

    public ISpellGetter? SpellByEditorId(string editorId) =>
        _spells.Values.Select(s => s.Record).FirstOrDefault(s => string.Equals(s.EditorID, editorId, StringComparison.OrdinalIgnoreCase));

    public IEnumerable<IPerkGetter> PerksByEditorIdPrefix(string prefix) =>
        _perks.Values.Select(p => p.Record).Where(p => p.EditorID?.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) == true);

    private static readonly Regex GlobalToken = new(@"<Global=([^>]+)>", RegexOptions.IgnoreCase);
    // Mod authors write literal numbers as <50> so the game highlights them like <mag>.
    private static readonly Regex HighlightedNumber = new(@"<(\d+(?:\.\d+)?)>");

    public string? Text(string? raw, float? mag = null, int? dur = null, int? area = null)
    {
        if (string.IsNullOrEmpty(raw)) return null;
        var s = GlobalToken.Replace(raw, m => Global(m.Groups[1].Value) is { } v ? Num(v) : m.Value);
        if (mag != null) s = s.Replace("<mag>", Num(mag.Value), StringComparison.OrdinalIgnoreCase);
        if (dur != null) s = s.Replace("<dur>", dur.Value.ToString(CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase);
        if (area != null) s = s.Replace("<area>", area.Value.ToString(CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase);
        return HighlightedNumber.Replace(s, "$1").Trim();
    }

    private static string Num(float v) => Math.Round(v, 2).ToString(CultureInfo.InvariantCulture);

    /// <summary>Spell with its visible effects; perks applied by effects are described too.</summary>
    public JsonObject? Spell(FormKey key)
    {
        if (!_spells.TryGetValue(key, out var entry)) return null;
        var (spell, from) = entry;
        var effects = new JsonArray();
        foreach (var e in spell.Effects)
        {
            if (!_effects.TryGetValue(e.BaseEffect.FormKey, out var mgefEntry)) continue;
            var mgef = mgefEntry.Record;
            if (mgef.Flags.HasFlag(MagicEffect.Flag.HideInUI)) continue;
            var text = Text(mgef.Description?.String, e.Data?.Magnitude, e.Data?.Duration, e.Data?.Area);
            var o = new JsonObject
            {
                ["name"] = mgef.Name?.String,
                ["description"] = text,
                ["magnitude"] = e.Data?.Magnitude,
                ["duration"] = e.Data?.Duration,
            };
            if (!mgef.PerkToApply.IsNull && Perk(mgef.PerkToApply.FormKey) is { } perk) o["perk"] = perk;
            if (e.Conditions.Count > 0) o["conditions"] = Json.Conditions(e.Conditions);
            effects.Add(o);
        }
        return new JsonObject
        {
            ["formKey"] = Json.Key(key),
            ["editorId"] = spell.EditorID,
            ["name"] = spell.Name?.String,
            ["description"] = Text(spell.Description?.String),
            ["plugin"] = from.FileName.String,
            ["effects"] = effects,
        };
    }

    public JsonObject? Spell(string editorId) => SpellByEditorId(editorId) is { } s ? Spell(s.FormKey) : null;

    /// <summary>Simple-typed property values of a Papyrus script attached to any effect of the spell.</summary>
    public Dictionary<string, object?> ScriptProperties(ISpellGetter spell, string scriptName)
    {
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in spell.Effects)
        {
            if (!_effects.TryGetValue(e.BaseEffect.FormKey, out var mgef)) continue;
            var script = mgef.Record.VirtualMachineAdapter?.Scripts
                .FirstOrDefault(s => string.Equals(s.Name, scriptName, StringComparison.OrdinalIgnoreCase));
            if (script == null) continue;
            foreach (var p in script.Properties)
                result[p.Name] = p switch
                {
                    IScriptStringPropertyGetter sp => sp.Data,
                    IScriptIntPropertyGetter ip => ip.Data,
                    IScriptFloatPropertyGetter fp => fp.Data,
                    IScriptBoolPropertyGetter bp => bp.Data,
                    IScriptObjectPropertyGetter op => op.Object.FormKey,
                    _ => null,
                };
        }
        return result;
    }

    public JsonObject? Perk(FormKey key)
    {
        if (!_perks.TryGetValue(key, out var entry)) return null;
        var (perk, from) = entry;
        return new JsonObject
        {
            ["formKey"] = Json.Key(key),
            ["editorId"] = perk.EditorID,
            ["name"] = perk.Name?.String,
            ["description"] = Text(perk.Description?.String),
            ["plugin"] = from.FileName.String,
        };
    }
}
