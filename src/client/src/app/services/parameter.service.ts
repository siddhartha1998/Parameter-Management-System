import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ParameterDefinition, OverrideRequest, ScopeLevel } from '../models/parameter.models';

@Injectable({
  providedIn: 'root'
})
export class ParameterService {
  private apiUrl = 'https://localhost:7230/api'; 

  constructor(private http: HttpClient) { }

  getTemplates(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/templates/templates`);
  }

  getDefinitions(templateId?: string): Observable<ParameterDefinition[]> {
    const url = templateId 
      ? `${this.apiUrl}/templates/definitions?templateId=${templateId}`
      : `${this.apiUrl}/templates/definitions`;
    return this.http.get<ParameterDefinition[]>(url);
  }

  createDefinition(def: ParameterDefinition): Observable<ParameterDefinition> {
    return this.http.post<ParameterDefinition>(`${this.apiUrl}/templates/definitions`, def);
  }

  updateDefinition(id: string, def: ParameterDefinition): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/templates/definitions/${id}`, def);
  }

  bulkUpdateDefinitions(payload: any): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/templates/definitions/bulk`, payload);
  }

  deleteDefinition(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/templates/definitions/${id}`);
  }

  getConfiguration(nodeId: string, scope: ScopeLevel): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/configuration/${nodeId}/${scope}`);
  }

  saveOverride(request: OverrideRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/configuration/overrides`, request);
  }

  bulkSaveOverrides(requests: OverrideRequest[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/configuration/overrides/bulk`, requests);
  }

  getOverrideDefinitions(nodeId: string, scope: ScopeLevel, templateId: string): Observable<ParameterDefinition[]> {
    return this.http.get<ParameterDefinition[]>(`${this.apiUrl}/configuration/definitions/${nodeId}/${scope}/${templateId}`);
  }
}
