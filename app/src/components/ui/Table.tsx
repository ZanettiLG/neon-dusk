import type { Breakpoint, DataStatus, TableColumn } from "./types";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  /** Stable row identity (React key). */
  rowKey: (row: T) => string;
  status?: DataStatus;
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  /** Per-row extra classes. */
  rowClassName?: (row: T) => string | undefined;
  /** Screen-reader-only table caption. */
  caption?: string;
  className?: string;
}

/** `hideBelow` → the responsive visibility utilities for th/td cells. */
function hideBelowClass(hideBelow?: Breakpoint): string {
  if (hideBelow === "sm") return "hidden sm:table-cell";
  if (hideBelow === "md") return "hidden md:table-cell";
  if (hideBelow === "lg") return "hidden lg:table-cell";
  return "";
}

/**
 * Semantic data table (issue #54): th scope="col", sr-only caption, wrapper
 * with horizontal scroll on small screens. Drives the shared data states —
 * loading (LoadingState skeleton), error (+retry) and empty (EmptyState).
 */
export default function Table<T>({
  columns,
  rows,
  rowKey,
  status = "default",
  emptyMessage,
  errorMessage,
  onRetry,
  rowClassName,
  caption,
  className,
}: TableProps<T>) {
  if (status === "loading") {
    return <LoadingState />;
  }
  if (status === "error") {
    return <ErrorState message={errorMessage} onRetry={onRetry} />;
  }
  if (status === "empty" || rows.length === 0) {
    return <EmptyState message={emptyMessage ?? "Nenhum dado."} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm font-data ${className ?? ""}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-3 py-2 text-left text-nd-micro uppercase tracking-widest text-nd-text-secondary ${hideBelowClass(col.hideBelow)} ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={rowClassName?.(row)}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`border-t border-nd-cyan/10 px-3 py-2 ${hideBelowClass(col.hideBelow)} ${col.className ?? ""}`}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
