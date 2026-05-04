import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { authorName, toNumberArray } from '../book-helper';
import { ApiRecord, AuthorDto, BookAuthorDto, BookDto, CategoryDto, PublisherDto } from '../models';
import { ApiService, buildIdPath, extractErrorMessage } from '../services/api.service';

type BookFormGroup = FormGroup<{
  isbn: FormControl<string>;
  title: FormControl<string>;
  description: FormControl<string>;
  edition: FormControl<string>;
  categoryId: FormControl<number | null>;
  publisherId: FormControl<number | null>;
}>;

@Component({
  selector: 'app-book-form',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, ReactiveFormsModule, RouterLink],
  templateUrl: './book-form.component.html'
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
