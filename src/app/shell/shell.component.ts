import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { CurrentUserService } from '../services/current-user.service';
import { MANAGED_RESOURCE_KEYS, RESOURCE_CONFIGS } from '../resource-config';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [AsyncPipe, NgFor, NgIf, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html'
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly router = inject(Router);

  readonly authState$ = this.auth.authState$;
  readonly isAdmin$ = this.auth.authState$.pipe(
    map((state) => state.roles.some((role) => role.toUpperCase().includes('ADMIN')))
  );
  readonly adminResources = RESOURCE_CONFIGS.filter((resource) => MANAGED_RESOURCE_KEYS.includes(resource.key));

  logout(): void {
    this.currentUser.clear();
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
