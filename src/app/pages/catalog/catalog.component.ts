import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, firstValueFrom, forkJoin, of } from 'rxjs';

import { ApiService, extractErrorMessage } from '../../core/api.service';
import { CurrentUserService } from '../../core/current-user.service';
import {
  ApiRecord,
  AuthorDto,
  BookAuthorDto,
  BookConditionDto,
  BookDto,
  CategoryDto,
  InventoryDto,
  PublisherDto,
  ShoppingCartDto
} from '../../data/models';

interface CatalogBook {
  isbn: string;
  title: string;
  description: string | null;
  edition: string | null;
  categoryId: number | null;
  publisherId: number | null;
  categoryName: string;
  publisherName: string;
  authorNames: string[];
  availableCopies: number;
  priceLabel: string;
}

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, NgFor, NgIf, RouterLink],
  template: `
    <section class="page-wrap">
      <div class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h1 class="page-title">Catalog</h1>
          <p class="page-subtitle">Browse books, stock availability, and author details.</p>
        </div>
      </div>

      <div class="surface p-3 mb-3">
        <div class="row g-3 align-items-end">
          <div class="col-lg-6">
            <label class="form-label" for="search">Search</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input
                id="search"
                class="form-control"
                type="search"
                [(ngModel)]="searchTerm"
                (ngModelChange)="applyFilters()"
                placeholder="Title, ISBN, author, publisher"
              />
            </div>
          </div>
          <div class="col-lg-4">
            <label class="form-label" for="category">Category</label>
            <select id="category" class="form-select" [(ngModel)]="categoryFilter" (ngModelChange)="applyFilters()">
              <option value="">All categories</option>
              <option *ngFor="let category of categories" [value]="category.catId">{{ category.categoryName }}</option>
            </select>
          </div>
          <div class="col-lg-2 d-grid">
            <button class="btn btn-outline-secondary" type="button" (click)="clearFilters()">
              <i class="bi bi-x-circle"></i>
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>

      <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
      <div class="alert alert-success" *ngIf="message">{{ message }}</div>

      <div class="catalog-grid" *ngIf="filteredBooks.length; else emptyCatalog">
        <article class="surface book-card" *ngFor="let book of filteredBooks">
          <div class="book-cover">
            <div class="small opacity-75">{{ book.isbn }}</div>
            <div class="book-title mt-2">{{ book.title }}</div>
          </div>
          <div class="p-3 d-flex flex-column gap-3 flex-grow-1">
            <div>
              <div class="text-muted small">Authors</div>
              <div class="fw-semibold">{{ book.authorNames.length ? book.authorNames.join(', ') : 'Unassigned' }}</div>
            </div>
            <div class="row g-2 small">
              <div class="col-6">
                <div class="text-muted">Category</div>
                <div class="fw-semibold">{{ book.categoryName || '-' }}</div>
              </div>
              <div class="col-6">
                <div class="text-muted">Publisher</div>
                <div class="fw-semibold">{{ book.publisherName || '-' }}</div>
              </div>
            </div>
            <p class="text-muted small mb-0 flex-grow-1">{{ book.description || 'No description available.' }}</p>
            <div class="d-flex align-items-center justify-content-between gap-3 border-top pt-3">
              <div>
                <div class="fw-bold">{{ book.priceLabel }}</div>
                <div class="small" [class.text-success]="book.availableCopies" [class.text-danger]="!book.availableCopies">
                  {{ book.availableCopies }} available
                </div>
              </div>
              <div class="d-flex gap-2">
                <a class="btn btn-outline-primary" [routerLink]="['/books', book.isbn]">
                  <i class="bi bi-eye"></i>
                  <span>Details</span>
                </a>
                <button class="btn btn-primary" type="button" [disabled]="!book.availableCopies || savingIsbn === book.isbn" (click)="addToCart(book)">
                  <i class="bi" [class.bi-arrow-repeat]="savingIsbn === book.isbn" [class.bi-cart-plus]="savingIsbn !== book.isbn"></i>
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <ng-template #emptyCatalog>
        <div class="empty-state">No catalog books match the current filters.</div>
      </ng-template>
    </section>
  `
})
export class CatalogComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly currentUser = inject(CurrentUserService);

  categories: CategoryDto[] = [];
  books: CatalogBook[] = [];
  filteredBooks: CatalogBook[] = [];
  searchTerm = '';
  categoryFilter = '';
  error = '';
  message = '';
  savingIsbn = '';

  ngOnInit(): void {
    forkJoin({
      books: this.safeList<BookDto>('/api/books'),
      categories: this.safeList<CategoryDto>('/api/categories'),
      publishers: this.safeList<PublisherDto>('/api/publishers'),
      authors: this.safeList<AuthorDto>('/api/authors'),
      bookAuthors: this.safeList<BookAuthorDto>('/api/book-authors'),
      inventories: this.safeList<InventoryDto>('/api/inventories'),
      conditions: this.safeList<BookConditionDto>('/api/book-conditions')
    }).subscribe(({ books, categories, publishers, authors, bookAuthors, inventories, conditions }) => {
      this.categories = categories;
      this.books = books.map((book) =>
        this.toCatalogBook(book, categories, publishers, authors, bookAuthors, inventories, conditions)
      );
      this.applyFilters();
    });
  }

  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();
    const category = this.categoryFilter;

    this.filteredBooks = this.books.filter((book) => {
      const matchesCategory = !category || String(book.categoryId ?? '') === category;
      const haystack = [
        book.title,
        book.isbn,
        book.publisherName,
        book.categoryName,
        book.authorNames.join(' ')
      ]
        .join(' ')
        .toLowerCase();

      return matchesCategory && (!term || haystack.includes(term));
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.categoryFilter = '';
    this.applyFilters();
  }

  async addToCart(book: CatalogBook): Promise<void> {
    this.error = '';
    this.message = '';
    this.savingIsbn = book.isbn;

    try {
      const user = await firstValueFrom(this.currentUser.loadCurrentUser());
      if (!user?.userID) {
        throw new Error('Unable to find the signed-in user record.');
      }

      await firstValueFrom(
        this.api.create<ShoppingCartDto>('/api/shopping-carts', {
          userID: user.userID,
          isbn: book.isbn
        })
      );
      this.message = `${book.title} added to cart.`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : extractErrorMessage(error);
    } finally {
      this.savingIsbn = '';
    }
  }

  private toCatalogBook(
    book: BookDto,
    categories: CategoryDto[],
    publishers: PublisherDto[],
    authors: AuthorDto[],
    bookAuthors: BookAuthorDto[],
    inventories: InventoryDto[],
    conditions: BookConditionDto[]
  ): CatalogBook {
    const authorNames = bookAuthors
      .filter((link) => link.isbn === book.isbn)
      .map((link) => authors.find((author) => author.authorID === link.authorID))
      .filter((author): author is AuthorDto => Boolean(author))
      .map((author) => `${author.firstName} ${author.lastName}`.trim());

    const copies = inventories.filter((copy) => copy.isbn === book.isbn && !copy.purchased);
    const prices = copies
      .map((copy) => conditions.find((condition) => condition.ranks === copy.ranks)?.price ?? null)
      .filter((price): price is number => typeof price === 'number');

    return {
      ...book,
      categoryName: categories.find((category) => category.catId === book.categoryId)?.categoryName ?? '',
      publisherName: publishers.find((publisher) => publisher.publisherId === book.publisherId)?.name ?? '',
      authorNames,
      availableCopies: copies.length,
      priceLabel: this.priceLabel(prices)
    };
  }

  private priceLabel(prices: number[]): string {
    if (!prices.length) {
      return 'No price';
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} - $${max.toFixed(2)}`;
  }

  private safeList<T extends ApiRecord>(endpoint: string): Observable<T[]> {
    return this.api.list<T>(endpoint).pipe(catchError(() => of([])));
  }
}
