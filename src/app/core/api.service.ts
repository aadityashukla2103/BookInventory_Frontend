import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiRecord } from '../data/models';
import { apiUrl } from './api-url';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  list<T extends ApiRecord = ApiRecord>(endpoint: string): Observable<T[]> {
    return this.http.get<T[]>(apiUrl(endpoint));
  }

  get<T extends ApiRecord = ApiRecord>(endpoint: string, path: string): Observable<T> {
    return this.http.get<T>(apiUrl(`${endpoint}/${path}`));
  }

  create<T extends ApiRecord = ApiRecord>(endpoint: string, payload: Partial<T>): Observable<T> {
    return this.http.post<T>(apiUrl(endpoint), payload);
  }

  update<T extends ApiRecord = ApiRecord>(endpoint: string, path: string, payload: Partial<T>): Observable<T> {
    return this.http.put<T>(apiUrl(`${endpoint}/${path}`), payload);
  }

  delete(endpoint: string, path: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`${endpoint}/${path}`));
  }
}

export function buildIdPath(record: ApiRecord, idFields: string[]): string {
  return idFields.map((field) => encodeURIComponent(String(record[field] ?? ''))).join('/');
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }

    if (error.error && typeof error.error === 'object') {
      const apiError = error.error as Record<string, unknown>;
      const message = apiError['message'] ?? apiError['error'];
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    if (error.status === 0) {
      return 'Backend is not reachable. Start Spring Boot on port 8088 and try again.';
    }

    return `Request failed with status ${error.status}.`;
  }

  return 'Something went wrong. Please try again.';
}
