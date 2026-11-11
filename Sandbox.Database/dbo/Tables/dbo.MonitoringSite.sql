-- One mapped location per row, for the home page map: monitoring sites as captured
-- from Lake Tahoe Info, plus one representative point for each area (SEZ assessment
-- units, scenic corridors, plant survey zones) and each line (routes, road segments)
-- from the TRPA map service. Program pages still draw full shapes live.
IF OBJECT_ID(N'dbo.MonitoringSite', N'U') IS NULL
CREATE TABLE dbo.MonitoringSite
(
    MonitoringSiteID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_MonitoringSite_MonitoringSiteID PRIMARY KEY,
    MonitoringProgramID int NOT NULL CONSTRAINT FK_MonitoringSite_MonitoringProgram_MonitoringProgramID FOREIGN KEY REFERENCES dbo.MonitoringProgram (MonitoringProgramID),
    SiteName nvarchar(300) NULL,
    -- site, area, or line
    SiteKind varchar(10) NOT NULL CONSTRAINT CK_MonitoringSite_SiteKind CHECK (SiteKind IN ('site', 'area', 'line')),
    Latitude decimal(9, 6) NOT NULL,
    Longitude decimal(9, 6) NOT NULL
);
