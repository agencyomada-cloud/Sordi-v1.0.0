/**
 * Re-exports Sordi's real chart primitives from @sordi/ui (packages/ui/src/chart.tsx)
 * under the conventional shadcn `@/components/ui/chart` import path.
 *
 * Deliberately NOT a second implementation: packages/ui/src/chart.tsx is the
 * one place ChartContainer/ChartStyle's CSS-variable generation lives, and a
 * copy-pasted duplicate here would fork that logic — including re-risking the
 * exact bug fixed there recently (a key sanitizer that silently dropped any
 * ChartConfig key containing an underscore, e.g. "en_retard" or "task_count",
 * which is why two Dashboard charts were rendering solid black). Every page
 * in the app, including Index.tsx, should keep resolving to this one
 * implementation — this file just gives it the path shadcn conventionally
 * expects.
 */
export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  type ChartConfig,
} from "@sordi/ui";
