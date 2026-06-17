import type { CSSProperties, ReactNode } from "react";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { classNames } from "../lib/class-names.js";

export type SortDirection = "asc" | "desc" | null;

export interface TableProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function tableClassName({
  className,
}: {
  className?: string | undefined;
}): string {
  return classNames("pw-table-wrap", className);
}

export function Table({ children, className, style }: TableProps) {
  return (
    <div className={tableClassName({ className })} style={style}>
      <table className="pw-table">{children}</table>
    </div>
  );
}

export interface TableHeaderProps {
  children: ReactNode;
  className?: string;
}

export function TableHeader({ children, className }: TableHeaderProps) {
  return <thead className={classNames("pw-table-head", className)}>{children}</thead>;
}

export interface TableBodyProps {
  children: ReactNode;
  className?: string;
}

export function TableBody({ children, className }: TableBodyProps) {
  return <tbody className={classNames("pw-table-body", className)}>{children}</tbody>;
}

export interface TableRowProps {
  children: ReactNode;
  hover?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function tableRowClassName({
  hover = false,
  interactive = false,
  className,
}: {
  hover?: boolean;
  interactive?: boolean;
  className?: string | undefined;
}): string {
  return classNames(
    "pw-table-row",
    hover && "pw-table-row-hover",
    interactive && "pw-table-row-interactive",
    className,
  );
}

export function TableRow({
  children,
  hover = false,
  interactive = false,
  onClick,
  className,
  style,
}: TableRowProps) {
  const isInteractive = interactive || Boolean(onClick);

  return (
    <tr
      className={tableRowClassName({
        hover: hover || isInteractive,
        interactive: isInteractive,
        className,
      })}
      onClick={onClick}
      style={style}
    >
      {children}
    </tr>
  );
}

export interface TableHeadProps {
  children: ReactNode;
  sortable?: boolean;
  sortDirection?: SortDirection;
  onSort?: () => void;
  align?: "left" | "right";
  className?: string;
  style?: CSSProperties;
}

function SortIcon({ direction }: { direction: SortDirection }) {
  const iconProps = {
    size: 12,
    strokeWidth: 1.5,
    "aria-hidden": true as const,
  };

  if (direction === "asc") {
    return <ArrowUp {...iconProps} />;
  }

  if (direction === "desc") {
    return <ArrowDown {...iconProps} />;
  }

  return <ChevronsUpDown {...iconProps} />;
}

export function tableHeadClassName({
  sortable = false,
  align = "left",
  className,
}: {
  sortable?: boolean;
  align?: "left" | "right";
  className?: string | undefined;
}): string {
  return classNames(
    "pw-table-th",
    sortable && "pw-table-th-sortable",
    align === "right" && "pw-table-th-right",
    className,
  );
}

export function TableHead({
  children,
  sortable = false,
  sortDirection = null,
  onSort,
  align = "left",
  className,
  style,
}: TableHeadProps) {
  const ariaSort =
    sortDirection === "asc"
      ? "ascending"
      : sortDirection === "desc"
        ? "descending"
        : sortable
          ? "none"
          : undefined;

  if (sortable) {
    return (
      <th
        className={tableHeadClassName({ sortable, align, className })}
        style={style}
        aria-sort={ariaSort}
      >
        <button
          type="button"
          className="pw-table-sort-btn"
          onClick={onSort}
        >
          <span>{children}</span>
          <span className="pw-table-sort-icon">
            <SortIcon direction={sortDirection} />
          </span>
        </button>
      </th>
    );
  }

  return (
    <th
      className={tableHeadClassName({ sortable, align, className })}
      style={style}
    >
      {children}
    </th>
  );
}

export interface TableCellProps {
  children: ReactNode;
  mono?: boolean;
  align?: "left" | "right";
  colSpan?: number;
  className?: string;
  style?: CSSProperties;
}

export function tableCellClassName({
  mono = false,
  align = "left",
  className,
}: {
  mono?: boolean;
  align?: "left" | "right";
  className?: string | undefined;
}): string {
  return classNames(
    "pw-table-td",
    mono && "pw-table-td-mono",
    align === "right" && "pw-table-td-right",
    className,
  );
}

export function TableCell({
  children,
  mono = false,
  align = "left",
  colSpan,
  className,
  style,
}: TableCellProps) {
  return (
    <td
      className={tableCellClassName({ mono, align, className })}
      colSpan={colSpan}
      style={style}
    >
      {children}
    </td>
  );
}
