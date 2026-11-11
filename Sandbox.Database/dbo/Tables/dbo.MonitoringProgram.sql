IF OBJECT_ID(N'dbo.MonitoringProgram', N'U') IS NULL
CREATE TABLE dbo.MonitoringProgram
(
    MonitoringProgramID int NOT NULL CONSTRAINT PK_MonitoringProgram_MonitoringProgramID PRIMARY KEY,
    MonitoringProgramName varchar(200) NOT NULL,
    MonitoringProgramCategoryID int NOT NULL CONSTRAINT FK_MonitoringProgram_MonitoringProgramCategory_MonitoringProgramCategoryID FOREIGN KEY REFERENCES dbo.MonitoringProgramCategory (MonitoringProgramCategoryID),
    MonitoringProgramDescription nvarchar(max) NULL,
    MonitoringApproach nvarchar(max) NULL,
    IsFeatured bit NOT NULL,
    UpdateDate datetime2 NULL
);

-- Added for the page templates. ESA's dacpac deploy works out changes like these on
-- its own; here each addition is written so the script is safe to rerun.

-- Which of the three page layouts the program uses: map, charts, or context.
IF COL_LENGTH(N'dbo.MonitoringProgram', N'Template') IS NULL
    ALTER TABLE dbo.MonitoringProgram ADD Template varchar(20) NOT NULL
        CONSTRAINT DF_MonitoringProgram_Template DEFAULT ('charts')
        CONSTRAINT CK_MonitoringProgram_Template CHECK (Template IN ('map', 'charts', 'context'));

-- The program's chart and map settings as JSON: which layers of the TRPA
-- LTInfo_Monitoring map service to chart and map, and how.
IF COL_LENGTH(N'dbo.MonitoringProgram', N'DashboardConfig') IS NULL
    ALTER TABLE dbo.MonitoringProgram ADD DashboardConfig nvarchar(max) NULL
        CONSTRAINT CK_MonitoringProgram_DashboardConfig_IsJson CHECK (DashboardConfig IS NULL OR ISJSON(DashboardConfig) = 1);
