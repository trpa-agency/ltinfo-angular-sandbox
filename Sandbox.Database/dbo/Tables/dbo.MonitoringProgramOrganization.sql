IF OBJECT_ID(N'dbo.MonitoringProgramOrganization', N'U') IS NULL
CREATE TABLE dbo.MonitoringProgramOrganization
(
    MonitoringProgramOrganizationID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_MonitoringProgramOrganization_MonitoringProgramOrganizationID PRIMARY KEY,
    MonitoringProgramID int NOT NULL CONSTRAINT FK_MonitoringProgramOrganization_MonitoringProgram_MonitoringProgramID FOREIGN KEY REFERENCES dbo.MonitoringProgram (MonitoringProgramID),
    OrganizationID int NOT NULL CONSTRAINT FK_MonitoringProgramOrganization_Organization_OrganizationID FOREIGN KEY REFERENCES dbo.Organization (OrganizationID),
    SortOrder int NOT NULL,
    CONSTRAINT AK_MonitoringProgramOrganization_MonitoringProgramID_OrganizationID UNIQUE (MonitoringProgramID, OrganizationID)
);
