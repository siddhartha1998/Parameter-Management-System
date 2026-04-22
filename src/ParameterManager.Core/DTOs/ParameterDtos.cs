using ParameterManager.Core.Enums;
using System;
using System.Collections.Generic;

namespace ParameterManager.Core.DTOs;

public class ParameterDefinitionDto
{
    public Guid Id { get; set; }
    public Guid ResourceId { get; set; }
    public Guid ParameterTemplateId { get; set; }
    public string KeyName { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public Guid? ParentId { get; set; }
    public string ParentPath { get; set; } = string.Empty;
    public ParamCategory ParamCategory { get; set; }
    public DataType DataType { get; set; }
    public ScopeLevel ScopeLevel { get; set; }
    public string? ValidationRule { get; set; }
    public int? MaxLength { get; set; }
    public int DisplayOrder { get; set; }
    public string? Description { get; set; }
    public string? DataSource { get; set; }
    public bool IsActive { get; set; }
    public bool IsDepreciated { get; set; }
    public bool IsMandatory { get; set; }
    public List<string> DefaultValues { get; set; } = new();
    public List<Guid> ParameterValueIds { get; set; } = new();
    public List<Guid>? BaseParameterValueIds { get; set; }
    public List<string>? BaseTemplateValues { get; set; }
}

public class OverrideRequestDto
{
    public Guid ParameterValueId { get; set; }
    public string OverrideValue { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public ScopeLevel Node { get; set; }
    public Guid NodeId { get; set; }
}

public class TemplateDesignDto
{
    public Guid? ResourceId { get; set; }
    public Guid? ParameterTemplateId { get; set; }
    public string TemplateName { get; set; } = string.Empty;
    public TemplateStatus Status { get; set; }
    public int Version { get; set; }
    public ParamCategory Category { get; set; }
    public List<ParameterDefinitionDto> Definitions { get; set; } = new();
}
