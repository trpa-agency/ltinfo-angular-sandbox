namespace Sandbox.API.Models;

// The shapes the Angular app reads. Property names are PascalCase on the wire.

public record HealthDto(string Status, string Database, int ProgramCount);

public record CategoryDto(int CategoryID, string CategoryName, string Folder, string ThemeColor, int ProgramCount);

public record PartnerDto(int OrganizationID, string OrganizationName, string? OrganizationShortName);

public class MonitoringProgramSimpleDto
{
    public int MonitoringProgramID { get; set; }
    public string MonitoringProgramName { get; set; } = "";
    public int CategoryID { get; set; }
    public string CategoryName { get; set; } = "";
    public string ThemeColor { get; set; } = "";
    public bool IsFeatured { get; set; }
    public int PartnerCount { get; set; }
}

public class MonitoringProgramDetailDto : MonitoringProgramSimpleDto
{
    public string? MonitoringProgramDescription { get; set; }
    public string? MonitoringApproach { get; set; }
    public List<PartnerDto> Partners { get; set; } = [];
}

public class MonitoringProgramPatchDto
{
    public bool? IsFeatured { get; set; }
}
