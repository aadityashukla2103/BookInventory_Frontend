import { Injectable, inject } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';

import { UserDto } from '../models';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private cachedUser: UserDto | null = null;

  loadCurrentUser(): Observable<UserDto | null> {
    const username = this.auth.username;
    if (!username) {
      return of(null);
    }

    if (this.cachedUser?.userName === username) {
      return of(this.cachedUser);
    }

    return this.api.list<UserDto>('/api/users').pipe(
      map((users) => users.find((user) => user.userName === username) ?? null),
      tap((user) => {
        this.cachedUser = user;
      })
    );
  }

  clear(): void {
    this.cachedUser = null;
  }
}
