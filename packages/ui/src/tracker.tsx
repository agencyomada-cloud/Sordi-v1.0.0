import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/utils";

// Adapted from Tremor Raw's Tracker (https://tremor.so), which normally
// picks its block color via tailwind-variants' tv() — that package isn't a
// dependency here, so the color map is expressed as a cva() variant instead,
// matching every other variant-driven primitive in this package.
const trackerBlockVariants = cva("h-full w-full rounded-[1px] first:rounded-l-[3px] last:rounded-r-[3px]", {
  variants: {
    color: {
      emerald: "bg-emerald-500 dark:bg-emerald-500",
      amber: "bg-amber-500 dark:bg-amber-500",
      rose: "bg-rose-500 dark:bg-rose-500",
      slate: "bg-slate-200 dark:bg-slate-700",
    },
    hoverEffect: {
      true: "hover:opacity-70",
      false: "",
    },
  },
  defaultVariants: {
    hoverEffect: false,
  },
});

export type TrackerColor = NonNullable<VariantProps<typeof trackerBlockVariants>["color"]>;

export interface TrackerBlockProps extends VariantProps<typeof trackerBlockVariants> {
  key?: React.Key;
  /** Rich hover-card content for this block — a date/status/detail layout, not just a string. */
  tooltip?: React.ReactNode;
  defaultBackgroundColor?: string;
}

export interface TrackerProps extends React.HTMLAttributes<HTMLDivElement> {
  data: TrackerBlockProps[];
  defaultBackgroundColor?: string;
  hoverEffect?: boolean;
}

const TrackerBlock = ({
  color,
  tooltip,
  hoverEffect,
  defaultBackgroundColor,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "color"> & Pick<TrackerBlockProps, "color" | "tooltip" | "defaultBackgroundColor"> & {
  hoverEffect?: boolean;
}) => {
  return (
    <div className="relative group/day flex-1 h-full flex items-center justify-center">
      <div
        className={cn(
          "h-full w-full rounded-[1px] first:rounded-l-[3px] last:rounded-r-[3px] cursor-pointer transition-opacity",
          color ? trackerBlockVariants({ color, hoverEffect: true }) : defaultBackgroundColor,
          className
        )}
        {...props}
      />
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/day:flex flex-col items-center pointer-events-none z-50 select-none transition-all duration-150 ease-out">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_8px_20px_-4px_rgba(15,23,42,0.08)] text-slate-800 text-[11px] rounded-xl py-1.5 px-3 whitespace-nowrap">
            {tooltip}
          </div>
          <div className="w-2 h-2 bg-white/95 border-r border-b border-slate-200/90 rotate-45 -mt-1 shadow-xs" />
        </div>
      )}
    </div>
  );
};

/** A horizontal strip of colored day-blocks, each with an optional rich hover card — e.g. daily attendance status across a month. */
const Tracker = React.forwardRef<HTMLDivElement, TrackerProps>(
  ({ data = [], defaultBackgroundColor = "bg-slate-200 dark:bg-slate-700", hoverEffect, className, ...other }, forwardedRef) => (
    <div ref={forwardedRef} className={cn("group flex h-8 w-full items-stretch gap-0.5", className)} {...other}>
      {data.map((blockProps, index) => {
        const { key, ...rest } = blockProps;
        return (
          <TrackerBlock
            key={key ?? index}
            defaultBackgroundColor={defaultBackgroundColor}
            hoverEffect={hoverEffect}
            {...rest}
          />
        );
      })}
    </div>
  ),
);
Tracker.displayName = "Tracker";

export { Tracker, trackerBlockVariants };
