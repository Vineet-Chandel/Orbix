export type ColumnGroup = "action" | "status" | "personal" | "response" | "timestamp";

export type ColumnType =
    | "action"
    | "status"
    | "text"
    | "number"
    | "date"
    | "select"
    | "multiselect"
    | "boolean"
    | "url"
    | "file";

export interface DynamicQuestionMeta {
    id: string;
    label: string;
    type?: string;
    options?: string[];
    required?: boolean;
}

export interface TableColumnDefinition {
    id: string;
    label: string;
    group: ColumnGroup;
    type: ColumnType;
    minWidth?: string;
    width?: string;
    sortable?: boolean;
    filterable?: boolean;
    options?: string[]; // for select/choice filters
    questionMeta?: DynamicQuestionMeta;
    sticky?: "left";
    stickyOffset?: number;
}

export type TextFilterOperator =
    | "contains"
    | "does_not_contain"
    | "equals"
    | "does_not_equal"
    | "starts_with"
    | "is_empty"
    | "is_not_empty";

export type NumberFilterOperator =
    | "equals"
    | "greater_than"
    | "less_than"
    | "between"
    | "is_empty"
    | "is_not_empty";

export type DateFilterOperator =
    | "equals"
    | "before"
    | "after"
    | "between"
    | "is_empty"
    | "is_not_empty";

export type FileFilterOperator = "has_file" | "no_file";

export type BooleanFilterOperator = "is_true" | "is_false" | "is_empty";

export interface ColumnFilterRule {
    columnId: string;
    operator: string;
    value?: any;
    secondValue?: any; // for 'between'
    selectedOptions?: string[]; // for multi-select checkboxes
}

export type SortDirection = "asc" | "desc";

export interface SortState {
    columnId: string;
    direction: SortDirection;
}

export interface ApplicationsFilterState {
    searchQuery: string;
    statusFilter: "all" | "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled";
    institutionFilter: string;
    stateFilter: string;
    columnFilters: Record<string, ColumnFilterRule>;
    sort: SortState | null;
}
