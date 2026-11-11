IF OBJECT_ID(N'dbo.MonitoringProgramCategory', N'U') IS NULL
CREATE TABLE dbo.MonitoringProgramCategory
(
    MonitoringProgramCategoryID int NOT NULL CONSTRAINT PK_MonitoringProgramCategory_MonitoringProgramCategoryID PRIMARY KEY,
    MonitoringProgramCategoryName varchar(100) NOT NULL CONSTRAINT AK_MonitoringProgramCategory_MonitoringProgramCategoryName UNIQUE,
    Folder varchar(100) NOT NULL,
    ThemeColor varchar(7) NOT NULL,
    SortOrder int NOT NULL
);
