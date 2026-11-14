import { inject } from '@angular/core';
import { Router, Routes, UrlMatchResult, UrlSegment } from '@angular/router';

import { Home } from './pages/home/home';
import { ProgramDetail } from './pages/program-detail/program-detail';

/**
 * The home page answers both / and /category/:folder through one route, so selecting a
 * category (which rewrites the address) reuses the page and its map instead of rebuilding them.
 */
export function homeMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length === 0) return { consumed: [] };
  if (segments.length === 2 && segments[0].path === 'category') {
    return { consumed: segments, posParams: { folder: segments[1] } };
  }
  return null;
}

/** The old separate views are sections of the home page now; their addresses still work. */
const toSection = (fragment: string) => () => inject(Router).createUrlTree(['/'], { fragment });

export const routes: Routes = [
  {
    matcher: homeMatcher,
    component: Home,
    title: 'Monitoring Programs | LT Info sandbox',
    // The hero runs edge to edge; the shell drops its column for this route.
    data: { fullBleed: true },
  },
  { path: 'programs', pathMatch: 'full', redirectTo: toSection('all-programs') },
  { path: 'about', pathMatch: 'full', redirectTo: toSection('about') },
  { path: 'programs/:id', component: ProgramDetail, title: 'Program | LT Info sandbox', data: { wide: true } },
  {
    path: 'data-model',
    title: 'Data Model | Monitoring Dashboard | LT Info sandbox',
    data: { wide: true },
    loadComponent: () => import('./pages/data-model/data-model').then((m) => m.DataModel),
  },
  {
    path: 'project-plan',
    title: 'Redesign Plan | Monitoring Dashboard | LT Info sandbox',
    data: { wide: true },
    loadComponent: () => import('./pages/project-plan/project-plan').then((m) => m.ProjectPlan),
  },
  // Test pages for the two data panels, loaded only when visited.
  {
    path: 'dev/charts',
    title: 'Chart panel test page | LT Info sandbox',
    loadComponent: () => import('./dashboard/chart-panel/chart-panel-demo').then((m) => m.ChartPanelDemo),
  },
  {
    path: 'dev/map',
    title: 'Map panel test page | LT Info sandbox',
    loadComponent: () => import('./dashboard/sites-panel/sites-panel-demo').then((m) => m.SitesPanelDemo),
  },
  // An address that is no page says so, with the way back; it no longer lands on the home page silently.
  {
    path: '**',
    title: 'Page not found | LT Info sandbox',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
