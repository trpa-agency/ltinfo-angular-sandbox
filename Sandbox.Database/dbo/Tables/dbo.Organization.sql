IF OBJECT_ID(N'dbo.Organization', N'U') IS NULL
CREATE TABLE dbo.Organization
(
    OrganizationID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Organization_OrganizationID PRIMARY KEY,
    OrganizationName varchar(200) NOT NULL CONSTRAINT AK_Organization_OrganizationName UNIQUE,
    OrganizationShortName varchar(50) NULL
);
