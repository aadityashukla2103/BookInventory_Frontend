import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api.service';
import {
  ApiRecord,
  BookConditionDto,
  BookDto,
  InventoryDto,
  PurchaseLogDto,
  ShoppingCartDto,
  UserDto
} from '../../data/models';
import { RESOURCE_CONFIGS } from '../../data/resource-config';

interface DashboardStat {
  label: string;
  value: number;
  icon: string;
  tone: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CurrencyPipe, NgFor, NgIf, RouterLink],
  template: `
    <section class="page-wrap">
      <div class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Live overview of the backend inventory tables.</p>
        </div>
        <a class="btn btn-primary" routerLink="/catalog">
          <i class="bi bi-journal-richtext"></i>
          <span>Open Catalog</span>
        </a>
      </div>

      <div class="alert alert-danger" *ngIf="error">{{ error }}</div>

      <div class="row g-3 mb-4">
        <div class="col-md-6 col-xl-3" *ngFor="let stat of stats">
          <div class="surface stat-card d-flex justify-content-between gap-3">
            <div>
              <div class="text-muted small fw-semibold">{{ stat.label }}</div>
              <div class="display-6 fw-bold">{{ stat.value }}</div>
            </div>
            <div class="stat-icon {{ stat.tone }}">
              <i class="bi {{ stat.icon }}"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-xl-7">
          <div class="surface p-3 h-100">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h2 class="h5 mb-0">Recent Books</h2>
              <a class="btn btn-sm btn-outline-primary" routerLink="/manage/books">
                <i class="bi bi-pencil-square"></i>
                <span>Manage</span>
              </a>
            </div>
            <div class="table-responsive" *ngIf="recentBooks.length; else noBooks">
              <table class="table align-middle">
                <thead>
                  <tr>
                    <th>ISBN</th>
                    <th>Title</th>
                    <th>Edition</th>
                    <th>Publisher</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let book of recentBooks">
                    <td class="fw-semibold">{{ book.isbn }}</td>
                    <td>{{ book.title }}</td>
                    <td>{{ book.edition || '-' }}</td>
                    <td>{{ book.publisherId || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ng-template #noBooks>
              <div class="empty-state">No books found.</div>
            </ng-template>
          </div>
        </div>

        <div class="col-xl-5">
          <div class="surface p-3 h-100">
            <h2 class="h5 mb-3">Inventory Snapshot</h2>
            <div class="d-grid gap-3">
              <div>
                <div class="d-flex justify-content-between small mb-1">
                  <span>Available copies</span>
                  <span class="fw-semibold">{{ availableCopies }} / {{ totalCopies }}</span>
                </div>
                <div class="progress" style="height: 10px">
                  <div class="progress-bar bg-success" [style.width.%]="availabilityPercent"></div>
                </div>
              </div>
              <div class="d-flex justify-content-between border-top pt-3">
                <span class="text-muted">Estimated unsold value</span>
                <span class="fw-bold">{{ estimatedAvailableValue | currency }}</span>
              </div>
              <a class="btn btn-outline-primary" routerLink="/manage/inventories">
                <i class="bi bi-box-seam"></i>
                <span>Manage Inventory</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="surface p-3 mt-3">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h2 class="h5 mb-0">Backend Tables</h2>
          <span class="badge text-bg-light">{{ resources.length }} modules</span>
        </div>
        <div class="row g-3">
          <div class="col-sm-6 col-xl-3" *ngFor="let resource of resources">
            <a class="surface d-flex align-items-center gap-3 p-3 text-decoration-none h-100" [routerLink]="['/manage', resource.key]">
              <div class="stat-icon tone-neutral">
                <i class="bi {{ resource.icon }}"></i>
              </div>
              <div>
                <div class="fw-semibold">{{ resource.title }}</div>
                <div class="text-muted small">{{ resource.endpoint }}</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </section>
  `
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly resources = RESOURCE_CONFIGS;
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
      purchases: this.safeList<PurchaseLogDto>('/api/purchase-logs'),
      conditions: this.safeList<BookConditionDto>('/api/book-conditions')
    }).subscribe({
      next: ({ books, users, inventories, carts, purchases, conditions }) => {
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
          { label: 'Purchases', value: purchases.length, icon: 'bi-receipt', tone: 'tone-neutral' }
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
