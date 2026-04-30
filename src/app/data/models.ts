export type Primitive = string | number | boolean | null | undefined;
export type ApiRecord = Record<string, Primitive>;

export interface AuthorDto extends ApiRecord {
  authorID: number | null;
  lastName: string;
  firstName: string;
  photo: string | null;
}

export interface BookAuthorDto extends ApiRecord {
  isbn: string;
  authorID: number | null;
  primaryAuthor: string | null;
}

export interface BookConditionDto extends ApiRecord {
  ranks: number | null;
  description: string;
  fullDescription: string | null;
  price: number | null;
}

export interface BookDto extends ApiRecord {
  isbn: string;
  title: string;
  description: string | null;
  edition: string | null;
  categoryId: number | null;
  publisherId: number | null;
}

export interface BookReviewDto extends ApiRecord {
  isbn: string;
  reviewerId: number | null;
  rating: number | null;
  comments: string | null;
}

export interface CategoryDto extends ApiRecord {
  catId: number | null;
  categoryName: string;
}

export interface InventoryDto extends ApiRecord {
  inventoryID: number | null;
  isbn: string;
  ranks: number | null;
  purchased: boolean | null;
}

export interface PermRoleDto extends ApiRecord {
  roleNumber: number | null;
  permRole: string;
}

export interface PublisherDto extends ApiRecord {
  publisherId: number | null;
  name: string;
  city: string | null;
  stateCode: string | null;
}

export interface PurchaseLogDto extends ApiRecord {
  userID: number | null;
  inventoryID: number | null;
}

export interface ReviewerDto extends ApiRecord {
  reviewerId: number | null;
  name: string;
  employedBy: string | null;
}

export interface ShoppingCartDto extends ApiRecord {
  userID: number | null;
  isbn: string;
}

export interface StateDto extends ApiRecord {
  stateCode: string;
  stateName: string;
}

export interface UserDto extends ApiRecord {
  userID: number | null;
  lastName: string;
  firstName: string;
  phoneNumber: string | null;
  userName: string;
  password?: string | null;
  roleNumber: number | null;
}

export type FieldType = 'text' | 'number' | 'textarea' | 'checkbox' | 'select' | 'password';

export type ResourceKey =
  | 'authors'
  | 'book-authors'
  | 'book-conditions'
  | 'book-reviews'
  | 'books'
  | 'categories'
  | 'inventories'
  | 'perm-roles'
  | 'publishers'
  | 'purchase-logs'
  | 'reviewers'
  | 'shopping-carts'
  | 'states'
  | 'users';

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  generated?: boolean;
  readonlyOnEdit?: boolean;
  showInTable?: boolean;
  relation?: ResourceKey;
  optionValue?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
}

export interface ResourceConfig {
  key: ResourceKey;
  title: string;
  endpoint: string;
  icon: string;
  description: string;
  idFields: string[];
  labelFields: string[];
  fields: FieldConfig[];
}
