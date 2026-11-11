IF OBJECT_ID(N'dbo.MonitoringProgramCategory', N'U') IS NULL
CREATE TABLE dbo.MonitoringProgramCategory
(
    MonitoringProgramCategoryID int NOT NULL CONSTRAINT PK_MonitoringProgramCategory_MonitoringProgramCategoryID PRIMARY KEY,
    MonitoringProgramCategoryName varchar(100) NOT NULL CONSTRAINT AK_MonitoringProgramCategory_MonitoringProgramCategoryName UNIQUE,
    Folder varchar(100) NOT NULL,
    ThemeColor varchar(7) NOT NULL,
    SortOrder int NOT NULL
);

-- Added for the home page. Each addition is safe to rerun.

-- One line on what the category covers, shown on its home page card.
IF COL_LENGTH(N'dbo.MonitoringProgramCategory', N'Blurb') IS NULL
    ALTER TABLE dbo.MonitoringProgramCategory ADD Blurb nvarchar(300) NULL;

-- The threshold category's goal, from the Threshold Dashboard.
IF COL_LENGTH(N'dbo.MonitoringProgramCategory', N'CategoryDescription') IS NULL
    ALTER TABLE dbo.MonitoringProgramCategory ADD CategoryDescription nvarchar(1000) NULL;

-- The Threshold Dashboard's name for the category's icon file, such as AirQuality.
IF COL_LENGTH(N'dbo.MonitoringProgramCategory', N'IconName') IS NULL
    ALTER TABLE dbo.MonitoringProgramCategory ADD IconName varchar(100) NULL;
