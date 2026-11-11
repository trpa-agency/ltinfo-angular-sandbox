using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sandbox.API.EFModels;
using Sandbox.API.Models;

namespace Sandbox.API.Controllers;

[ApiController]
public class CategoryController(SandboxDbContext dbContext) : ControllerBase
{
    // The white category icons the Threshold Dashboard publishes, by IconName.
    private const string IconBaseUrl = "https://thresholds.laketahoeinfo.org/assets/img/threshold-icons/";

    [HttpGet("categories")]
    public async Task<ActionResult<List<CategoryDto>>> List()
    {
        var rows = await dbContext.MonitoringProgramCategories.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .Select(x => new
            {
                x.MonitoringProgramCategoryID,
                x.MonitoringProgramCategoryName,
                x.Folder,
                x.ThemeColor,
                ProgramCount = x.MonitoringPrograms.Count,
                x.Blurb,
                x.CategoryDescription,
                x.IconName,
                SiteCount = x.MonitoringPrograms.SelectMany(p => p.MonitoringSites).Count()
            })
            .ToListAsync();

        return Ok(rows.Select(x => new CategoryDto(
            x.MonitoringProgramCategoryID, x.MonitoringProgramCategoryName, x.Folder, x.ThemeColor, x.ProgramCount,
            x.Blurb, x.CategoryDescription,
            string.IsNullOrWhiteSpace(x.IconName) ? null : $"{IconBaseUrl}{x.IconName}-white-icon.png",
            x.SiteCount)).ToList());
    }

    // Every mapped location, for the home page map. About 1,750 rows.
    [HttpGet("monitoring-sites")]
    public async Task<ActionResult<List<MonitoringSiteDto>>> Sites()
    {
        var sites = await dbContext.MonitoringSites.AsNoTracking()
            .OrderBy(x => x.MonitoringProgramID).ThenBy(x => x.MonitoringSiteID)
            .Select(x => new MonitoringSiteDto(x.MonitoringSiteID, x.MonitoringProgramID, x.SiteName, x.SiteKind, x.Latitude, x.Longitude))
            .ToListAsync();
        return Ok(sites);
    }

    // The four totals in the home page hero, plus photos.
    [HttpGet("summary")]
    public async Task<ActionResult<SummaryDto>> Summary()
    {
        return Ok(new SummaryDto(
            await dbContext.MonitoringPrograms.CountAsync(),
            await dbContext.MonitoringProgramCategories.CountAsync(),
            await dbContext.MonitoringSites.CountAsync(),
            await dbContext.Organizations.CountAsync(),
            await dbContext.MonitoringProgramImages.CountAsync()));
    }

    [HttpGet("health")]
    public async Task<ActionResult<HealthDto>> Health()
    {
        var programCount = await dbContext.MonitoringPrograms.CountAsync();
        return Ok(new HealthDto("ok", dbContext.Database.GetDbConnection().Database, programCount));
    }
}
