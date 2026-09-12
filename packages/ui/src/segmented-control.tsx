import { cn } from "./lib/utils";

export interface SegmentedControlOption {
  value: string;
  label: string;
}

interface DesktopSegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Compact desktop tab-switcher — a neutral track with a raised,
 * high-contrast active segment, never a saturated color pill.
 *
 * The active segment used to be `bg-background` — in dark mode's neutral
 * scale, --background (5% lightness) is actually DARKER than the --muted
 * track it sits on (12%), so the "active" pill read as recessed/invisible
 * instead of raised. --card is a few points lighter than --background but
 * still darker than --muted in dark mode, so it can't carry the contrast
 * alone either — a subtle white overlay (theme-agnostic: it always lightens
 * whatever's underneath, unlike a fixed HSL token) plus a real border is
 * what actually reads as "raised" against a dark track. Light mode keeps
 * its own bg-card/border-border treatment, which already had enough
 * separation from the lighter --muted track there.
 */
export function DesktopSegmentedControl({ options, value, onChange, className }: DesktopSegmentedControlProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex h-7 items-center gap-0.5 rounded-md bg-muted/60 dark:bg-muted/40 border border-transparent dark:border-white/[0.08] p-0.5 text-xs overflow-x-auto",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-6 px-2.5 rounded shrink-0 whitespace-nowrap transition-colors",
              active
                ? "bg-card dark:bg-white/[0.08] shadow-sm font-semibold text-foreground border border-border dark:border-white/[0.1]"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
