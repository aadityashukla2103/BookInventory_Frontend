import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { ShellComponent } from './layout/shell.component';
import { CartComponent } from './pages/cart/cart.component';
import { CatalogComponent } from './pages/catalog/catalog.component';
import { CrudPageComponent } from './pages/crud/crud-page.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'catalog', component: CatalogComponent },
      { path: 'cart', component: CartComponent },
      { path: 'manage/:resource', component: CrudPageComponent }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
