import { ResourceConfig, ResourceKey } from './models';

export const MANAGED_RESOURCE_KEYS: ResourceKey[] = ['authors', 'categories', 'publishers', 'inventories'];

export const RESOURCE_CONFIGS: ResourceConfig[] = [
  {
    key: 'books',
    title: 'Books',
    endpoint: '/api/books',
    icon: 'bi-book',
    description: 'Catalog titles with category and publisher references.',
    idFields: ['isbn'],
    labelFields: ['title', 'isbn'],
    fields: [
      { key: 'isbn', label: 'ISBN', type: 'text', required: true, readonlyOnEdit: true, maxLength: 13 },
      { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 70 },
      { key: 'description', label: 'Description', type: 'textarea', maxLength: 100 },
      { key: 'edition', label: 'Edition', type: 'text', maxLength: 30 },
      { key: 'categoryId', label: 'Category', type: 'select', relation: 'categories', optionValue: 'catId' },
      { key: 'publisherId', label: 'Publisher', type: 'select', required: true, relation: 'publishers', optionValue: 'publisherId' }
    ]
  },
  {
    key: 'authors',
    title: 'Authors',
    endpoint: '/api/authors',
    icon: 'bi-person-lines-fill',
    description: 'Author master records used by book-author mapping.',
    idFields: ['authorID'],
    labelFields: ['firstName', 'lastName', 'authorID'],
    fields: [
      { key: 'authorID', label: 'Author ID', type: 'number', generated: true, readonlyOnEdit: true },
      { key: 'firstName', label: 'First Name', type: 'text', required: true },
      { key: 'lastName', label: 'Last Name', type: 'text', required: true },
      { key: 'photo', label: 'Photo', type: 'text', maxLength: 1 }
    ]
  },
  {
    key: 'categories',
    title: 'Categories',
    endpoint: '/api/categories',
    icon: 'bi-tags',
    description: 'Book category lookup values.',
    idFields: ['catId'],
    labelFields: ['categoryName', 'catId'],
    fields: [
      { key: 'catId', label: 'Category ID', type: 'number', generated: true, readonlyOnEdit: true },
      { key: 'categoryName', label: 'Category Name', type: 'text', required: true }
    ]
  },
  {
    key: 'publishers',
    title: 'Publishers',
    endpoint: '/api/publishers',
    icon: 'bi-building',
    description: 'Publisher records connected to states and books.',
    idFields: ['publisherId'],
    labelFields: ['name', 'publisherId'],
    fields: [
      { key: 'publisherId', label: 'Publisher ID', type: 'number', required: true, readonlyOnEdit: true },
      { key: 'name', label: 'Name', type: 'text', required: true, maxLength: 50 },
      { key: 'city', label: 'City', type: 'text', maxLength: 30 },
      { key: 'stateCode', label: 'State', type: 'select', relation: 'states', optionValue: 'stateCode' }
    ]
  },
  {
    key: 'states',
    title: 'States',
    endpoint: '/api/states',
    icon: 'bi-geo-alt',
    description: 'State lookup values for publisher addresses.',
    idFields: ['stateCode'],
    labelFields: ['stateName', 'stateCode'],
    fields: [
      { key: 'stateCode', label: 'State Code', type: 'text', required: true, readonlyOnEdit: true, maxLength: 2 },
      { key: 'stateName', label: 'State Name', type: 'text', required: true, maxLength: 50 }
    ]
  },
  {
    key: 'book-conditions',
    title: 'Book Conditions',
    endpoint: '/api/book-conditions',
    icon: 'bi-stars',
    description: 'Condition ranks, descriptions, and prices.',
    idFields: ['ranks'],
    labelFields: ['description', 'ranks'],
    fields: [
      { key: 'ranks', label: 'Rank', type: 'number', required: true, readonlyOnEdit: true },
      { key: 'description', label: 'Description', type: 'text', required: true },
      { key: 'fullDescription', label: 'Full Description', type: 'textarea' },
      { key: 'price', label: 'Price', type: 'number', required: true, min: 0, step: 0.01 }
    ]
  },
  {
    key: 'inventories',
    title: 'Inventory',
    endpoint: '/api/inventories',
    icon: 'bi-box-seam',
    description: 'Physical book copies with condition and purchase status.',
    idFields: ['inventoryID'],
    labelFields: ['inventoryID', 'isbn'],
    fields: [
      { key: 'inventoryID', label: 'Inventory ID', type: 'number', generated: true, readonlyOnEdit: true },
      { key: 'isbn', label: 'Book', type: 'select', required: true, readonlyOnEdit: true, relation: 'books', optionValue: 'isbn' },
      { key: 'ranks', label: 'Rank', type: 'select', required: true, relation: 'book-conditions', optionValue: 'ranks' },
      { key: 'purchased', label: 'Purchased', type: 'checkbox' }
    ]
  },
  {
    key: 'reviewers',
    title: 'Reviewers',
    endpoint: '/api/reviewers',
    icon: 'bi-chat-square-quote',
    description: 'Reviewer records for book reviews.',
    idFields: ['reviewerId'],
    labelFields: ['name', 'reviewerId'],
    fields: [
      { key: 'reviewerId', label: 'Reviewer ID', type: 'number', required: true, readonlyOnEdit: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'employedBy', label: 'Employed By', type: 'text' }
    ]
  },
  {
    key: 'book-reviews',
    title: 'Book Reviews',
    endpoint: '/api/book-reviews',
    icon: 'bi-star-half',
    description: 'Ratings and comments for books.',
    idFields: ['isbn', 'reviewerId'],
    labelFields: ['isbn', 'reviewerId'],
    fields: [
      { key: 'isbn', label: 'Book', type: 'select', required: true, readonlyOnEdit: true, relation: 'books', optionValue: 'isbn' },
      { key: 'reviewerId', label: 'Reviewer', type: 'select', required: true, readonlyOnEdit: true, relation: 'reviewers', optionValue: 'reviewerId' },
      { key: 'rating', label: 'Rating', type: 'number', required: true, min: 1, max: 5 },
      { key: 'comments', label: 'Comments', type: 'textarea', maxLength: 255 }
    ]
  },
  {
    key: 'book-authors',
    title: 'Book Authors',
    endpoint: '/api/book-authors',
    icon: 'bi-link-45deg',
    description: 'Book-to-author relationships and primary-author markers.',
    idFields: ['isbn', 'authorID'],
    labelFields: ['isbn', 'authorID'],
    fields: [
      { key: 'isbn', label: 'Book', type: 'select', required: true, readonlyOnEdit: true, relation: 'books', optionValue: 'isbn' },
      { key: 'authorID', label: 'Author', type: 'select', required: true, readonlyOnEdit: true, relation: 'authors', optionValue: 'authorID' },
      { key: 'primaryAuthor', label: 'Primary Author', type: 'text' }
    ]
  },
  {
    key: 'shopping-carts',
    title: 'Shopping Carts',
    endpoint: '/api/shopping-carts',
    icon: 'bi-cart',
    description: 'User cart rows keyed by user and ISBN.',
    idFields: ['userID', 'isbn'],
    labelFields: ['userID', 'isbn'],
    fields: [
      { key: 'userID', label: 'User', type: 'select', required: true, readonlyOnEdit: true, relation: 'users', optionValue: 'userID' },
      { key: 'isbn', label: 'Book', type: 'select', required: true, readonlyOnEdit: true, relation: 'books', optionValue: 'isbn' }
    ]
  },
  {
    key: 'purchase-logs',
    title: 'Purchase Logs',
    endpoint: '/api/purchase-logs',
    icon: 'bi-receipt',
    description: 'Purchase rows keyed by user and inventory copy.',
    idFields: ['userID', 'inventoryID'],
    labelFields: ['userID', 'inventoryID'],
    fields: [
      { key: 'userID', label: 'User', type: 'select', required: true, readonlyOnEdit: true, relation: 'users', optionValue: 'userID' },
      { key: 'inventoryID', label: 'Inventory Copy', type: 'select', required: true, readonlyOnEdit: true, relation: 'inventories', optionValue: 'inventoryID' }
    ]
  },
  {
    key: 'users',
    title: 'Users',
    endpoint: '/api/users',
    icon: 'bi-people',
    description: 'Application users and role assignments.',
    idFields: ['userID'],
    labelFields: ['firstName', 'lastName', 'userName'],
    fields: [
      { key: 'userID', label: 'User ID', type: 'number', generated: true, readonlyOnEdit: true },
      { key: 'firstName', label: 'First Name', type: 'text', required: true },
      { key: 'lastName', label: 'Last Name', type: 'text', required: true },
      { key: 'phoneNumber', label: 'Phone Number', type: 'text' },
      { key: 'userName', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', showInTable: false },
      { key: 'roleNumber', label: 'Role', type: 'select', required: true, relation: 'perm-roles', optionValue: 'roleNumber' }
    ]
  },
  {
    key: 'perm-roles',
    title: 'Permission Roles',
    endpoint: '/api/perm-roles',
    icon: 'bi-shield-lock',
    description: 'Security roles consumed by Spring Security.',
    idFields: ['roleNumber'],
    labelFields: ['permRole', 'roleNumber'],
    fields: [
      { key: 'roleNumber', label: 'Role Number', type: 'number', required: true, readonlyOnEdit: true },
      { key: 'permRole', label: 'Role Name', type: 'text', required: true }
    ]
  }
];

export const RESOURCE_LOOKUP = RESOURCE_CONFIGS.reduce<Record<ResourceKey, ResourceConfig>>(
  (lookup, resource) => {
    lookup[resource.key] = resource;
    return lookup;
  },
  {} as Record<ResourceKey, ResourceConfig>
);
