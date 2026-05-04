import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { apiUrl } from './api-url';

interface JwtPayload {
  sub?: string;
  roles?: string[];
  exp?: number;
}

export interface AuthState {
  token: string | null;
  username: string | null;
  roles: string[];
  expiresAt: number | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'bookInventoryToken';
  private readonly authStateSubject = new BehaviorSubject<AuthState>(this.readState());

  readonly authState$ = this.authStateSubject.asObservable();

  login(username: string, password: string): Observable<string> {
    return this.http.post(apiUrl('/generateToken'), { username: username.trim(), password }, { responseType: 'text' }).pipe(
      tap((token) => this.setToken(token))
    );
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.authStateSubject.next(this.emptyState());
  }

  get token(): string | null {
    return this.authStateSubject.value.token;
  }

  get username(): string | null {
    return this.authStateSubject.value.username;
  }

  isAuthenticated(): boolean {
    const state = this.authStateSubject.value;
    return Boolean(state.token && (!state.expiresAt || state.expiresAt > Date.now()));
  }

  private setToken(token: string): void {
    const cleanToken = token.trim();
    localStorage.setItem(this.storageKey, cleanToken);
    this.authStateSubject.next(this.stateFromToken(cleanToken));
  }

  private readState(): AuthState {
    const token = localStorage.getItem(this.storageKey);
    if (!token) {
      return this.emptyState();
    }

    const state = this.stateFromToken(token);
    if (state.expiresAt && state.expiresAt <= Date.now()) {
      localStorage.removeItem(this.storageKey);
      return this.emptyState();
    }

    return state;
  }

  private stateFromToken(token: string): AuthState {
    const payload = this.decodeToken(token);
    return {
      token,
      username: payload?.sub ?? null,
      roles: Array.isArray(payload?.roles) ? payload.roles : [],
      expiresAt: payload?.exp ? payload.exp * 1000 : null
    };
  }

  private decodeToken(token: string): JwtPayload | null {
    try {
      const payload = token.split('.')[1];
      const paddedPayload = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
      const json = atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json) as JwtPayload;
    } catch {
      return null;
    }
  }

  private emptyState(): AuthState {
    return {
      token: null,
      username: null,
      roles: [],
      expiresAt: null
    };
  }
}
