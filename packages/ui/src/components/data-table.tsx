import type { CSSProperties, ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type SortDirection,
} from "./table.js";
import { classNames } from "../lib/class-names.js";

export type { SortDirection };

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  sortable?: boolean;
  mono?: boolean;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

export interface DataTableSortState {
  columnId: string;
  direction: Exclude<SortDirection, null>;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  sort?: DataTableSortState | null;
  onSort?: (columnId: string) => void;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function dataTableClassName({
  className,
}: {
  className?: string | undefined;
} = {}): string {
  return classNames("pw-data-table", className);
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  sort = null,
  onSort,
  onRowClick,
  emptyState,
  className,
  style,
}: DataTableProps<T>) {
  const interactive = Boolean(onRowClick);

  return (
    <div className={dataTableClassName({ className })} style={style}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => {
              const sortDirection =
                sort?.columnId === column.id ? sort.direction : null;

              const headProps = {
                sortable: Boolean(column.sortable),
                sortDirection,
                align: column.align ?? "left",
                children: column.header,
              } as const;

              if (column.sortable && onSort) {
                return (
                  <TableHead
                    key={column.id}
                    {...headProps}
                    onSort={() => onSort(column.id)}
                  />
                );
              }

              return <TableHead key={column.id} {...headProps} />;
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="pw-data-table-empty"
              >
                {emptyState ?? "No results"}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={getRowKey(row)}
                hover
                interactive={interactive}
                {...(onRowClick ? { onClick: () => onRowClick(row) } : {})}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    mono={column.mono ?? false}
                    align={column.align ?? "left"}
                  >
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function toggleDataTableSort(
  current: DataTableSortState | null,
  columnId: string,
): DataTableSortState {
  if (current?.columnId !== columnId) {
    return { columnId, direction: "asc" };
  }

  return {
    columnId,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}
