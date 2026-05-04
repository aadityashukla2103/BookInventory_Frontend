import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';

import { AuthService } from './services/auth.service';

function isAdminRole(role: string): boolean {
  return role.toUpperCase().includes('ADMIN');
}

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.authState$.pipe(
    take(1),
    map((state) => (state.roles.some(isAdminRole) ? true : router.createUrlTree(['/catalog'])))
  );
};
