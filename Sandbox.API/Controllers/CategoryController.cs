using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sandbox.API.EFModels;
using Sandbox.API.Models;

namespace Sandbox.API.Controllers;

[ApiController]
public class CategoryController(SandboxDbContext dbContext) : ControllerBase
{
    [HttpGet("categories")]
    public async Task<ActionResult<List<CategoryDto>>> List()
    {
        var categories = await dbContext.MonitoringProgramCategories.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .Select(x => new CategoryDto(x.MonitoringProgramCategoryID, x.MonitoringProgramCategoryName, x.Folder, x.ThemeColor, x.MonitoringPrograms.Count))
            .ToListAsync();
        return Ok(categories);
    }

    [HttpGet("health")]
    public async Task<ActionResult<HealthDto>> Health()
    {
        var programCount = await dbContext.MonitoringPrograms.CountAsync();
        return Ok(new HealthDto("ok", dbContext.Database.GetDbConnection().Database, programCount));
    }
}
