import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';

import { ApiService, buildIdPath, extractErrorMessage } from '../../core/api.service';
import { AuthService, AuthState } from '../../core/auth.service';
import { CurrentUserService } from '../../core/current-user.service';
import {
  ApiRecord,
  AuthorDto,
  BookAuthorDto,
  BookDto,
  BookReviewDto,
  CategoryDto,
  InventoryDto,
  PublisherDto,
  ReviewerDto,
  UserDto
} from '../../data/models';

interface BookView {
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
}

interface ReviewView extends BookReviewDto {
  reviewerName: string;
}

type BookFormGroup = FormGroup<{
  isbn: FormControl<string>;
  title: FormControl<string>;
  description: FormControl<string>;
  edition: FormControl<string>;
  categoryId: FormControl<number | null>;
  publisherId: FormControl<number | null>;
}>;

function authorName(author: AuthorDto): string {
  return `${author.firstName} ${author.lastName}`.trim() || String(author.authorID ?? '');
}

function canAdmin(state: AuthState | null): boolean {
  return Boolean(state?.roles.some((role) => role.toUpperCase().includes('ADMIN')));
}

function toNumberArray(values: unknown): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
}

@Component({
  selector: 'app-book-list',
  standalone: true,
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, RouterLink],
  template: `
    <section class="page-wrap">
      <div class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h1 class="page-title">Manage Books</h1>
          <p class="page-subtitle">Create titles and connect them to categories, publishers, authors, and stock.</p>
        </div>
        <a class="btn btn-primary" routerLink="/manage-books/new" *ngIf="isAdmin$ | async">
          <i class="bi bi-plus-circle"></i>
          <span>Add Book</span>
        </a>
      </div>

      <div class="surface p-3 mb-3">
        <div class="row g-3 align-items-end">
          <div class="col-lg-6">
            <label class="form-label" for="bookSearch">Search</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input
                id="bookSearch"
                class="form-control"
                type="search"
                [(ngModel)]="searchTerm"
                (ngModelChange)="applyFilters()"
                placeholder="Title, ISBN, category, publisher"
              />
            </div>
          </div>
          <div class="col-lg-4">
            <label class="form-label" for="bookCategory">Category</label>
            <select id="bookCategory" class="form-select" [(ngModel)]="categoryFilter" (ngModelChange)="applyFilters()">
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

      <div class="surface p-3">
        <div class="table-responsive" *ngIf="filteredBooks.length; else emptyBooks">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Publisher</th>
                <th>Edition</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let book of filteredBooks">
                <td>
                  <div class="fw-semibold">{{ book.title }}</div>
                  <div class="text-muted small">{{ book.isbn }}</div>
                </td>
                <td>{{ book.categoryName || '-' }}</td>
                <td>{{ book.publisherName || '-' }}</td>
                <td>{{ book.edition || '-' }}</td>
                <td class="text-end">
                  <div class="btn-group btn-group-sm">
                    <a class="btn btn-outline-primary" [routerLink]="['/books', book.isbn]" title="View details">
                      <i class="bi bi-eye"></i>
                    </a>
                    <ng-container *ngIf="isAdmin$ | async">
                      <a class="btn btn-outline-secondary" [routerLink]="['/manage-books', book.isbn, 'edit']" title="Edit">
                        <i class="bi bi-pencil"></i>
                      </a>
                      <button class="btn btn-outline-danger" type="button" (click)="deleteBook(book)" title="Delete">
                        <i class="bi bi-trash"></i>
                      </button>
                    </ng-container>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #emptyBooks>
          <div class="empty-state">{{ loading ? 'Loading books...' : 'No books found.' }}</div>
        </ng-template>
      </div>
    </section>
  `
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

@Component({
  selector: 'app-book-detail',
  standalone: true,
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-wrap">
      <div class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h1 class="page-title">{{ book?.title || 'Book Detail' }}</h1>
          <p class="page-subtitle">{{ book?.isbn || 'Loading selected book.' }}</p>
        </div>
        <div class="d-flex gap-2">
          <a class="btn btn-outline-secondary" routerLink="/catalog">
            <i class="bi bi-arrow-left"></i>
            <span>Catalog</span>
          </a>
          <a class="btn btn-primary" [routerLink]="['/manage-books', book.isbn, 'edit']" *ngIf="book && (isAdmin$ | async)">
            <i class="bi bi-pencil"></i>
            <span>Edit</span>
          </a>
        </div>
      </div>

      <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
      <div class="alert alert-success" *ngIf="message">{{ message }}</div>

      <ng-container *ngIf="book; else loadingDetail">
        <div class="book-detail-grid">
          <article class="surface p-3">
            <div class="d-flex align-items-start justify-content-between gap-3 border-bottom pb-3 mb-3">
              <div>
                <div class="text-muted small">Inventory status</div>
                <div class="h4 mb-0" [class.text-success]="book.availableCopies" [class.text-danger]="!book.availableCopies">
                  {{ book.availableCopies ? 'Available' : 'Out of Stock' }}
                </div>
              </div>
              <span class="badge text-bg-light">{{ book.availableCopies }} copies</span>
            </div>

            <dl class="book-meta">
              <div>
                <dt>Description</dt>
                <dd>{{ book.description || 'No description available.' }}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{{ book.categoryName || '-' }}</dd>
              </div>
              <div>
                <dt>Publisher</dt>
                <dd>{{ book.publisherName || '-' }}</dd>
              </div>
              <div>
                <dt>Authors</dt>
                <dd>{{ book.authorNames.length ? book.authorNames.join(', ') : 'Unassigned' }}</dd>
              </div>
              <div>
                <dt>Edition</dt>
                <dd>{{ book.edition || '-' }}</dd>
              </div>
            </dl>
          </article>

          <aside class="surface p-3">
            <h2 class="h5 mb-3">Reviews</h2>
            <div class="d-grid gap-2 mb-4" *ngIf="reviews.length; else noReviews">
              <div class="review-row" *ngFor="let review of reviews">
                <div class="d-flex justify-content-between gap-3">
                  <strong>{{ review.reviewerName }}</strong>
                  <span class="text-warning">{{ stars(review.rating) }}</span>
                </div>
                <p class="mb-0 text-muted small">{{ review.comments || 'No comment.' }}</p>
              </div>
            </div>
            <ng-template #noReviews>
              <div class="empty-state mb-4">No reviews added yet.</div>
            </ng-template>

            <form class="d-grid gap-3" [formGroup]="reviewForm" (ngSubmit)="addReview()">
              <div class="small text-muted">Reviewing as {{ currentReviewerName || 'your account' }}</div>
              <div>
                <label class="form-label" for="rating">Rating</label>
                <input id="rating" class="form-control" type="number" min="1" max="5" formControlName="rating" />
              </div>
              <div>
                <label class="form-label" for="comments">Comment</label>
                <textarea id="comments" class="form-control" rows="3" maxlength="255" formControlName="comments"></textarea>
              </div>
              <button class="btn btn-primary" type="submit" [disabled]="reviewForm.invalid || savingReview">
                <i class="bi" [class.bi-arrow-repeat]="savingReview" [class.bi-star]="!savingReview"></i>
                <span>{{ savingReview ? 'Saving' : 'Add Review' }}</span>
              </button>
            </form>
          </aside>
        </div>
      </ng-container>

      <ng-template #loadingDetail>
        <div class="empty-state">{{ loading ? 'Loading book detail...' : 'Book not found.' }}</div>
      </ng-template>
    </section>
  `
})
export class BookDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly route = inject(ActivatedRoute);

  readonly isAdmin$ = this.auth.authState$.pipe(map(canAdmin));
  readonly reviewForm = new FormGroup({
    rating: new FormControl<number | null>(5, [Validators.required, Validators.min(1), Validators.max(5)]),
    comments: new FormControl<string>('', { nonNullable: true })
  });

  book: BookView | null = null;
  reviews: ReviewView[] = [];
  reviewers: ReviewerDto[] = [];
  loading = false;
  savingReview = false;
  error = '';
  message = '';
  currentReviewerName = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const isbn = params.get('isbn');
      if (isbn) {
        this.load(isbn);
      }
    });
  }

  async addReview(): Promise<void> {
    if (!this.book || this.reviewForm.invalid) {
      this.reviewForm.markAllAsTouched();
      return;
    }

    this.savingReview = true;
    this.error = '';
    this.message = '';

    try {
      const user = await firstValueFrom(this.currentUser.loadCurrentUser());
      const reviewer = await this.ensureReviewer(user);
      const payload: Partial<BookReviewDto> = {
        isbn: this.book.isbn,
        reviewerId: reviewer.reviewerId,
        rating: this.reviewForm.controls.rating.value,
        comments: this.reviewForm.controls.comments.value || null
      };

      await firstValueFrom(this.api.create<BookReviewDto>('/api/book-reviews', payload));
      this.message = 'Review added.';
      this.reviewForm.reset({ rating: 5, comments: '' });
      this.load(this.book.isbn);
    } catch (error) {
      this.error = error instanceof Error ? error.message : extractErrorMessage(error);
    } finally {
      this.savingReview = false;
    }
  }

  stars(rating: number | null): string {
    const value = Math.max(0, Math.min(5, Number(rating ?? 0)));
    return '★★★★★'.slice(0, value) || '-';
  }

  private load(isbn: string): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      books: this.safeList<BookDto>('/api/books'),
      categories: this.safeList<CategoryDto>('/api/categories'),
      publishers: this.safeList<PublisherDto>('/api/publishers'),
      authors: this.safeList<AuthorDto>('/api/authors'),
      bookAuthors: this.safeList<BookAuthorDto>('/api/book-authors'),
      inventories: this.safeList<InventoryDto>('/api/inventories'),
      reviews: this.safeList<BookReviewDto>('/api/book-reviews'),
      reviewers: this.safeList<ReviewerDto>('/api/reviewers')
    }).subscribe(({ books, categories, publishers, authors, bookAuthors, inventories, reviews, reviewers }) => {
      const book = books.find((item) => item.isbn === isbn) ?? null;
      this.book = book ? toBookView(book, categories, publishers, authors, bookAuthors, inventories) : null;
      this.reviewers = reviewers;
      this.reviews = reviews
        .filter((review) => review.isbn === isbn)
        .map((review) => ({
          ...review,
          reviewerName: reviewers.find((reviewer) => reviewer.reviewerId === review.reviewerId)?.name ?? String(review.reviewerId ?? '-')
        }));
      this.loading = false;
      this.currentUser.loadCurrentUser().subscribe((user) => {
        this.currentReviewerName = user ? this.userDisplayName(user) : '';
      });
    });
  }

  private async ensureReviewer(user: UserDto | null): Promise<ReviewerDto> {
    if (!user?.userID) {
      throw new Error('Unable to find the signed-in user record.');
    }

    const existing = this.reviewers.find((reviewer) => reviewer.reviewerId === user.userID);
    if (existing) {
      return existing;
    }

    const created = await firstValueFrom(
      this.api.create<ReviewerDto>('/api/reviewers', {
        reviewerId: user.userID,
        name: this.userDisplayName(user),
        employedBy: null
      })
    );
    this.reviewers = [...this.reviewers, created];
    return created;
  }

  private userDisplayName(user: UserDto): string {
    return `${user.firstName} ${user.lastName}`.trim() || user.userName;
  }

  private safeList<T extends ApiRecord>(endpoint: string): Observable<T[]> {
    return this.api.list<T>(endpoint).pipe(catchError(() => of([])));
  }
}

@Component({
  selector: 'app-book-form',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-wrap">
      <div class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h1 class="page-title">{{ editing ? 'Edit Book' : 'Add Book' }}</h1>
          <p class="page-subtitle">Connect title details with category, publisher, and authors.</p>
        </div>
        <a class="btn btn-outline-secondary" routerLink="/manage-books">
          <i class="bi bi-arrow-left"></i>
          <span>Manage Books</span>
        </a>
      </div>

      <div class="alert alert-danger" *ngIf="error">{{ error }}</div>

      <form class="surface p-3 book-form" [formGroup]="form" (ngSubmit)="save()">
        <div>
          <label class="form-label" for="title">Title</label>
          <input id="title" class="form-control" type="text" maxlength="70" formControlName="title" />
        </div>
        <div>
          <label class="form-label" for="isbn">ISBN</label>
          <input id="isbn" class="form-control" type="text" maxlength="13" formControlName="isbn" />
        </div>
        <div class="book-form-wide">
          <label class="form-label" for="description">Description</label>
          <textarea id="description" class="form-control" rows="4" maxlength="100" formControlName="description"></textarea>
        </div>
        <div>
          <label class="form-label" for="edition">Edition</label>
          <input id="edition" class="form-control" type="text" maxlength="30" formControlName="edition" />
        </div>
        <div>
          <label class="form-label" for="categoryId">Category</label>
          <select id="categoryId" class="form-select" formControlName="categoryId">
            <option [ngValue]="null">Select category</option>
            <option *ngFor="let category of categories" [ngValue]="category.catId">{{ category.categoryName }}</option>
          </select>
        </div>
        <div>
          <label class="form-label" for="publisherId">Publisher</label>
          <select id="publisherId" class="form-select" formControlName="publisherId">
            <option [ngValue]="null">Select publisher</option>
            <option *ngFor="let publisher of publishers" [ngValue]="publisher.publisherId">{{ publisher.name }}</option>
          </select>
        </div>
        <div class="book-form-wide">
          <label class="form-label" for="authors">Authors</label>
          <select id="authors" class="form-select author-select" multiple [(ngModel)]="selectedAuthorIds" [ngModelOptions]="{ standalone: true }">
            <option *ngFor="let author of authors" [ngValue]="author.authorID">{{ authorName(author) }}</option>
          </select>
        </div>

        <div class="book-form-wide d-flex justify-content-end gap-2 border-top pt-3">
          <a class="btn btn-outline-secondary" routerLink="/manage-books">Cancel</a>
          <button class="btn btn-primary" type="submit" [disabled]="form.invalid || saving">
            <i class="bi" [class.bi-arrow-repeat]="saving" [class.bi-save]="!saving"></i>
            <span>{{ saving ? 'Saving' : 'Save Book' }}</span>
          </button>
        </div>
      </form>
    </section>
  `
})
export class BookFormComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly form: BookFormGroup = new FormGroup({
    isbn: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(13)] }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(70)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    edition: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(30)] }),
    categoryId: new FormControl<number | null>(null),
    publisherId: new FormControl<number | null>(null, Validators.required)
  });

  categories: CategoryDto[] = [];
  publishers: PublisherDto[] = [];
  authors: AuthorDto[] = [];
  selectedAuthorIds: number[] = [];
  originalAuthorIds: number[] = [];
  editing = false;
  saving = false;
  error = '';

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const isbn = params.get('isbn');
          this.editing = Boolean(isbn);
          return forkJoin({
            books: this.safeList<BookDto>('/api/books'),
            categories: this.safeList<CategoryDto>('/api/categories'),
            publishers: this.safeList<PublisherDto>('/api/publishers'),
            authors: this.safeList<AuthorDto>('/api/authors'),
            bookAuthors: this.safeList<BookAuthorDto>('/api/book-authors')
          }).pipe(map((data) => ({ ...data, isbn })));
        })
      )
      .subscribe(({ books, categories, publishers, authors, bookAuthors, isbn }) => {
        this.categories = categories;
        this.publishers = publishers;
        this.authors = authors;

        if (!isbn) {
          this.form.reset({ isbn: '', title: '', description: '', edition: '', categoryId: null, publisherId: null });
          this.form.controls.isbn.enable({ emitEvent: false });
          return;
        }

        const book = books.find((item) => item.isbn === isbn);
        if (!book) {
          this.error = 'Book not found.';
          return;
        }

        this.form.reset({
          isbn: book.isbn,
          title: book.title,
          description: book.description ?? '',
          edition: book.edition ?? '',
          categoryId: book.categoryId,
          publisherId: book.publisherId
        });
        this.form.controls.isbn.disable({ emitEvent: false });
        this.originalAuthorIds = bookAuthors.filter((link) => link.isbn === isbn).map((link) => Number(link.authorID));
        this.selectedAuthorIds = [...this.originalAuthorIds];
      });
  }

  authorName(author: AuthorDto): string {
    return authorName(author);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: BookDto = {
      isbn: raw.isbn,
      title: raw.title,
      description: raw.description || null,
      edition: raw.edition || null,
      categoryId: raw.categoryId,
      publisherId: raw.publisherId
    };

    this.saving = true;
    this.error = '';
    const request = this.editing
      ? this.api.update<BookDto>('/api/books', encodeURIComponent(payload.isbn), payload)
      : this.api.create<BookDto>('/api/books', payload);

    request
      .pipe(switchMap(() => this.syncAuthors(payload.isbn)))
      .subscribe({
        next: () => {
          this.saving = false;
          this.router.navigate(['/books', payload.isbn]);
        },
        error: (error: unknown) => {
          this.error = extractErrorMessage(error);
          this.saving = false;
        }
      });
  }

  private syncAuthors(isbn: string): Observable<unknown> {
    const selected = toNumberArray(this.selectedAuthorIds);
    const selectedSet = new Set(selected);
    const originalSet = new Set(this.originalAuthorIds);
    const creates = selected
      .filter((authorID) => !originalSet.has(authorID))
      .map((authorID, index) =>
        this.api.create<BookAuthorDto>('/api/book-authors', {
          isbn,
          authorID,
          primaryAuthor: index === 0 ? 'Y' : null
        })
      );
    const deletes = this.originalAuthorIds
      .filter((authorID) => !selectedSet.has(authorID))
      .map((authorID) => this.api.delete('/api/book-authors', buildIdPath({ isbn, authorID }, ['isbn', 'authorID'])));

    return creates.length || deletes.length ? forkJoin([...creates, ...deletes]) : of(null);
  }

  private safeList<T extends ApiRecord>(endpoint: string): Observable<T[]> {
    return this.api.list<T>(endpoint).pipe(catchError(() => of([])));
  }
}

function toBookView(
  book: BookDto,
  categories: CategoryDto[],
  publishers: PublisherDto[],
  authors: AuthorDto[],
  bookAuthors: BookAuthorDto[],
  inventories: InventoryDto[]
): BookView {
  const authorNames = bookAuthors
    .filter((link) => link.isbn === book.isbn)
    .map((link) => authors.find((author) => author.authorID === link.authorID))
    .filter((author): author is AuthorDto => Boolean(author))
    .map(authorName);

  return {
    ...book,
    categoryName: categories.find((category) => category.catId === book.categoryId)?.categoryName ?? '',
    publisherName: publishers.find((publisher) => publisher.publisherId === book.publisherId)?.name ?? '',
    authorNames,
    availableCopies: inventories.filter((copy) => copy.isbn === book.isbn && !copy.purchased).length
  };
}
