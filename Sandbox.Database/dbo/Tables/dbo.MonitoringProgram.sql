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
