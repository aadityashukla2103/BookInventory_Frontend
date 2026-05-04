import { AsyncPipe, CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import {
  ApiRecord,
  BookConditionDto,
  BookDto,
  InventoryDto,
  ShoppingCartDto,
  UserDto
} from '../models';

interface DashboardStat {
  label: string;
  value: number;
  icon: string;
  tone: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, NgFor, NgIf, RouterLink],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly isAdmin$ = this.auth.authState$.pipe(
    map((state) => state.roles.some((role) => role.toUpperCase().includes('ADMIN')))
  );

  stats: DashboardStat[] = [];
  recentBooks: BookDto[] = [];
  availableCopies = 0;
  totalCopies = 0;
  availabilityPercent = 0;
  estimatedAvailableValue = 0;
  error = '';

  ngOnInit(): void {
    forkJoin({
      books: this.safeList<BookDto>('/api/books'),
      users: this.safeList<UserDto>('/api/users'),
      inventories: this.safeList<InventoryDto>('/api/inventories'),
      carts: this.safeList<ShoppingCartDto>('/api/shopping-carts'),
      conditions: this.safeList<BookConditionDto>('/api/book-conditions')
    }).subscribe({
      next: ({ books, users, inventories, carts, conditions }) => {
        this.recentBooks = [...books].slice(-6).reverse();
        this.totalCopies = inventories.length;
        this.availableCopies = inventories.filter((copy) => !copy.purchased).length;
        this.availabilityPercent = this.totalCopies ? Math.round((this.availableCopies / this.totalCopies) * 100) : 0;
        this.estimatedAvailableValue = inventories
          .filter((copy) => !copy.purchased)
          .reduce((total, copy) => total + (conditions.find((condition) => condition.ranks === copy.ranks)?.price ?? 0), 0);
        this.stats = [
          { label: 'Books', value: books.length, icon: 'bi-book', tone: 'tone-primary' },
          { label: 'Users', value: users.length, icon: 'bi-people', tone: 'tone-coral' },
          { label: 'Cart Rows', value: carts.length, icon: 'bi-cart', tone: 'tone-gold' },
          { label: 'Available Copies', value: this.availableCopies, icon: 'bi-box-seam', tone: 'tone-neutral' }
        ];
      },
      error: () => {
        this.error = 'Unable to load dashboard data.';
      }
    });
  }

  private safeList<T extends ApiRecord>(endpoint: string): Observable<T[]> {
    return this.api.list<T>(endpoint).pipe(catchError(() => of([])));
  }
}
