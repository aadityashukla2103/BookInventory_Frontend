import { NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { extractErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-screen">
      <div class="auth-panel">
        <div class="mb-4">
          <div class="brand-mark mb-3">
            <i class="bi bi-bookshelf"></i>
          </div>
          <h1 class="page-title">Login</h1>
          <p class="page-subtitle">Access inventory, catalog, cart, and table management.</p>
        </div>

        <form class="d-grid gap-3" [formGroup]="form" (ngSubmit)="submit()">
          <div class="alert alert-danger" *ngIf="error">{{ error }}</div>

          <div>
            <label class="form-label" for="username">Username</label>
            <input id="username" class="form-control" type="text" formControlName="username" autocomplete="username" />
          </div>

          <div>
            <label class="form-label" for="password">Password</label>
            <input
              id="password"
              class="form-control"
              type="password"
              formControlName="password"
              autocomplete="current-password"
            />
          </div>

          <button class="btn btn-primary w-100" type="submit" [disabled]="loading || form.invalid">
            <i class="bi" [class.bi-arrow-repeat]="loading" [class.bi-box-arrow-in-right]="!loading"></i>
            <span>{{ loading ? 'Signing in' : 'Sign in' }}</span>
          </button>

          <div class="text-center text-muted">
            New user?
            <a routerLink="/signup" class="fw-semibold">Create an account</a>
          </div>
        </form>
      </div>

      <div class="auth-art">
        <div class="auth-copy">
          <h1>Inventory that follows every book.</h1>
          <p>Manage books, authors, publishers, reviewers, carts, purchase logs, and stock copies from one Angular workspace.</p>
        </div>
      </div>
    </section>
  `
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  loading = false;
  error = '';

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    const { username, password } = this.form.getRawValue();

    this.auth.login(username, password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (error: unknown) => {
        this.error = extractErrorMessage(error);
        this.loading = false;
      }
    });
  }
}
