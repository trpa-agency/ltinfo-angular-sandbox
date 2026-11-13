using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sandbox.API.EFModels;
using Sandbox.API.Models;

namespace Sandbox.API.Controllers;

[ApiController]
public class MonitoringProgramController(SandboxDbContext dbContext) : ControllerBase
{
    // Photos are stored in LT Info; the database holds only each file's GUID.
    private const string FileResourceBaseUrl = "https://internalapi.laketahoeinfo.org/file-resources/";
    private static readonly string[] Templates = ["map", "charts", "context"];

    [HttpGet("monitoring-programs")]
    public async Task<ActionResult<List<MonitoringProgramSimpleDto>>> List()
    {
        var rows = await dbContext.MonitoringPrograms.AsNoTracking()
            .OrderBy(x => x.MonitoringProgramCategory.SortOrder).ThenBy(x => x.MonitoringProgramName)
            .Select(x => new
            {
                Dto = new MonitoringProgramSimpleDto
                {
                    MonitoringProgramID = x.MonitoringProgramID,
                    MonitoringProgramName = x.MonitoringProgramName,
                    CategoryID = x.MonitoringProgramCategoryID,
                    CategoryName = x.MonitoringProgramCategory.MonitoringProgramCategoryName,
                    ThemeColor = x.MonitoringProgramCategory.ThemeColor,
                    IsFeatured = x.IsFeatured,
                    PartnerCount = x.MonitoringProgramOrganizations.Count,
                    Template = x.Template,
                    ImageCount = x.MonitoringProgramImages.Count,
                    SiteCount = x.MonitoringSites.Count,
                    PartnerNames = x.MonitoringProgramOrganizations
                        .OrderBy(o => o.SortOrder)
                        .Select(o => o.Organization.OrganizationName)
                        .ToList()
                },
                KeyPhoto = x.MonitoringProgramImages
                    .OrderByDescending(i => i.IsKeyPhoto).ThenBy(i => i.SortOrder)
                    .Select(i => (Guid?)i.FileResourceGUID)
                    .FirstOrDefault()
            })
            .ToListAsync();

        foreach (var row in rows)
        {
            row.Dto.KeyPhotoUrl = PhotoUrl(row.KeyPhoto);
        }
        return Ok(rows.Select(x => x.Dto).ToList());
    }

    // Every program's chart and map settings in one call, for the Data Model page.
    [HttpGet("dashboard-configs")]
    public async Task<ActionResult<List<DashboardConfigDto>>> DashboardConfigs()
    {
        var rows = await dbContext.MonitoringPrograms.AsNoTracking()
            .Where(x => x.DashboardConfig != null)
            .OrderBy(x => x.MonitoringProgramID)
            .Select(x => new { x.MonitoringProgramID, x.DashboardConfig })
            .ToListAsync();
        return Ok(rows
            .Select(x => new DashboardConfigDto(x.MonitoringProgramID, JsonNode.Parse(x.DashboardConfig!) as JsonObject))
            .ToList());
    }

    [HttpGet("monitoring-programs/{monitoringProgramID:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MonitoringProgramDetailDto>> Get([FromRoute] int monitoringProgramID)
    {
        var detail = await GetDetail(monitoringProgramID);
        return detail == null ? NotFound() : Ok(detail);
    }

    // The write path: a click in Angular changes a row in SQL Server.
    [HttpPatch("monitoring-programs/{monitoringProgramID:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MonitoringProgramDetailDto>> Patch([FromRoute] int monitoringProgramID, [FromBody] MonitoringProgramPatchDto patch)
    {
        if (patch.Template != null && !Templates.Contains(patch.Template))
        {
            ModelState.AddModelError(nameof(patch.Template), "Template must be map, charts, or context.");
            return ValidationProblem(ModelState);
        }

        var program = await dbContext.MonitoringPrograms.SingleOrDefaultAsync(x => x.MonitoringProgramID == monitoringProgramID);
        if (program == null)
        {
            return NotFound();
        }

        if (patch.IsFeatured.HasValue || patch.Template != null)
        {
            program.IsFeatured = patch.IsFeatured ?? program.IsFeatured;
            program.Template = patch.Template ?? program.Template;
            program.UpdateDate = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
        }

        return Ok(await GetDetail(monitoringProgramID));
    }

    private async Task<MonitoringProgramDetailDto?> GetDetail(int monitoringProgramID)
    {
        var row = await dbContext.MonitoringPrograms.AsNoTracking()
            .Where(x => x.MonitoringProgramID == monitoringProgramID)
            .Select(x => new
            {
                Dto = new MonitoringProgramDetailDto
                {
                    MonitoringProgramID = x.MonitoringProgramID,
                    MonitoringProgramName = x.MonitoringProgramName,
                    CategoryID = x.MonitoringProgramCategoryID,
                    CategoryName = x.MonitoringProgramCategory.MonitoringProgramCategoryName,
                    ThemeColor = x.MonitoringProgramCategory.ThemeColor,
                    IsFeatured = x.IsFeatured,
                    PartnerCount = x.MonitoringProgramOrganizations.Count,
                    Template = x.Template,
                    SiteCount = x.MonitoringSites.Count,
                    PartnerNames = x.MonitoringProgramOrganizations
                        .OrderBy(o => o.SortOrder)
                        .Select(o => o.Organization.OrganizationName)
                        .ToList(),
                    MonitoringProgramDescription = x.MonitoringProgramDescription,
                    MonitoringApproach = x.MonitoringApproach,
                    Partners = x.MonitoringProgramOrganizations
                        .OrderBy(o => o.SortOrder)
                        .Select(o => new PartnerDto(o.OrganizationID, o.Organization.OrganizationName, o.Organization.OrganizationShortName))
                        .ToList()
                },
                x.DashboardConfig,
                x.RelatedLinks,
                Images = x.MonitoringProgramImages
                    .OrderByDescending(i => i.IsKeyPhoto).ThenBy(i => i.SortOrder)
                    .Select(i => new { i.MonitoringProgramImageID, i.FileResourceGUID, i.Caption, i.PhotoCredit, i.IsKeyPhoto })
                    .ToList()
            })
            .SingleOrDefaultAsync();
        if (row == null)
        {
            return null;
        }

        var detail = row.Dto;
        detail.Images = row.Images
            .Select(i => new ImageDto(i.MonitoringProgramImageID, PhotoUrl(i.FileResourceGUID)!, i.Caption, i.PhotoCredit, i.IsKeyPhoto))
            .ToList();
        detail.ImageCount = detail.Images.Count;
        detail.KeyPhotoUrl = detail.Images.FirstOrDefault()?.Url;
        detail.DashboardConfig = string.IsNullOrWhiteSpace(row.DashboardConfig) ? null : JsonNode.Parse(row.DashboardConfig) as JsonObject;
        detail.RelatedLinks = string.IsNullOrWhiteSpace(row.RelatedLinks)
            ? []
            : JsonSerializer.Deserialize<List<RelatedLinkDto>>(row.RelatedLinks) ?? [];
        return detail;
    }

    private static string? PhotoUrl(Guid? fileResourceGuid)
    {
        return fileResourceGuid.HasValue ? FileResourceBaseUrl + fileResourceGuid.Value.ToString("D") : null;
    }
}
