import { NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService, extractErrorMessage } from '../../core/api.service';
import { UserDto } from '../../data/models';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-screen">
      <div class="auth-panel">
        <div class="mb-4">
          <div class="brand-mark mb-3">
            <i class="bi bi-person-plus"></i>
          </div>
          <h1 class="page-title">Sign Up</h1>
          <p class="page-subtitle">Create a backend user record and continue to login.</p>
        </div>

        <form class="d-grid gap-3" [formGroup]="form" (ngSubmit)="submit()">
          <div class="alert alert-danger" *ngIf="error">{{ error }}</div>

          <div class="row g-3">
            <div class="col-sm-6">
              <label class="form-label" for="firstName">First Name</label>
              <input id="firstName" class="form-control" type="text" formControlName="firstName" />
            </div>
            <div class="col-sm-6">
              <label class="form-label" for="lastName">Last Name</label>
              <input id="lastName" class="form-control" type="text" formControlName="lastName" />
            </div>
          </div>

          <div>
            <label class="form-label" for="phoneNumber">Phone Number</label>
            <input id="phoneNumber" class="form-control" type="tel" formControlName="phoneNumber" />
          </div>

          <div>
            <label class="form-label" for="userName">Username</label>
            <input id="userName" class="form-control" type="text" formControlName="userName" autocomplete="username" />
          </div>

          <div class="row g-3">
            <div class="col-sm-7">
              <label class="form-label" for="signupPassword">Password</label>
              <input
                id="signupPassword"
                class="form-control"
                type="password"
                formControlName="password"
                autocomplete="new-password"
              />
            </div>
            <div class="col-sm-5">
              <label class="form-label" for="roleNumber">Role Number</label>
              <input id="roleNumber" class="form-control" type="number" formControlName="roleNumber" />
            </div>
          </div>

          <button class="btn btn-primary w-100" type="submit" [disabled]="loading || form.invalid">
            <i class="bi" [class.bi-arrow-repeat]="loading" [class.bi-person-check]="!loading"></i>
            <span>{{ loading ? 'Creating account' : 'Create account' }}</span>
          </button>

          <div class="text-center text-muted">
            Already registered?
            <a routerLink="/login" class="fw-semibold">Back to login</a>
          </div>
        </form>
      </div>

      <div class="auth-art">
        <div class="auth-copy">
          <h1>Start with a user, then build the library.</h1>
          <p>Signup writes directly to the Spring Boot user API, including the permission role number required by login.</p>
        </div>
      </div>
    </section>
  `
})
export class SignupComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phoneNumber: new FormControl('', { nonNullable: true }),
    userName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    roleNumber: new FormControl(2, { nonNullable: true, validators: [Validators.required, Validators.min(1)] })
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
    const payload = this.form.getRawValue();

    this.api.create<UserDto>('/api/users', payload).subscribe({
      next: () => this.router.navigate(['/login'], { queryParams: { created: 'true' } }),
      error: (error: unknown) => {
        this.error = extractErrorMessage(error);
        this.loading = false;
      }
    });
  }
}
