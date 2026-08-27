import * as React from "react";

import { cn } from "./lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto rounded-2xl">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      // sticky + backdrop-blur is inert (harmless) unless a caller wraps
      // Table in its own scrollable max-height container — where it now
      // stays pinned with a translucent, blurred backdrop over scrolled rows.
      className={cn("[&_tr]:border-b border-border/40 sticky top-0 z-10 backdrop-blur-sm bg-background/80", className)}
      {...props}
    />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    /** Archived/cancelled/void rows — visually recedes without hiding the
     *  row or needing every table to hand-roll the same two classes. */
    dimmed?: boolean;
  }
>(({ className, dimmed, ...props }, ref) => (
  <tr
    ref={ref}
    // `group` is inert on its own (just a hover/focus scope marker for
    // descendants using group-hover:/group-focus-within:) — lets a row's
    // trailing quick-actions stay hidden until the row is hovered without
    // every table having to remember to add it.
    className={cn(
      "group border-b border-border/30 transition-colors duration-200 data-[state=selected]:bg-muted hover:bg-muted/30",
      dimmed && "opacity-60 saturate-50",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

interface NumericCellProps {
  /** Right-aligns and switches to the tabular/mono figure treatment — the
   *  one place a column's "this holds numbers" intent is declared, instead
   *  of every table hand-repeating `text-right font-mono tabular-nums`. */
  numeric?: boolean;
}

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement> & NumericCellProps>(
  ({ className, numeric, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        // Compact, high-density row height (was h-14) with a crisp
        // uppercase micro-label — the Binance/Linear dense-table look.
        "h-11 px-5 text-left align-middle font-semibold text-muted-foreground text-[10px] uppercase tracking-wider [&:has([role=checkbox])]:pr-0",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement> & NumericCellProps>(
  ({ className, numeric, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "px-5 py-3 align-middle [&:has([role=checkbox])]:pr-0",
        numeric && "text-right font-mono tabular-nums tracking-tight",
        className
      )}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
