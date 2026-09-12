import { Skeleton } from "./skeleton";
import { TableRow, TableCell } from "./table";

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
