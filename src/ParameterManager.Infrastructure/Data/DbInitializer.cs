using Microsoft.EntityFrameworkCore;
using ParameterManager.Core.Entities;
using ParameterManager.Core.Enums;
using ParameterManager.Infrastructure.Data;

namespace ParameterManager.Infrastructure.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(AppDbContext context)
    {
        if (await context.ParameterTemplates.AnyAsync()) return;

        var defaultResource = new Resource 
        { 
            Id = Guid.NewGuid(), 
            Name = "Core Library" 
        };
        
        var defaultTemplate = new ParameterTemplate 
        { 
            Id = Guid.NewGuid(), 
            ResourceId = defaultResource.Id, 
            TemplateName = "Master Terminal Specs", 
            Status = TemplateStatus.Published, 
            Version = 1 
        };
        
        await context.Resources.AddAsync(defaultResource);
        await context.ParameterTemplates.AddAsync(defaultTemplate);

        var saleEnabled = new ParameterDefinition
        {
            Id = Guid.NewGuid(),
            ResourceId = defaultResource.Id,
            ParameterTemplateId = defaultTemplate.Id,
            Label = "Sale Enabled",
            KeyName = "SaleEnabled",
            ParentPath = "",
            DataType = DataType.Boolean,
            ScopeLevel = ScopeLevel.Global
        };
        saleEnabled.ParameterValues.Add(new ParameterValue { Id = Guid.NewGuid(), Value = "true", InstanceIndex = 0 });

        var aid = new ParameterDefinition
        {
            Id = Guid.NewGuid(),
            ResourceId = defaultResource.Id,
            ParameterTemplateId = defaultTemplate.Id,
            Label = "AID List",
            KeyName = "Aid",
            ParentPath = "",
            DataType = DataType.StringArray,
            ScopeLevel = ScopeLevel.Global
        };
        aid.ParameterValues.Add(new ParameterValue { Id = Guid.NewGuid(), Value = "A01", InstanceIndex = 0 });
        aid.ParameterValues.Add(new ParameterValue { Id = Guid.NewGuid(), Value = "A02", InstanceIndex = 1 });
        aid.ParameterValues.Add(new ParameterValue { Id = Guid.NewGuid(), Value = "A03", InstanceIndex = 2 });

        // 2. Nested hierarchy for Paypass
        var paypassNode = new ParameterDefinition
        {
            Id = Guid.NewGuid(),
            ResourceId = defaultResource.Id,
            ParameterTemplateId = defaultTemplate.Id,
            Label = "Paypass",
            KeyName = "Paypass",
            ParentPath = "",
            DataType = DataType.Object,
            ScopeLevel = ScopeLevel.Global
        };

        var paypassAcqNode = new ParameterDefinition
        {
            Id = Guid.NewGuid(),
            ResourceId = defaultResource.Id,
            ParameterTemplateId = defaultTemplate.Id,
            Label = "Paypass Acquirer Config",
            KeyName = "Paypass_acq_A0000000041010",
            ParentPath = "Paypass",
            DataType = DataType.Object,
            ScopeLevel = ScopeLevel.Global
        };

        var transType = new ParameterDefinition
        {
            Id = Guid.NewGuid(),
            ResourceId = defaultResource.Id,
            ParameterTemplateId = defaultTemplate.Id,
            Label = "Transaction Type (9C)",
            KeyName = "transaction_type_9C",
            ParentPath = "Paypass.Paypass_acq_A0000000041010",
            DataType = DataType.HexString,
            ScopeLevel = ScopeLevel.Global
        };
        transType.ParameterValues.Add(new ParameterValue { Id = Guid.NewGuid(), Value = "00", InstanceIndex = 0 });

        await context.ParameterDefinitions.AddRangeAsync(saleEnabled, aid, paypassNode, paypassAcqNode, transType);
        await context.SaveChangesAsync();
    }
}
