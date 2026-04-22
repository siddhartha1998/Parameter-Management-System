using System.Text.Json.Nodes;
using ParameterManager.Core.Entities;
using ParameterManager.Core.Enums;

namespace ParameterManager.Core.Services;

public class JsonReconstructor
{
    public JsonObject BuildJson(
        IEnumerable<ParameterDefinition> definitions, 
        IEnumerable<ParameterValue> defaultValues, 
        IEnumerable<ParameterValueOverride> overrides,
        Guid targetNodeId, 
        ScopeLevel targetScope)
    {
        var root = new JsonObject();
        
        // 1. Resolve effective values for the target context
        var resolvedValues = ResolveValues(definitions, defaultValues, overrides, targetNodeId, targetScope)
                            .GroupBy(v => v.DefinitionId)
                            .ToDictionary(g => g.Key, g => g.ToList());

        // 2. Build lookup map by ParentPath
        var childrenMap = definitions.GroupBy(d => d.ParentPath ?? "").ToDictionary(g => g.Key, g => g.ToList());

        // 3. Start recursive build from Root (ParentPath == "")
        BuildRecursive(root, "", childrenMap, resolvedValues);

        return root;
    }

    private void BuildRecursive(
        JsonObject container, 
        string currentPath, 
        Dictionary<string, List<ParameterDefinition>> childrenMap, 
        Dictionary<Guid, List<ParameterValue>> valuesMap)
    {
        if (!childrenMap.TryGetValue(currentPath, out var children)) return;

        foreach (var def in children.OrderBy(c => c.DisplayOrder))
        {
            if (!valuesMap.TryGetValue(def.Id, out var values) && 
                def.DataType != DataType.Object && def.DataType != DataType.ObjectArray) 
                continue;

            switch (def.DataType)
            {
                case DataType.Object:
                    var obj = new JsonObject();
                    container[def.KeyName] = obj;
                    var nextPathObj = string.IsNullOrEmpty(currentPath) ? def.KeyName : $"{currentPath}.{def.KeyName}";
                    BuildRecursive(obj, nextPathObj, childrenMap, valuesMap);
                    break;

                case DataType.ObjectArray:
                    var array = new JsonArray();
                    container[def.KeyName] = array;
                    
                    var nextPathArr = string.IsNullOrEmpty(currentPath) ? def.KeyName : $"{currentPath}.{def.KeyName}";
                    var maxInstances = GetMaxInstances(nextPathArr, childrenMap, valuesMap);
                    
                    for (int i = 0; i < maxInstances; i++)
                    {
                        var item = new JsonObject();
                        BuildRecursiveForArrayInstance(item, nextPathArr, i, childrenMap, valuesMap);
                        array.Add(item);
                    }
                    break;

                case DataType.StringArray:
                    var strArr = new JsonArray();
                    foreach (var v in values!.OrderBy(x => x.InstanceIndex)) strArr.Add(v.Value);
                    container[def.KeyName] = strArr;
                    break;

                case DataType.Boolean:
                    container[def.KeyName] = bool.TryParse(values![0].Value, out var b) ? b : false;
                    break;

                case DataType.Integer:
                    container[def.KeyName] = int.TryParse(values![0].Value, out var n) ? n : 0;
                    break;

                default:
                    container[def.KeyName] = values![0].Value;
                    break;
            }
        }
    }

    private int GetMaxInstances(string currentPath, Dictionary<string, List<ParameterDefinition>> childrenMap, Dictionary<Guid, List<ParameterValue>> valuesMap)
    {
        if (!childrenMap.TryGetValue(currentPath, out var children)) return 0;
        
        int max = 0;
        foreach (var child in children)
        {
            if (valuesMap.TryGetValue(child.Id, out var vals))
            {
                max = Math.Max(max, vals.Count);
            }
            if (child.DataType == DataType.Object || child.DataType == DataType.ObjectArray)
            {
                var nextPathObj = string.IsNullOrEmpty(currentPath) ? child.KeyName : $"{currentPath}.{child.KeyName}";
                var nested = GetMaxInstances(nextPathObj, childrenMap, valuesMap);
                max = Math.Max(max, nested);
            }
        }
        return max;
    }

    private void BuildRecursiveForArrayInstance(
        JsonObject container, 
        string currentPath, 
        int instanceIndex,
        Dictionary<string, List<ParameterDefinition>> childrenMap, 
        Dictionary<Guid, List<ParameterValue>> valuesMap)
    {
        if (!childrenMap.TryGetValue(currentPath, out var children)) return;

        foreach (var def in children.OrderBy(c => c.DisplayOrder))
        {
            if (def.DataType == DataType.Object)
            {
                var obj = new JsonObject();
                container[def.KeyName] = obj;
                var nextPathObj = string.IsNullOrEmpty(currentPath) ? def.KeyName : $"{currentPath}.{def.KeyName}";
                BuildRecursiveForArrayInstance(obj, nextPathObj, instanceIndex, childrenMap, valuesMap);
            }
            else if (valuesMap.TryGetValue(def.Id, out var values))
            {
                var val = values.FirstOrDefault(v => v.InstanceIndex == instanceIndex);
                if (val == null) continue;

                switch (def.DataType)
                {
                    case DataType.Boolean:
                        container[def.KeyName] = bool.TryParse(val.Value, out var b) ? b : false;
                        break;
                    case DataType.Integer:
                        container[def.KeyName] = int.TryParse(val.Value, out var n) ? n : 0;
                        break;
                    default:
                        container[def.KeyName] = val.Value;
                        break;
                }
            }
        }
    }

    private IEnumerable<ParameterValue> ResolveValues(
        IEnumerable<ParameterDefinition> definitions,
        IEnumerable<ParameterValue> defaults,
        IEnumerable<ParameterValueOverride> overrides,
        Guid nodeId,
        ScopeLevel scope)
    {
        var effectiveValues = new List<ParameterValue>();

        foreach (var def in definitions)
        {
            var defDefaults = defaults.Where(v => v.DefinitionId == def.Id).ToList();
            
            foreach (var defaultValue in defDefaults)
            {
                var overrideValue = overrides.FirstOrDefault(o => o.ParameterValueId == defaultValue.Id && o.NodeId == nodeId && o.Node == scope);
                
                if (overrideValue != null)
                {
                    if (overrideValue.IsActive)
                    {
                        effectiveValues.Add(new ParameterValue 
                        { 
                            Id = defaultValue.Id, 
                            DefinitionId = def.Id, 
                            Value = overrideValue.OverrideValue, 
                            InstanceIndex = defaultValue.InstanceIndex 
                        });
                    }
                }
                else
                {
                    effectiveValues.Add(defaultValue);
                }
            }
        }

        return effectiveValues;
    }
}
