using System.Text.Json.Nodes;

namespace Sandbox.API.Models;

// The shapes the Angular app reads. Property names are PascalCase on the wire.

public record HealthDto(string Status, string Database, int ProgramCount);

public record CategoryDto(int CategoryID, string CategoryName, string Folder, string ThemeColor, int ProgramCount);

public record PartnerDto(int OrganizationID, string OrganizationName, string? OrganizationShortName);

/// <summary>A program photo. Url points at the file in LT Info.</summary>
public record ImageDto(int MonitoringProgramImageID, string Url, string? Caption, string? PhotoCredit, bool IsKeyPhoto);

public class MonitoringProgramSimpleDto
{
    public int MonitoringProgramID { get; set; }
    public string MonitoringProgramName { get; set; } = "";
    public int CategoryID { get; set; }
    public string CategoryName { get; set; } = "";
    public string ThemeColor { get; set; } = "";
    public bool IsFeatured { get; set; }
    public int PartnerCount { get; set; }
    /// <summary>The page layout: map, charts, or context.</summary>
    public string Template { get; set; } = "charts";
    public int ImageCount { get; set; }
    /// <summary>The key photo, or the first photo, or null when the program has none.</summary>
    public string? KeyPhotoUrl { get; set; }
}

public class MonitoringProgramDetailDto : MonitoringProgramSimpleDto
{
    public string? MonitoringProgramDescription { get; set; }
    public string? MonitoringApproach { get; set; }
    public List<PartnerDto> Partners { get; set; } = [];
    public List<ImageDto> Images { get; set; } = [];
    /// <summary>
    /// Chart and map settings for the TRPA LTInfo_Monitoring map service: measures,
    /// sitesLayer, sitesPerYear, mapLayer, and overlays. Null when the program has none.
    /// </summary>
    public JsonObject? DashboardConfig { get; set; }
}

public class MonitoringProgramPatchDto
{
    public bool? IsFeatured { get; set; }
    /// <summary>map, charts, or context.</summary>
    public string? Template { get; set; }
}
