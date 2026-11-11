# Same stage layout as ESA's Name.API/Dockerfile (base, build, publish, final), plus a
# dev stage that docker-compose.override.yml targets so an edit to a .cs file reloads
# the API without rebuilding the image. Build context is the repo root.

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Sandbox.API/Sandbox.API.csproj", "Sandbox.API/"]
RUN dotnet restore "./Sandbox.API/Sandbox.API.csproj"
COPY Sandbox.API/ Sandbox.API/
WORKDIR /src/Sandbox.API

# Dev: the source folder is bind-mounted over /src/Sandbox.API and dotnet watch
# rebuilds on change. Polling, because file events do not cross a Windows bind mount.
FROM build AS dev
ENV DOTNET_USE_POLLING_FILE_WATCHER=1 \
    ASPNETCORE_ENVIRONMENT=Development
EXPOSE 8080
CMD ["dotnet", "watch", "run", "--no-launch-profile", "--urls", "http://0.0.0.0:8080"]

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Sandbox.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Sandbox.API.dll"]
