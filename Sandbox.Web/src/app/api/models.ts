// The shapes Sandbox.API returns. Property names are PascalCase because the
// real LT Info API serializes that way. In ESA's repository these types come
// from an OpenAPI-generated client; here they are written by hand.

import type { Measure, SitesPerYearConfig } from '../lib/measures';
import type { SiteProfileConfig } from '../lib/site-profile';
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
  /** What the profile of a picked site or area reads; documented in lib/site-profile.ts. */
  siteProfile?: SiteProfileConfig;
}

export interface HealthStatus {
  Status: string;
  Database: string;
  ProgramCount: number;
}

/** The four totals on the home page, plus the photo count. */
export interface Summary {
  ProgramCount: number;
  CategoryCount: number;
  MappedSiteCount: number;
  PartnerCount: number;
  PhotoCount: number;
}

export interface Category {
  CategoryID: number;
  CategoryName: string;
  Folder: string;
  /** The Threshold Dashboard theme color. Some are light, so white on it needs a dark fallback. */
  ThemeColor: string;
  ProgramCount: number;
  /** One line on what the category monitors, for its card. */
  Blurb: string;
  /** The threshold goal for the category. */
  CategoryDescription: string;
  /** The white category icon on the Threshold Dashboard, or null. */
  IconUrl: string | null;
  /** Mapped sites across the category's programs. */
  SiteCount: number;
}

/** What a site's one point stands for: a site, or one representative point of an area or a line. */
export type SiteKind = 'site' | 'area' | 'line';

export interface MonitoringSite {
  MonitoringSiteID: number;
  MonitoringProgramID: number;
  SiteName: string;
  SiteKind: SiteKind;
  Latitude: number;
  Longitude: number;
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
  /** Mapped sites: points, plus one point for each mapped area or line. */
  SiteCount: number;
  /** Partner organization names; as many as PartnerCount. */
  PartnerNames: string[];
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
