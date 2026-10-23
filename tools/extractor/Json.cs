using System.Reflection;
using System.Text.Json.Nodes;
using Mutagen.Bethesda.Plugins;
using Mutagen.Bethesda.Skyrim;

namespace Extractor;

/// <summary>Converts Mutagen getters into plain JSON the web app consumes.</summary>
public static class Json
{
    public static string Key(FormKey key) => key.ToString(); // "000800:Skyrim.esm"

    /// <summary>Display names for forms referenced from condition args (quest, perk, ...), set once loaded.</summary>
    public static IReadOnlyDictionary<FormKey, string> Names { get; set; } = new Dictionary<FormKey, string>();

    public static JsonNode? Key(IFormLinkGetter link) => link.IsNull ? null : Key(link.FormKey);

    public static JsonArray Conditions(IEnumerable<IConditionGetter> conditions)
    {
        var arr = new JsonArray();
        foreach (var c in conditions)
        {
            var o = new JsonObject
            {
                ["fn"] = c.Data.Function.ToString(),
                ["op"] = c.CompareOperator switch
                {
                    CompareOperator.EqualTo => "==",
                    CompareOperator.NotEqualTo => "!=",
                    CompareOperator.GreaterThan => ">",
                    CompareOperator.GreaterThanOrEqualTo => ">=",
                    CompareOperator.LessThan => "<",
                    CompareOperator.LessThanOrEqualTo => "<=",
                    _ => c.CompareOperator.ToString(),
                },
                // OR binds to the next condition (Skyrim evaluates ORs before ANDs).
                ["or"] = c.Flags.HasFlag(Condition.Flag.OR),
                ["runOn"] = c.Data.RunOnType.ToString(),
            };
            switch (c)
            {
                case IConditionFloatGetter f: o["value"] = f.ComparisonValue; break;
                case IConditionGlobalGetter g: o["global"] = Key(g.ComparisonValue); break;
            }
            var args = ConditionArgs(c.Data);
            if (args.Count > 0) o["args"] = args;
            var names = new JsonObject();
            foreach (var (k, v) in args)
                if (v is JsonValue jv && jv.TryGetValue<string>(out var s) && FormKey.TryFactory(s, out var fk)
                    && Names.TryGetValue(fk, out var name))
                    names[k] = name;
            if (names.Count > 0) o["argNames"] = names;
            arr.Add(o);
        }
        return arr;
    }

    private static readonly HashSet<string> SkippedArgProps =
    [
        "Function", "StaticRegistration", "RunOnType", "Reference", "RunOnTypeIndex",
        "UseAliases", "UsePackageData",
    ];

    // Each condition function has its own data class (ActorValue, Perk, Keyword, ...); pick its
    // meaningful parameters by reflection instead of hand-mapping hundreds of functions.
    private static JsonObject ConditionArgs(IConditionDataGetter data)
    {
        var o = new JsonObject();
        var props = data.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance);
        foreach (var p in props)
        {
            if (SkippedArgProps.Contains(p.Name) || p.Name.Contains("Unused")) continue;
            var v = p.GetValue(data);
            JsonNode? node = v switch
            {
                null => null,
                IFormLinkGetter l => Key(l),
                Enum e => e.ToString(),
                string s => s.Length == 0 ? null : s,
                int i => i,
                uint u => u,
                float fl => fl,
                bool b => b,
                _ => FormLinkOrIndex(v),
            };
            if (p.Name == "ActorValue" && Skills.Normalize(v?.ToString()) is { } skill) node = skill;
            if (node != null) o[LowerFirst(p.Name)] = node;
        }
        return o;
    }

    // IFormLinkOrIndexGetter<T> is generic over the record type; reach its Link via reflection.
    private static JsonNode? FormLinkOrIndex(object v)
    {
        var link = v.GetType().GetProperty("Link")?.GetValue(v) as IFormLinkGetter;
        if (link != null) return Key(link);
        var index = v.GetType().GetProperty("Index")?.GetValue(v);
        return index is int or uint ? JsonValue.Create(Convert.ToInt64(index)) : null;
    }

    private static string LowerFirst(string s) => char.ToLowerInvariant(s[0]) + s[1..];
}
