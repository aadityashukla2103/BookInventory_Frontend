import { AuthState } from './services/auth.service';
import { AuthorDto, BookAuthorDto, BookDto, CategoryDto, InventoryDto, PublisherDto } from './models';

export interface BookView {
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

export function authorName(author: AuthorDto): string {
  return `${author.firstName} ${author.lastName}`.trim() || String(author.authorID ?? '');
}

export function canAdmin(state: AuthState | null): boolean {
  return Boolean(state?.roles.some((role) => role.toUpperCase().includes('ADMIN')));
}

export function toNumberArray(values: unknown): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
}

export function toBookView(
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
