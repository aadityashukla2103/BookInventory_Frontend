import { NgFor, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormControl, UntypedFormGroup, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ApiService, buildIdPath, extractErrorMessage } from '../services/api.service';
import { ApiRecord, FieldConfig, Primitive, ResourceConfig } from '../models';
import { MANAGED_RESOURCE_KEYS, RESOURCE_CONFIGS, RESOURCE_LOOKUP } from '../resource-config';

@Component({
  selector: 'app-crud-page',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault, ReactiveFormsModule, RouterLink],
  templateUrl: './crud-page.component.html'
})
export class CrudPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  config: ResourceConfig | null = null;
  form = new UntypedFormGroup({});
  records: ApiRecord[] = [];
  filteredRecords: ApiRecord[] = [];
  optionCache: Record<string, ApiRecord[]> = {};
  editingRecord: ApiRecord | null = null;
  searchTerm = '';
  loading = false;
  saving = false;
  showForm = false;
  error = '';
  message = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.setupResource(params.get('resource'));
    });
  }

  tableFields(): FieldConfig[] {
    return this.config?.fields.filter((field) => field.showInTable !== false) ?? [];
  }

  visibleFormFields(): FieldConfig[] {
    if (!this.config) {
      return [];
    }

    return this.config.fields.filter((field) => this.editingRecord || !field.generated);
  }

  canCreate(): boolean {
    return this.config?.key !== 'inventories';
  }

  canDelete(): boolean {
    return this.config?.key !== 'inventories';
  }

  singularTitle(): string {
    const title = this.config?.title ?? 'Record';
    return title.endsWith('ies') ? title.slice(0, -3) + 'y' : title.endsWith('s') ? title.slice(0, -1) : title;
  }

  optionsFor(field: FieldConfig): ApiRecord[] {
    return this.optionCache[field.key] ?? [];
  }

  optionValue(option: ApiRecord, field: FieldConfig): Primitive {
    const relation = field.relation ? RESOURCE_LOOKUP[field.relation] : null;
    const valueKey = field.optionValue ?? relation?.idFields[0] ?? field.key;
    return option[valueKey];
  }

  optionLabel(option: ApiRecord, field: FieldConfig): string {
    const relation = field.relation ? RESOURCE_LOOKUP[field.relation] : null;
    const fields = relation?.labelFields ?? [field.optionValue ?? field.key];
    const label = fields
      .map((key) => option[key])
      .filter((value) => value !== null && value !== undefined && value !== '')
      .join(' - ');

    return label || String(this.optionValue(option, field) ?? '-');
  }

  startCreate(clearFeedback = true): void {
    if (!this.canCreate()) {
      return;
    }

    this.editingRecord = null;
    this.showForm = true;
    if (clearFeedback) {
      this.message = '';
      this.error = '';
    }
    this.form.reset(this.defaultFormValue());
    this.setControlStates(false);
  }

  startEdit(record: ApiRecord): void {
    this.editingRecord = record;
    this.showForm = true;
    this.message = '';
    this.error = '';
    this.form.reset(this.recordFormValue(record));
    this.setControlStates(true);
  }

  hideForm(): void {
    this.showForm = false;
    this.editingRecord = null;
    this.form.reset(this.defaultFormValue());
    this.setControlStates(false);
  }

  save(): void {
    if (!this.config) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.serializeForm();
    const request = this.editingRecord
      ? this.api.update(this.config.endpoint, buildIdPath(this.editingRecord, this.config.idFields), payload)
      : this.api.create(this.config.endpoint, payload);

    this.saving = true;
    this.error = '';
    this.message = '';

    request.subscribe({
      next: () => {
        this.message = this.editingRecord ? 'Record updated.' : 'Record created.';
        this.saving = false;
        this.loadRecords();
        this.hideForm();
      },
      error: (error: unknown) => {
        this.error = extractErrorMessage(error);
        this.saving = false;
      }
    });
  }

  deleteRecord(record: ApiRecord): void {
    if (!this.config || !confirm('Delete this record?')) {
      return;
    }

    this.api.delete(this.config.endpoint, buildIdPath(record, this.config.idFields)).subscribe({
      next: () => {
        this.message = 'Record deleted.';
        this.loadRecords();
        this.startCreate(false);
      },
      error: (error: unknown) => {
        this.error = extractErrorMessage(error);
      }
    });
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredRecords = [...this.records];
      return;
    }

    this.filteredRecords = this.records.filter((record) =>
      this.tableFields().some((field) => this.formatCell(record, field).toLowerCase().includes(term))
    );
  }

  formatCell(record: ApiRecord, field: FieldConfig): string {
    const value = record[field.key];
    if (field.relation) {
      const match = this.optionsFor(field).find((option) => this.optionValue(option, field) === value);
      return match ? this.optionLabel(match, field) : String(value ?? '-');
    }

    if (field.type === 'checkbox') {
      return value ? 'Yes' : 'No';
    }

    return value === null || value === undefined || value === '' ? '-' : String(value);
  }

  isInvalid(field: FieldConfig): boolean {
    const control = this.form.get(field.key);
    return Boolean(control?.invalid && (control.dirty || control.touched));
  }

  private setupResource(resourceKey: string | null): void {
    const resource = RESOURCE_CONFIGS.find((item) => item.key === resourceKey) ?? null;
    this.config = resource && MANAGED_RESOURCE_KEYS.includes(resource.key) ? resource : null;
    this.records = [];
    this.filteredRecords = [];
    this.searchTerm = '';
    this.optionCache = {};
    this.error = '';
    this.message = '';

    if (!this.config) {
      this.router.navigateByUrl('/dashboard');
      return;
    }

    this.buildForm();
    this.hideForm();
    this.loadOptions();
    this.loadRecords();
  }

  private buildForm(): void {
    const controls: Record<string, UntypedFormControl> = {};
    for (const field of this.config?.fields ?? []) {
      controls[field.key] = new UntypedFormControl(this.defaultFieldValue(field), this.validatorsFor(field));
    }

    this.form = new UntypedFormGroup(controls);
  }

  private loadRecords(): void {
    if (!this.config) {
      return;
    }

    this.loading = true;
    this.api.list(this.config.endpoint).subscribe({
      next: (records) => {
        this.records = records;
        this.loading = false;
        this.applyFilter();
      },
      error: (error: unknown) => {
        this.error = extractErrorMessage(error);
        this.loading = false;
      }
    });
  }

  private loadOptions(): void {
    const fields = this.config?.fields.filter((field) => field.relation) ?? [];
    for (const field of fields) {
      const relation = field.relation ? RESOURCE_LOOKUP[field.relation] : null;
      if (!relation) {
        continue;
      }

      this.api
        .list(relation.endpoint)
        .pipe(catchError(() => of([])))
        .subscribe((options) => {
          this.optionCache[field.key] = options;
        });
    }
  }

  private setControlStates(editing: boolean): void {
    for (const field of this.config?.fields ?? []) {
      const control = this.form.get(field.key);
      if (!control) {
        continue;
      }

      if (field.generated || (editing && field.readonlyOnEdit)) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }
  }

  private defaultFormValue(): ApiRecord {
    const value: ApiRecord = {};
    for (const field of this.config?.fields ?? []) {
      value[field.key] = this.defaultFieldValue(field);
    }
    return value;
  }

  private recordFormValue(record: ApiRecord): ApiRecord {
    const value: ApiRecord = {};
    for (const field of this.config?.fields ?? []) {
      value[field.key] = record[field.key] ?? this.defaultFieldValue(field);
    }
    return value;
  }

  private defaultFieldValue(field: FieldConfig): Primitive {
    if (field.type === 'checkbox') {
      return false;
    }

    if (field.type === 'number' || field.type === 'select') {
      return null;
    }

    return '';
  }

  private serializeForm(): ApiRecord {
    const raw = this.form.getRawValue() as Record<string, unknown>;
    const payload: ApiRecord = {};

    for (const field of this.config?.fields ?? []) {
      if (!this.editingRecord && field.generated) {
        continue;
      }

      const rawValue = raw[field.key];
      if (field.type === 'checkbox') {
        payload[field.key] = Boolean(rawValue);
      } else if (field.type === 'number') {
        payload[field.key] = rawValue === '' || rawValue === null || rawValue === undefined ? null : Number(rawValue);
      } else {
        payload[field.key] = rawValue === '' || rawValue === undefined ? null : (rawValue as Primitive);
      }
    }

    return payload;
  }

  private validatorsFor(field: FieldConfig): ValidatorFn[] {
    const validators: ValidatorFn[] = [];
    if (field.required) {
      validators.push(Validators.required);
    }

    if (field.min !== undefined) {
      validators.push(Validators.min(field.min));
    }

    if (field.max !== undefined) {
      validators.push(Validators.max(field.max));
    }

    if (field.maxLength !== undefined) {
      validators.push(Validators.maxLength(field.maxLength));
    }

    return validators;
  }
}
