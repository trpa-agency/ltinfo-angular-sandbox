import { Routes } from '@angular/router';

import { ProgramDetail } from './pages/program-detail/program-detail';
import { ProgramList } from './pages/program-list/program-list';

export const routes: Routes = [
  { path: '', component: ProgramList, title: 'Monitoring programs | LT Info sandbox' },
  { path: 'programs/:id', component: ProgramDetail, title: 'Program | LT Info sandbox' },
  { path: '**', redirectTo: '' },
];
