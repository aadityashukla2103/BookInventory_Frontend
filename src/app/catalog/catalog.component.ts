import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, firstValueFrom, forkJoin, of } from 'rxjs';

import { ApiService, extractErrorMessage } from '../services/api.service';
import { CurrentUserService } from '../services/current-user.service';
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
} from '../models';

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
  templateUrl: './catalog.component.html'
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
