import { NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService, extractErrorMessage } from '../services/api.service';
import { UserDto } from '../models';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html'
})
export class SignupComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phoneNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^\d{10}$/)]
    }),
    userName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)]
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)]
    })
  });

  loading = false;
  error = '';

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.invalid;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    const values = this.form.getRawValue();
    const payload = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phoneNumber: values.phoneNumber.trim(),
      userName: values.userName.trim(),
      password: values.password
    };

    this.api.create<UserDto>('/api/users', payload).subscribe({
      next: () => this.router.navigate(['/login'], { queryParams: { created: 'true' } }),
      error: (error: unknown) => {
        this.error = extractErrorMessage(error);
        this.loading = false;
      }
    });
  }
}
