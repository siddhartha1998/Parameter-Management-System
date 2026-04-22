using Microsoft.EntityFrameworkCore;
using ParameterManager.Core.Entities;

namespace ParameterManager.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<ParameterDefinition> ParameterDefinitions { get; set; }
    public DbSet<ParameterValue> ParameterValues { get; set; }
    public DbSet<ParameterValueOverride> ParameterValueOverrides { get; set; }
    public DbSet<Resource> Resources { get; set; }
    public DbSet<ParameterTemplate> ParameterTemplates { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Resource>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
        });

        modelBuilder.Entity<ParameterTemplate>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.Resource)
                  .WithMany()
                  .HasForeignKey(e => e.ResourceId);
        });

        modelBuilder.Entity<ParameterDefinition>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.KeyName).IsRequired();
            entity.HasOne(e => e.Resource)
                  .WithMany()
                  .HasForeignKey(e => e.ResourceId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.ParameterTemplate)
                  .WithMany(t => t.ParameterDefinitions)
                  .HasForeignKey(e => e.ParameterTemplateId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(e => e.ParameterValues)
                  .WithOne(e => e.Definition)
                  .HasForeignKey(e => e.DefinitionId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Parent)
                  .WithMany(e => e.Children)
                  .HasForeignKey(e => e.ParentId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ParameterValue>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasMany(e => e.Overrides)
                  .WithOne(e => e.ParameterValue)
                  .HasForeignKey(e => e.ParameterValueId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ParameterValueOverride>(entity =>
        {
            entity.HasKey(e => e.Id);
        });
    }
}
