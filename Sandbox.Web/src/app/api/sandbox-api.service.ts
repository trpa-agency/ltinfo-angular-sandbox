import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import { environment } from '../../environments/environment';

import type { ProgramConfig } from '../lib/data-lineage';
import {
  Category,
  HealthStatus,
  MonitoringProgramDetail,
  MonitoringProgramSummary,
  MonitoringSite,
  Summary,
  Template,
} from './models';

// Every call goes to /api/... on the page's own origin. The dev server
// (proxy.conf.*.json) or nginx (nginx/default.conf.template) strips /api and
// forwards the rest to Sandbox.API, so the browser never needs CORS.
//
// The GitHub Pages build has no API. It reads api/<route>.json, a snapshot the
// export script took from the running stack, relative to <base href> so the
// site works under any repository path.
const url = (route: string) => (environment.staticApi ? `api/${route}.json` : `/api/${route}`);

/** What a write returns on the Pages build: a 405, which the pages show as "not saved". */
const readOnly = () =>
  throwError(
    () => new HttpErrorResponse({ status: 405, statusText: 'This copy is read-only', url: 'api' }),
  );

@Injectable({ providedIn: 'root' })
export class SandboxApiService {
  private readonly http = inject(HttpClient);

  getHealth(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(url('health'));
  }

  /** The home page totals. */
  getSummary(): Observable<Summary> {
    return this.http.get<Summary>(url('summary'));
  }

  /** Every mapped site, one point each, for the home page map. */
  getSites(): Observable<MonitoringSite[]> {
    return this.http.get<MonitoringSite[]>(url('monitoring-sites'));
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(url('categories'));
  }

  getPrograms(): Observable<MonitoringProgramSummary[]> {
    return this.http.get<MonitoringProgramSummary[]>(url('monitoring-programs'));
  }

  getProgram(id: number): Observable<MonitoringProgramDetail> {
    return this.http.get<MonitoringProgramDetail>(url(`monitoring-programs/${id}`));
  }

  /** Every program's chart and map settings, for the Data Model page. */
  getDashboardConfigs(): Observable<ProgramConfig[]> {
    return this.http.get<ProgramConfig[]>(url('dashboard-configs'));
  }

  /** The write path: one click here changes one row in SQL Server. */
  setFeatured(id: number, isFeatured: boolean): Observable<MonitoringProgramDetail> {
    if (environment.staticApi) return readOnly();
    return this.http.patch<MonitoringProgramDetail>(url(`monitoring-programs/${id}`), {
      IsFeatured: isFeatured,
    });
  }

  /** Saves which page layout the program uses. */
  setTemplate(id: number, template: Template): Observable<MonitoringProgramDetail> {
    if (environment.staticApi) return readOnly();
    return this.http.patch<MonitoringProgramDetail>(url(`monitoring-programs/${id}`), {
      Template: template,
    });
  }
}
