using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Sandbox.API.EFModels;

var builder = WebApplication.CreateBuilder(args);

// The connection string arrives from docker-compose as ConnectionStrings__SandboxDb.
// Nothing sensitive lives in this project; the password comes from docker-compose/.env.
var connectionString = builder.Configuration.GetConnectionString("SandboxDb")
    ?? throw new InvalidOperationException("ConnectionStrings:SandboxDb is not set. Start the API through docker-compose.");

builder.Services.AddDbContext<SandboxDbContext>(options => options.UseSqlServer(connectionString));

// PascalCase JSON, the same shape the real LT Info API returns.
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = null;
    options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});

// The OpenAPI document is built from the minimal-API JSON options, not the controller
// ones above, so the same two settings are repeated here. Without them the document
// describes camelCase properties the API never sends, and a client generated from it
// (ESA generates the Angular client this way) reads the wrong names.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = null;
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});
builder.Services.AddOpenApi();

var app = builder.Build();

// The contract the Angular client is generated from in ESA's repos: /openapi/v1.json.
app.MapOpenApi();
app.MapControllers();

app.Run();
