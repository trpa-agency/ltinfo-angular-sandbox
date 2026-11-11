import { Routes } from '@angular/router';

import { ProgramDetail } from './pages/program-detail/program-detail';
import { ProgramList } from './pages/program-list/program-list';

export const routes: Routes = [
  { path: '', component: ProgramList, title: 'Monitoring programs | LT Info sandbox' },
  { path: 'programs/:id', component: ProgramDetail, title: 'Program | LT Info sandbox' },
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
  { path: '**', redirectTo: '' },
];
