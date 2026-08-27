import { RiLoader4Line as Loader2 } from "@remixicon/react";
import { cn } from "./lib/utils";
import { Skeleton } from "./skeleton";
import { TableRow, TableCell } from "./table";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "Chargement...", className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

interface TableLoadingProps {
  columns?: number;
  rows?: number;
  /** Right-aligns a given column's skeleton bar — pass the same indices
   *  that render `numeric` TableCells in the real (loaded) row, so the
   *  placeholder doesn't jump from left- to right-aligned once data lands. */
  numericColumns?: number[];
}

// Fixed width pattern (not randomized) — a stable placeholder reads as a
// real, deliberate layout; widths re-rolling every render just looks
// broken. Cycles through a few plausible content widths per column.
const WIDTH_PATTERN = ["70%", "45%", "85%", "55%", "60%"];

export function TableLoading({ columns = 6, rows = 5, numericColumns = [] }: TableLoadingProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <TableCell key={colIndex} numeric={numericColumns.includes(colIndex)}>
              <Skeleton
                className="h-4"
                style={{ width: WIDTH_PATTERN[(colIndex + rowIndex) % WIDTH_PATTERN.length] }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
