using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Sandbox.API.EFModels;

// ESA's repos keep these classes in a separate Name.EFModels project, generated from
// the database by their scaffold script. Here they are hand-written and live in the
// API project to keep the sandbox small. The tables are in Sandbox.Database/dbo/Tables.

[Table("MonitoringProgramCategory", Schema = "dbo")]
public class MonitoringProgramCategory
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.None)]
    public int MonitoringProgramCategoryID { get; set; }
    public string MonitoringProgramCategoryName { get; set; } = "";
    public string Folder { get; set; } = "";
    public string ThemeColor { get; set; } = "";
    public int SortOrder { get; set; }

    public List<MonitoringProgram> MonitoringPrograms { get; set; } = [];
}

[Table("MonitoringProgram", Schema = "dbo")]
public class MonitoringProgram
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.None)]
    public int MonitoringProgramID { get; set; }
    public string MonitoringProgramName { get; set; } = "";
    public int MonitoringProgramCategoryID { get; set; }
    public string? MonitoringProgramDescription { get; set; }
    public string? MonitoringApproach { get; set; }
    public bool IsFeatured { get; set; }
    public DateTime? UpdateDate { get; set; }
    /// <summary>map, charts, or context.</summary>
    public string Template { get; set; } = "charts";
    /// <summary>Chart and map settings for the TRPA map service, as JSON.</summary>
    public string? DashboardConfig { get; set; }

    public MonitoringProgramCategory MonitoringProgramCategory { get; set; } = null!;
    public List<MonitoringProgramOrganization> MonitoringProgramOrganizations { get; set; } = [];
    public List<MonitoringProgramImage> MonitoringProgramImages { get; set; } = [];
}

[Table("Organization", Schema = "dbo")]
public class Organization
{
    [Key]
    public int OrganizationID { get; set; }
    public string OrganizationName { get; set; } = "";
    public string? OrganizationShortName { get; set; }
}

[Table("MonitoringProgramOrganization", Schema = "dbo")]
public class MonitoringProgramOrganization
{
    [Key]
    public int MonitoringProgramOrganizationID { get; set; }
    public int MonitoringProgramID { get; set; }
    public int OrganizationID { get; set; }
    public int SortOrder { get; set; }

    public MonitoringProgram MonitoringProgram { get; set; } = null!;
    public Organization Organization { get; set; } = null!;
}

[Table("MonitoringProgramImage", Schema = "dbo")]
public class MonitoringProgramImage
{
    [Key]
    public int MonitoringProgramImageID { get; set; }
    public int MonitoringProgramID { get; set; }
    public Guid FileResourceGUID { get; set; }
    public string? Caption { get; set; }
    public string? PhotoCredit { get; set; }
    public bool IsKeyPhoto { get; set; }
    public int SortOrder { get; set; }

    public MonitoringProgram MonitoringProgram { get; set; } = null!;
}

public class SandboxDbContext(DbContextOptions<SandboxDbContext> options) : DbContext(options)
{
    public DbSet<MonitoringProgramCategory> MonitoringProgramCategories => Set<MonitoringProgramCategory>();
    public DbSet<MonitoringProgram> MonitoringPrograms => Set<MonitoringProgram>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<MonitoringProgramOrganization> MonitoringProgramOrganizations => Set<MonitoringProgramOrganization>();
    public DbSet<MonitoringProgramImage> MonitoringProgramImages => Set<MonitoringProgramImage>();
}
