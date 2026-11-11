// The shapes Sandbox.API returns. Property names are PascalCase because the
// real LT Info API serializes that way. In ESA's repository these types come
// from an OpenAPI-generated client; here they are written by hand.

export interface HealthStatus {
  Status: string;
  Database: string;
  ProgramCount: number;
}

export interface Category {
  CategoryID: number;
  CategoryName: string;
  Folder: string;
  ThemeColor: string;
  ProgramCount: number;
}

export interface MonitoringProgramSummary {
  MonitoringProgramID: number;
  MonitoringProgramName: string;
  CategoryID: number;
  CategoryName: string;
  ThemeColor: string;
  IsFeatured: boolean;
  PartnerCount: number;
}

export interface Partner {
  OrganizationID: number;
  OrganizationName: string;
  OrganizationShortName: string | null;
}

export interface MonitoringProgramDetail extends MonitoringProgramSummary {
  MonitoringProgramDescription: string | null;
  MonitoringApproach: string | null;
  Partners: Partner[];
}
