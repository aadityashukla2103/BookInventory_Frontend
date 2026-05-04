import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { BookView, canAdmin, toBookView } from '../book-helper';
import { ApiRecord, AuthorDto, BookAuthorDto, BookDto, CategoryDto, InventoryDto, PublisherDto } from '../models';
import { ApiService, extractErrorMessage } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-book-list',
  standalone: true,
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, RouterLink],
  templateUrl: './book-list.component.html'
})
export class BookListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly isAdmin$ = this.auth.authState$.pipe(map(canAdmin));

  categories: CategoryDto[] = [];
  books: BookView[] = [];
  filteredBooks: BookView[] = [];
  searchTerm = '';
  categoryFilter = '';
  loading = false;
  error = '';
  message = '';

  ngOnInit(): void {
    this.load();
  }

  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();
    const category = this.categoryFilter;

    this.filteredBooks = this.books.filter((book) => {
      const matchesCategory = !category || String(book.categoryId ?? '') === category;
      const haystack = [book.title, book.isbn, book.categoryName, book.publisherName, book.edition].join(' ').toLowerCase();
      return matchesCategory && (!term || haystack.includes(term));
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.categoryFilter = '';
    this.applyFilters();
  }

  deleteBook(book: BookView): void {
    if (!confirm(`Delete ${book.title}?`)) {
      return;
    }

    this.api.delete('/api/books', encodeURIComponent(book.isbn)).subscribe({
      next: () => {
        this.message = 'Book deleted.';
        this.load();
      },
      error: (error: unknown) => {
        this.error = extractErrorMessage(error);
      }
    });
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      books: this.safeList<BookDto>('/api/books'),
      categories: this.safeList<CategoryDto>('/api/categories'),
      publishers: this.safeList<PublisherDto>('/api/publishers'),
      authors: this.safeList<AuthorDto>('/api/authors'),
      bookAuthors: this.safeList<BookAuthorDto>('/api/book-authors'),
      inventories: this.safeList<InventoryDto>('/api/inventories')
    }).subscribe(({ books, categories, publishers, authors, bookAuthors, inventories }) => {
      this.categories = categories;
      this.books = books.map((book) => toBookView(book, categories, publishers, authors, bookAuthors, inventories));
      this.loading = false;
      this.applyFilters();
    });
  }

  private safeList<T extends ApiRecord>(endpoint: string): Observable<T[]> {
    return this.api.list<T>(endpoint).pipe(catchError(() => of([])));
  }
}
