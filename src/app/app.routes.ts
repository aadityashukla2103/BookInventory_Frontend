import { Routes } from '@angular/router';

import { adminGuard } from './admin.guard';
import { authGuard } from './auth.guard';
import { ShellComponent } from './shell/shell.component';
import { BookDetailComponent } from './book-detail/book-detail.component';
import { BookFormComponent } from './book-form/book-form.component';
import { BookListComponent } from './book-list/book-list.component';
import { CartComponent } from './cart/cart.component';
import { CatalogComponent } from './catalog/catalog.component';
import { CrudPageComponent } from './crud/crud-page.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';

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
      { path: 'books/:isbn', component: BookDetailComponent },
      { path: 'manage-books', component: BookListComponent, canActivate: [adminGuard] },
      { path: 'manage-books/new', component: BookFormComponent, canActivate: [adminGuard] },
      { path: 'manage-books/:isbn/edit', component: BookFormComponent, canActivate: [adminGuard] },
      { path: 'catalog', component: CatalogComponent },
      { path: 'cart', component: CartComponent },
      { path: 'manage/:resource', component: CrudPageComponent, canActivate: [adminGuard] }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
