using ParameterManager.Core.Enums;
using System;
using System.Collections.Generic;

namespace ParameterManager.Core.Entities;

public class Resource : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class ParameterTemplate : BaseEntity
{
    public Guid ResourceId { get; set; }
    public Resource Resource { get; set; } = null!;
    public string TemplateName { get; set; } = string.Empty;
    public TemplateStatus Status { get; set; } = TemplateStatus.Draft;
    public int Version { get; set; } = 1;
    public ICollection<ParameterDefinition> ParameterDefinitions { get; set; } = [];
}
