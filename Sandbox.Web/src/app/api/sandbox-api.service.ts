import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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
const API = '/api';

@Injectable({ providedIn: 'root' })
export class SandboxApiService {
  private readonly http = inject(HttpClient);

  getHealth(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${API}/health`);
  }

  /** The home page totals. */
  getSummary(): Observable<Summary> {
    return this.http.get<Summary>(`${API}/summary`);
  }

  /** Every mapped site, one point each, for the home page map. */
  getSites(): Observable<MonitoringSite[]> {
    return this.http.get<MonitoringSite[]>(`${API}/monitoring-sites`);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${API}/categories`);
  }

  getPrograms(): Observable<MonitoringProgramSummary[]> {
    return this.http.get<MonitoringProgramSummary[]>(`${API}/monitoring-programs`);
  }

  getProgram(id: number): Observable<MonitoringProgramDetail> {
    return this.http.get<MonitoringProgramDetail>(`${API}/monitoring-programs/${id}`);
  }

  /** The write path: one click here changes one row in SQL Server. */
  setFeatured(id: number, isFeatured: boolean): Observable<MonitoringProgramDetail> {
    return this.http.patch<MonitoringProgramDetail>(`${API}/monitoring-programs/${id}`, {
      IsFeatured: isFeatured,
    });
  }

  /** Saves which page layout the program uses. */
  setTemplate(id: number, template: Template): Observable<MonitoringProgramDetail> {
    return this.http.patch<MonitoringProgramDetail>(`${API}/monitoring-programs/${id}`, {
      Template: template,
    });
  }
}
