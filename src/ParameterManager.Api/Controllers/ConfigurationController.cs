using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParameterManager.Core.DTOs;
using ParameterManager.Core.Services;
using ParameterManager.Core.Enums;
using ParameterManager.Infrastructure.Data;
using ParameterManager.Core.Entities;

namespace ParameterManager.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConfigurationController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly JsonReconstructor _reconstructor;

    public ConfigurationController(AppDbContext context, JsonReconstructor reconstructor)
    {
        _context = context;
        _reconstructor = reconstructor;
    }

    [HttpGet("{nodeId}/{scope}")]
    public async Task<IActionResult> GetConfiguration(Guid nodeId, ScopeLevel scope)
    {
        var definitions = await _context.ParameterDefinitions.ToListAsync();
        var defaultValues = await _context.ParameterValues.ToListAsync();
        var overrides = await _context.ParameterValueOverrides
            .Where(o => o.NodeId == nodeId && o.Node == scope)
            .ToListAsync();

        var json = _reconstructor.BuildJson(definitions, defaultValues, overrides, nodeId, scope);
        return Ok(json);
    }

    [HttpGet("definitions/{nodeId}/{scope}/{templateId}")]
    public async Task<IActionResult> GetDefinitionsWithOverrides(Guid nodeId, ScopeLevel scope, Guid templateId)
    {
        var definitions = await _context.ParameterDefinitions
            .Where(d => d.ParameterTemplateId == templateId)
            .Include(d => d.ParameterValues)
            .OrderBy(d => d.ParentPath)
            .ThenBy(d => d.KeyName)
            .ToListAsync();

        var overrides = await _context.ParameterValueOverrides
            .Where(o => o.NodeId == nodeId && o.Node == scope)
            .ToListAsync();

        var dtos = definitions.Select(d => 
        {
            var activeValues = new List<ParameterValue>();
            var pValList = d.ParameterValues.OrderBy(v => v.InstanceIndex).ToList();
            
            foreach (var val in pValList)
            {
                var ovr = overrides.FirstOrDefault(o => o.ParameterValueId == val.Id);
                if (ovr != null)
                {
                    if (ovr.IsActive)
                    {
                        val.Value = ovr.OverrideValue;
                        activeValues.Add(val);
                    }
                }
                else
                {
                    activeValues.Add(val);
                }
            }

            return new ParameterDefinitionDto
            {
                Id = d.Id,
                ResourceId = d.ResourceId,
                ParameterTemplateId = d.ParameterTemplateId,
                Label = d.Label,
                KeyName = d.KeyName,
                ParentId = d.ParentId,
                ParentPath = d.ParentPath,
                DataType = d.DataType,
                ValidationRule = d.ValidationRule,
                MaxLength = d.MaxLength,
                IsMandatory = d.IsMandatory,
                Description = d.Description,
                DataSource = d.DataSource,
                IsActive = d.IsActive,
                IsDepreciated = d.IsDepreciated,
                DisplayOrder = d.DisplayOrder,
                ScopeLevel = d.ScopeLevel,
                DefaultValues = activeValues.Select(v => v.Value).ToList(),
                ParameterValueIds = activeValues.Select(v => v.Id).ToList(),
                BaseParameterValueIds = pValList.Select(v => v.Id).ToList(),
                BaseTemplateValues = pValList.Select(v => 
                {
                    var ovr = overrides.FirstOrDefault(o => o.ParameterValueId == v.Id);
                    return ovr != null ? ovr.OverrideValue : v.Value;
                }).ToList()
            };
        }).ToList();

        return Ok(dtos);
    }

    [HttpPost("overrides")]
    public async Task<IActionResult> SaveOverride([FromBody] OverrideRequestDto request)
    {
        var existing = await _context.ParameterValueOverrides
            .FirstOrDefaultAsync(o => o.ParameterValueId == request.ParameterValueId && o.NodeId == request.NodeId && o.Node == request.Node);

        if (existing != null)
        {
            existing.OverrideValue = request.OverrideValue;
            existing.IsActive = request.IsActive;
        }
        else
        {
            _context.ParameterValueOverrides.Add(new Core.Entities.ParameterValueOverride
            {
                Id = Guid.NewGuid(),
                ParameterValueId = request.ParameterValueId,
                NodeId = request.NodeId,
                Node = request.Node,
                OverrideValue = request.OverrideValue,
                IsActive = request.IsActive
            });
        }

        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("overrides/bulk")]
    public async Task<IActionResult> BulkSaveOverrides([FromBody] List<OverrideRequestDto> requests)
    {
        foreach (var request in requests)
        {
            var existing = await _context.ParameterValueOverrides
                .FirstOrDefaultAsync(o => o.ParameterValueId == request.ParameterValueId && o.NodeId == request.NodeId && o.Node == request.Node);

            var baseParameterValue = await _context.ParameterValues.FindAsync(request.ParameterValueId);

            if (request.IsActive && baseParameterValue != null && request.OverrideValue == baseParameterValue.Value)
            {
                // Unnecessary Override. Value equals original underlying template.
                if (existing != null)
                {
                    _context.ParameterValueOverrides.Remove(existing);
                }
                continue;
            }

            if (existing != null)
            {
                existing.OverrideValue = request.OverrideValue;
                existing.IsActive = request.IsActive;
            }
            else
            {
                _context.ParameterValueOverrides.Add(new ParameterValueOverride
                {
                    Id = Guid.NewGuid(),
                    ParameterValueId = request.ParameterValueId,
                    NodeId = request.NodeId,
                    Node = request.Node,
                    OverrideValue = request.OverrideValue,
                    IsActive = request.IsActive
                });
            }
        }

        await _context.SaveChangesAsync();
        return Ok();
    }
}
