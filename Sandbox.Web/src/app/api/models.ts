// The shapes Sandbox.API returns. Property names are PascalCase because the
// real LT Info API serializes that way. In ESA's repository these types come
// from an OpenAPI-generated client; here they are written by hand.

import type { Measure, SitesPerYearConfig } from '../lib/measures';
import type { MapLayerConfig, OverlayConfig, SitesLayerConfig } from '../lib/sites';

/** The three page layouts a program can use. */
export type Template = 'map' | 'charts' | 'context';
export const TEMPLATES: readonly Template[] = ['map', 'charts', 'context'];

/** A program photo. Url points at the file in LT Info. */
export interface ProgramImage {
  MonitoringProgramImageID: number;
  Url: string;
  Caption: string | null;
  PhotoCredit: string | null;
  IsKeyPhoto: boolean;
}

/**
 * A program's chart and map settings for the TRPA LTInfo_Monitoring map service.
 * The keys and their meaning are the ones documented in templates/README.md of the
 * LT Info Monitoring Dashboard repo; the lib/ modules read them unchanged.
 */
export interface DashboardConfig {
  measures?: Measure[];
  sitesLayer?: SitesLayerConfig;
  sitesPerYear?: SitesPerYearConfig;
  mapLayer?: MapLayerConfig;
  overlays?: OverlayConfig[];
}

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
  Template: Template;
  ImageCount: number;
  /** The key photo, else the first photo, else null. */
  KeyPhotoUrl: string | null;
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
  /** Key photo first. */
  Images: ProgramImage[];
  DashboardConfig: DashboardConfig | null;
}
