import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Observable, catchError, firstValueFrom, forkJoin, of } from 'rxjs';

import { ApiService, buildIdPath, extractErrorMessage } from '../services/api.service';
import { CurrentUserService } from '../services/current-user.service';
import {
  ApiRecord,
  AuthorDto,
  BookAuthorDto,
  BookConditionDto,
  BookDto,
  InventoryDto,
  PurchaseLogDto,
  ShoppingCartDto,
  UserDto
} from '../models';

interface CartLine {
  cart: ShoppingCartDto;
  book: BookDto | null;
  authors: string[];
  inventory: InventoryDto | null;
  condition: BookConditionDto | null;
  availableCopies: number;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CurrencyPipe, NgFor, NgIf],
  templateUrl: './cart.component.html'
})
export class CartComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly currentUser = inject(CurrentUserService);

  cartLines: CartLine[] = [];
  currentUserRecord: UserDto | null = null;
  subtotal = 0;
  error = '';
  message = '';
  checkingOut = false;

  ngOnInit(): void {
    this.loadCart();
  }

  async remove(line: CartLine): Promise<void> {
    this.error = '';
    this.message = '';

    try {
      await firstValueFrom(this.api.delete('/api/shopping-carts', buildIdPath(line.cart, ['userID', 'isbn'])));
      this.message = 'Cart item removed.';
      this.loadCart();
    } catch (error) {
      this.error = extractErrorMessage(error);
    }
  }

  async checkout(): Promise<void> {
    if (!this.currentUserRecord?.userID) {
      this.error = 'Unable to find the signed-in user record.';
      return;
    }

    this.checkingOut = true;
    this.error = '';
    this.message = '';

    try {
      for (const line of this.cartLines) {
        if (!line.inventory?.inventoryID) {
          throw new Error(`${line.book?.title || line.cart.isbn} has no available inventory copy.`);
        }

        await firstValueFrom(
          this.api.create<PurchaseLogDto>('/api/purchase-logs', {
            userID: this.currentUserRecord.userID,
            inventoryID: line.inventory.inventoryID
          })
        );

        await firstValueFrom(
          this.api.update<InventoryDto>('/api/inventories', String(line.inventory.inventoryID), {
            ...line.inventory,
            purchased: true
          })
        );

        await firstValueFrom(this.api.delete('/api/shopping-carts', buildIdPath(line.cart, ['userID', 'isbn'])));
      }

      this.message = 'Checkout complete. Purchase logs and inventory status were updated.';
      this.loadCart();
    } catch (error) {
      this.error = error instanceof Error ? error.message : extractErrorMessage(error);
    } finally {
      this.checkingOut = false;
    }
  }

  private loadCart(): void {
    this.error = '';

    this.currentUser.loadCurrentUser().subscribe({
      next: (user) => {
        this.currentUserRecord = user;
        if (!user?.userID) {
          this.cartLines = [];
          this.subtotal = 0;
          return;
        }

        forkJoin({
          carts: this.safeList<ShoppingCartDto>('/api/shopping-carts'),
          books: this.safeList<BookDto>('/api/books'),
          inventories: this.safeList<InventoryDto>('/api/inventories'),
          conditions: this.safeList<BookConditionDto>('/api/book-conditions'),
          authors: this.safeList<AuthorDto>('/api/authors'),
          bookAuthors: this.safeList<BookAuthorDto>('/api/book-authors')
        }).subscribe(({ carts, books, inventories, conditions, authors, bookAuthors }) => {
          const userCarts = carts.filter((cart) => cart.userID === user.userID);
          this.cartLines = userCarts.map((cart) => this.toCartLine(cart, books, inventories, conditions, authors, bookAuthors));
          this.subtotal = this.cartLines.reduce((total, line) => total + (line.condition?.price ?? 0), 0);
        });
      },
      error: (error: unknown) => {
        this.error = extractErrorMessage(error);
      }
    });
  }

  private toCartLine(
    cart: ShoppingCartDto,
    books: BookDto[],
    inventories: InventoryDto[],
    conditions: BookConditionDto[],
    authors: AuthorDto[],
    bookAuthors: BookAuthorDto[]
  ): CartLine {
    const book = books.find((item) => item.isbn === cart.isbn) ?? null;
    const availableCopies = inventories.filter((copy) => copy.isbn === cart.isbn && !copy.purchased);
    const inventory = availableCopies[0] ?? null;
    const condition = inventory ? conditions.find((item) => item.ranks === inventory.ranks) ?? null : null;
    const authorNames = bookAuthors
      .filter((link) => link.isbn === cart.isbn)
      .map((link) => authors.find((author) => author.authorID === link.authorID))
      .filter((author): author is AuthorDto => Boolean(author))
      .map((author) => `${author.firstName} ${author.lastName}`.trim());

    return {
      cart,
      book,
      authors: authorNames,
      inventory,
      condition,
      availableCopies: availableCopies.length
    };
  }

  private safeList<T extends ApiRecord>(endpoint: string): Observable<T[]> {
    return this.api.list<T>(endpoint).pipe(catchError(() => of([])));
  }
}
