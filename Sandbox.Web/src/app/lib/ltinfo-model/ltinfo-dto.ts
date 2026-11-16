// The shapes of LT Info's GET monitoring-new/programs and monitoring-new/data-model responses,
// copied from the TypeScript models LT Info generates from its API (LtInfo.Web/src/app/shared/
// generated/model). The sandbox reads a snapshot of those two responses from
// public/data/ltinfo/, so the Data Model page shows LT Info's real programs and indicators.
// LT Info marks every property optional; the API always sends all of them (null when empty), so
// they are required here, which this app's strict null checks need.

export interface MonitoringNewPartnerSimple {
  OrganizationID: number;
  OrganizationName: string | null;
  OrganizationShortName: string | null;
}

export interface MonitoringNewProgramGridRow {
  MonitoringProgramID: number;
  MonitoringProgramName: string | null;
  MonitoringProgramCategoryID: number | null;
  MonitoringProgramCategoryDisplayName: string | null;
  IsFeaturedProgram: boolean;
  KeyPhotoFileResourceInfoGUID: string | null;
  NumberOfMappedSites: number;
  Partners: MonitoringNewPartnerSimple[] | null;
}

export interface MonitoringNewIndicatorSource {
  IndicatorID: number;
  IndicatorDisplayName: string;
  IndicatorTypeDisplayName: string;
  IndicatorDataSourceTypeDisplayName: string;
  IsCustomCalculation: boolean;
  MeasurementUnitTypeDisplayName: string | null;
  ReportedValueCount: number;
  ChartSourceURL: string | null;
  ExternalDataSourceUrl: string | null;
  IsReportedInThresholdDashboard: boolean;
  IsReportedInClimateResilienceDashboard: boolean;
  IsReportedInLakeClarity: boolean;
  IsReportedInTransportationTracker: boolean;
  MonitoringProgramIDs: number[] | null;
}

export interface MonitoringNewDataSourceSimple {
  MonitoringDataSourceID: number;
  MonitoringDataSourceName: string;
  MonitoringDataSourceLocation: string | null;
  MonitoringProgramID: number | null;
  LastRunDate: string | null;
  LastRunStatus: string | null;
  LastChangeDate: string | null;
}

export interface MonitoringNewDataModel {
  Indicators: MonitoringNewIndicatorSource[] | null;
  DataSources: MonitoringNewDataSourceSimple[] | null;
}
