using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParameterManager.Core.Entities;
using ParameterManager.Core.DTOs;
using ParameterManager.Core.Enums;
using ParameterManager.Infrastructure.Data;

namespace ParameterManager.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TemplatesController : ControllerBase
{
    private readonly AppDbContext _context;

    public TemplatesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates()
    {
        var templates = await _context.ParameterTemplates
            .Select(t => new TemplateDesignDto
            {
                ParameterTemplateId = t.Id,
                ResourceId = t.ResourceId,
                TemplateName = t.TemplateName,
                Status = t.Status,
                Version = t.Version
            }).ToListAsync();
        return Ok(templates);
    }

    [HttpGet("definitions")]
    public async Task<IActionResult> GetDefinitions([FromQuery] Guid? templateId)
    {
        var query = _context.ParameterDefinitions.Include(d => d.ParameterValues).AsQueryable();

        if (templateId.HasValue && templateId.Value != Guid.Empty)
        {
            query = query.Where(d => d.ParameterTemplateId == templateId.Value);
        }

        var definitions = await query
            .OrderBy(d => d.ParentPath)
            .ThenBy(d => d.KeyName)
            .Select(d => new ParameterDefinitionDto
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
                DefaultValues = d.ParameterValues.OrderBy(v => v.InstanceIndex).Select(v => v.Value).ToList(),
                ParameterValueIds = d.ParameterValues.OrderBy(v => v.InstanceIndex).Select(v => v.Id).ToList()
            })
            .OrderBy(p => p.DisplayOrder)
            .ToListAsync();

        return Ok(definitions);
    }

    [HttpPost("definitions")]
    public async Task<IActionResult> CreateDefinition([FromBody] ParameterDefinitionDto dto)
    {
        var definition = new ParameterDefinition
        {
            Id = Guid.NewGuid(),
            ResourceId = dto.ResourceId,
            ParameterTemplateId = dto.ParameterTemplateId,
            Label = dto.Label,
            KeyName = dto.KeyName,
            ParentId = dto.ParentId,
            ParentPath = dto.ParentPath,
            DataType = dto.DataType,
            ValidationRule = dto.ValidationRule,
            MaxLength = dto.MaxLength,
            IsMandatory = dto.IsMandatory,
            Description = dto.Description,
            DataSource = dto.DataSource,
            IsActive = dto.IsActive,
            IsDepreciated = dto.IsDepreciated,
            DisplayOrder = dto.DisplayOrder,
            ScopeLevel = dto.ScopeLevel
        };

        if (dto.DefaultValues != null && dto.DefaultValues.Any())
        {
            for (int i = 0; i < dto.DefaultValues.Count; i++)
            {
                definition.ParameterValues.Add(new ParameterValue
                {
                    Id = Guid.NewGuid(),
                    Value = dto.DefaultValues[i],
                    InstanceIndex = i
                });
            }
        }

        _context.ParameterDefinitions.Add(definition);
        await _context.SaveChangesAsync();

        dto.Id = definition.Id;
        return CreatedAtAction(nameof(GetDefinitions), new { id = definition.Id }, dto);
    }

    [HttpPut("definitions/{id}")]
    public async Task<IActionResult> UpdateDefinition(Guid id, [FromBody] ParameterDefinitionDto dto)
    {
        var definition = await _context.ParameterDefinitions
            .Include(d => d.ParameterValues)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (definition == null) return NotFound();

        definition.Label = dto.Label;
        definition.KeyName = dto.KeyName;
        definition.ResourceId = dto.ResourceId;
        definition.ParameterTemplateId = dto.ParameterTemplateId;
        definition.ParentId = dto.ParentId;
        definition.ParentPath = dto.ParentPath;
        definition.DataType = dto.DataType;
        definition.ValidationRule = dto.ValidationRule;
        definition.MaxLength = dto.MaxLength;
        definition.IsMandatory = dto.IsMandatory;
        definition.Description = dto.Description;
        definition.DataSource = dto.DataSource;
        definition.IsActive = dto.IsActive;
        definition.IsDepreciated = dto.IsDepreciated;
        definition.DisplayOrder = dto.DisplayOrder;
        definition.ScopeLevel = dto.ScopeLevel;

        // Smart Update Default Values
        var existingVals = definition.ParameterValues.OrderBy(v => v.InstanceIndex).ToList();
        var newVals = dto.DefaultValues ?? new List<string>();

        for (int i = 0; i < Math.Max(existingVals.Count, newVals.Count); i++)
        {
            if (i < existingVals.Count && i < newVals.Count)
            {
                if (existingVals[i].Value != newVals[i])
                {
                    existingVals[i].Value = newVals[i];
                    _context.Entry(existingVals[i]).State = EntityState.Modified;
                }
            }
            else if (i < existingVals.Count && i >= newVals.Count)
            {
                _context.ParameterValues.Remove(existingVals[i]);
            }
            else if (i >= existingVals.Count && i < newVals.Count)
            {
                _context.ParameterValues.Add(new ParameterValue
                {
                    Id = Guid.NewGuid(),
                    DefinitionId = definition.Id,
                    Value = newVals[i],
                    InstanceIndex = i
                });
            }
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("definitions/bulk")]
    public async Task<IActionResult> BulkUpdateDefinitions([FromBody] TemplateDesignDto designDto)
    {
        ParameterTemplate? template = null;

        if (designDto.ResourceId == null) { throw new InvalidOperationException("Resouce could not be empty"); }

        Resource resource = await _context.Resources.FirstOrDefaultAsync() ?? throw new InvalidOperationException($"Resouce could not be found for {designDto.ResourceId}");
        if (designDto.ParameterTemplateId != null && designDto.ParameterTemplateId != Guid.Empty)
        {
            template = await _context.ParameterTemplates
                .FirstOrDefaultAsync(t => t.Id == designDto.ParameterTemplateId.Value);
        }

        // CREATE Template if not found and data provided
        if (template == null)
        {
            if (string.IsNullOrEmpty(designDto.TemplateName))
                return BadRequest("Template name is required for new templates.");

            template = new ParameterTemplate
            {
                Id = designDto.ParameterTemplateId ?? Guid.NewGuid(),
                ResourceId = resource.Id,
                TemplateName = designDto.TemplateName,
                Status = TemplateStatus.Draft,
                Version = 1
            };
            _context.ParameterTemplates.Add(template);
            await _context.SaveChangesAsync(); // Save to get the ID for definitions
        }

        if (template == null) return NotFound("Template not found.");

        if (template.Status == TemplateStatus.Archived)
            return BadRequest("Template is Archived and cannot be modified.");

        bool isPublished = template.Status == TemplateStatus.Published;

        foreach (var dto in designDto.Definitions)
        {
            ParameterDefinition? definition = null;

            if (dto.Id != Guid.Empty)
            {
                definition = await _context.ParameterDefinitions
                    .Include(d => d.ParameterValues)
                    .FirstOrDefaultAsync(d => d.Id == dto.Id);
            }

            // DELETE CASE
            if (!dto.IsActive)
            {
                if (definition != null)
                {
                    if (isPublished) return BadRequest("Cannot delete parameters from a Published template.");
                    _context.ParameterDefinitions.Remove(definition);
                }
                continue;
            }

            // CREATE CASE
            if (definition == null)
            {
                if (isPublished) return BadRequest("Cannot add new parameters to a Published template.");

                definition = new ParameterDefinition
                {
                    Id = dto.Id == Guid.Empty ? Guid.NewGuid() : dto.Id,
                    ParameterTemplateId = template.Id,
                    ResourceId = template.ResourceId
                };
                _context.ParameterDefinitions.Add(definition);
            }

            // ASSIGN METADATA (Common for both Create and Update)
            if (isPublished)
            {
                if (dto.Id != Guid.Empty) // Only check existing
                {
                    // Verify metadata hasn't changed
                    if (definition.KeyName != dto.KeyName ||
                        definition.DataType != dto.DataType ||
                        definition.ParentPath != dto.ParentPath ||
                        definition.ParamCategory != dto.ParamCategory)
                    {
                        return BadRequest($"Metadata for '{definition.KeyName}' is read-only in Published status.");
                    }
                }
            }
            else
            {
                definition.Label = dto.Label;
                definition.KeyName = dto.KeyName;
                definition.ParentId = dto.ParentId;
                definition.ParentPath = dto.ParentPath;
                definition.DataType = dto.DataType;
                definition.ValidationRule = dto.ValidationRule;
                definition.MaxLength = dto.MaxLength;
                definition.IsMandatory = dto.IsMandatory;
                definition.Description = dto.Description;
                definition.DataSource = dto.DataSource;
                definition.IsDepreciated = dto.IsDepreciated;
                definition.DisplayOrder = dto.DisplayOrder;
                definition.ScopeLevel = dto.ScopeLevel;
                definition.IsActive = true; // Ensure it stays active if we are in this block
            }

            // Values update (Allowed in both Draft and Published)
            var existingBulkVals = definition.ParameterValues.OrderBy(v => v.InstanceIndex).ToList();
            var newBulkVals = dto.DefaultValues ?? new List<string>();

            for (int i = 0; i < Math.Max(existingBulkVals.Count, newBulkVals.Count); i++)
            {
                if (i < existingBulkVals.Count && i < newBulkVals.Count)
                {
                    if (existingBulkVals[i].Value != newBulkVals[i])
                    {
                        existingBulkVals[i].Value = newBulkVals[i];
                        _context.Entry(existingBulkVals[i]).State = EntityState.Modified;
                    }
                }
                else if (i < existingBulkVals.Count && i >= newBulkVals.Count)
                {
                    if (isPublished) return BadRequest("Cannot change the number of array elements in a Published template.");
                    _context.ParameterValues.Remove(existingBulkVals[i]);
                }
                else if (i >= existingBulkVals.Count && i < newBulkVals.Count)
                {
                    if (isPublished) return BadRequest("Cannot change the number of array elements in a Published template.");
                    _context.ParameterValues.Add(new ParameterValue
                    {
                        Id = Guid.NewGuid(),
                        DefinitionId = definition.Id,
                        Value = newBulkVals[i],
                        InstanceIndex = i
                    });
                }
            }
        }

        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("publish/{templateId}")]
    public async Task<IActionResult> PublishTemplate(Guid templateId)
    {
        var template = await _context.ParameterTemplates.FindAsync(templateId);
        if (template == null) return NotFound();

        template.Status = TemplateStatus.Published;
        template.Version += 1;

        await _context.SaveChangesAsync();
        return Ok(new { template.Status, template.Version });
    }

    [HttpDelete("definitions/{id}")]
    public async Task<IActionResult> DeleteDefinition(Guid id)
    {
        var definition = await _context.ParameterDefinitions.FindAsync(id);
        if (definition == null) return NotFound();

        _context.ParameterDefinitions.Remove(definition);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
