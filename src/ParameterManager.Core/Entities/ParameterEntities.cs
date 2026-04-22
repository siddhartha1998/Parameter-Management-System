using ParameterManager.Core.Enums;
using System.Collections.Generic;

namespace ParameterManager.Core.Entities;

public class ParameterDefinition : BaseEntity
{
    public Guid ResourceId { get; set; }
    public Resource Resource { get; set; } = null!;
    public Guid ParameterTemplateId { get; set; }
    public ParameterTemplate ParameterTemplate { get; set; } = null!;
    public string KeyName { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string ParentPath { get; set; } = string.Empty;
    public ParamCategory ParamCategory { get; set; }
    public DataType DataType { get; set; }
    public ScopeLevel ScopeLevel { get; set; }
    public string? ValidationRule { get; set; }
    public int? MaxLength { get; set; }
    public bool IsMandatory { get; set; }
    public int DisplayOrder { get; set; }
    public string? Description { get; set; }
    public string? DataSource { get; set; }
    public bool IsActive { get; set; }
    public bool IsDepreciated { get; set; }

    public Guid? ParentId { get; set; }
    public ParameterDefinition? Parent { get; set; }
    public ICollection<ParameterDefinition> Children { get; set; } = [];

    // Navigation
    public ICollection<ParameterValue> ParameterValues { get; set; } = [];
}

public class ParameterValue : BaseEntity
{
    public Guid DefinitionId { get; set; }
    public string Value { get; set; } = string.Empty;
    public int InstanceIndex { get; set; }

    public ParameterDefinition? Definition { get; set; }
    public ICollection<ParameterValueOverride> Overrides { get; set; } = [];
}

public class ParameterValueOverride : BaseEntity
{
    public Guid ParameterValueId { get; set; }
    public ScopeLevel Node { get; set; }
    public Guid NodeId { get; set; }
    public string OverrideValue { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public ParameterValue? ParameterValue { get; set; }
}
