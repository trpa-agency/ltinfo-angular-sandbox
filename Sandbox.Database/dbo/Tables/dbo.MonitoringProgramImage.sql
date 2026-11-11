-- Photos for a program. The files themselves live in LT Info; FileResourceGUID is the
-- key the LT Info API serves them by (/file-resources/{guid}).
IF OBJECT_ID(N'dbo.MonitoringProgramImage', N'U') IS NULL
CREATE TABLE dbo.MonitoringProgramImage
(
    MonitoringProgramImageID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_MonitoringProgramImage_MonitoringProgramImageID PRIMARY KEY,
    MonitoringProgramID int NOT NULL CONSTRAINT FK_MonitoringProgramImage_MonitoringProgram_MonitoringProgramID FOREIGN KEY REFERENCES dbo.MonitoringProgram (MonitoringProgramID),
    FileResourceGUID uniqueidentifier NOT NULL,
    Caption nvarchar(1000) NULL,
    PhotoCredit nvarchar(200) NULL,
    IsKeyPhoto bit NOT NULL,
    SortOrder int NOT NULL
);
