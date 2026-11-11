using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sandbox.API.EFModels;
using Sandbox.API.Models;

namespace Sandbox.API.Controllers;

[ApiController]
public class MonitoringProgramController(SandboxDbContext dbContext) : ControllerBase
{
    [HttpGet("monitoring-programs")]
    public async Task<ActionResult<List<MonitoringProgramSimpleDto>>> List()
    {
        var programs = await dbContext.MonitoringPrograms.AsNoTracking()
            .OrderBy(x => x.MonitoringProgramCategory.SortOrder).ThenBy(x => x.MonitoringProgramName)
            .Select(x => new MonitoringProgramSimpleDto
            {
                MonitoringProgramID = x.MonitoringProgramID,
                MonitoringProgramName = x.MonitoringProgramName,
                CategoryID = x.MonitoringProgramCategoryID,
                CategoryName = x.MonitoringProgramCategory.MonitoringProgramCategoryName,
                ThemeColor = x.MonitoringProgramCategory.ThemeColor,
                IsFeatured = x.IsFeatured,
                PartnerCount = x.MonitoringProgramOrganizations.Count
            })
            .ToListAsync();
        return Ok(programs);
    }

    [HttpGet("monitoring-programs/{monitoringProgramID:int}")]
    public async Task<ActionResult<MonitoringProgramDetailDto>> Get([FromRoute] int monitoringProgramID)
    {
        var detail = await GetDetail(monitoringProgramID);
        return detail == null ? NotFound() : Ok(detail);
    }

    // The write path: a click in Angular changes a row in SQL Server.
    [HttpPatch("monitoring-programs/{monitoringProgramID:int}")]
    public async Task<ActionResult<MonitoringProgramDetailDto>> Patch([FromRoute] int monitoringProgramID, [FromBody] MonitoringProgramPatchDto patch)
    {
        var program = await dbContext.MonitoringPrograms.SingleOrDefaultAsync(x => x.MonitoringProgramID == monitoringProgramID);
        if (program == null)
        {
            return NotFound();
        }

        if (patch.IsFeatured.HasValue)
        {
            program.IsFeatured = patch.IsFeatured.Value;
            program.UpdateDate = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
        }

        return Ok(await GetDetail(monitoringProgramID));
    }

    private async Task<MonitoringProgramDetailDto?> GetDetail(int monitoringProgramID)
    {
        return await dbContext.MonitoringPrograms.AsNoTracking()
            .Where(x => x.MonitoringProgramID == monitoringProgramID)
            .Select(x => new MonitoringProgramDetailDto
            {
                MonitoringProgramID = x.MonitoringProgramID,
                MonitoringProgramName = x.MonitoringProgramName,
                CategoryID = x.MonitoringProgramCategoryID,
                CategoryName = x.MonitoringProgramCategory.MonitoringProgramCategoryName,
                ThemeColor = x.MonitoringProgramCategory.ThemeColor,
                IsFeatured = x.IsFeatured,
                PartnerCount = x.MonitoringProgramOrganizations.Count,
                MonitoringProgramDescription = x.MonitoringProgramDescription,
                MonitoringApproach = x.MonitoringApproach,
                Partners = x.MonitoringProgramOrganizations
                    .OrderBy(o => o.SortOrder)
                    .Select(o => new PartnerDto(o.OrganizationID, o.Organization.OrganizationName, o.Organization.OrganizationShortName))
                    .ToList()
            })
            .SingleOrDefaultAsync();
    }
}
