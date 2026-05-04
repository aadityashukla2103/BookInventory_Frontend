import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, firstValueFrom, forkJoin, map, of } from 'rxjs';

import { BookView, canAdmin, toBookView } from '../book-helper';
import { ApiRecord, AuthorDto, BookAuthorDto, BookDto, BookReviewDto, CategoryDto, InventoryDto, PublisherDto, ReviewerDto, UserDto } from '../models';
import { ApiService, extractErrorMessage } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { CurrentUserService } from '../services/current-user.service';

interface ReviewView extends BookReviewDto {
  reviewerName: string;
}

@Component({
  selector: 'app-book-detail',
  standalone: true,
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, ReactiveFormsModule, RouterLink],
  templateUrl: './book-detail.component.html'
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
