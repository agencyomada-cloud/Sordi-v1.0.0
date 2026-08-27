import { useState } from "react";
import { format, addDays, endOfMonth } from "date-fns";
import { fr, arDZ } from "date-fns/locale";
import { RiCalendarLine as CalendarIcon } from "@remixicon/react";
import { Popover, PopoverContent, PopoverTrigger, Calendar } from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";

export interface DatePickerProps {
  /** ISO 'YYYY-MM-DD' — matches how every date field in this app's form
   *  state already stores dates, so swapping in a raw `<input type="date">`
   *  needs no change to the surrounding form's value/onChange shape. */
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Shows the quick-select preset row (Aujourd'hui / +15 jours /
   *  +30 jours / Fin du mois). On by default; turn off for date fields
   *  where a relative shortcut wouldn't make sense (e.g. a birthdate). */
  presets?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Off for ultra-compact inline contexts (e.g. a date sitting inline
   *  inside a printed-document preview) where the icon would just be clutter. */
  showIcon?: boolean;
}

function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function parseISODate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/**
 * Drop-in replacement for `<input type="date">` — same ISO-string value
 * shape, but a proper glass calendar popover instead of the browser's raw
 * native picker (which can't be styled and looks different per OS/browser).
 */
export function DatePicker({ value, onChange, placeholder, presets = true, disabled, className, id, showIcon = true }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();
  const locale = language === "ar" ? arDZ : fr;
  const selected = parseISODate(value);

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    onChange(toISODate(date));
    setOpen(false);
  };

  const presetOptions: { label: string; getDate: () => Date }[] = [
    { label: language === "ar" ? "اليوم" : "Aujourd'hui", getDate: () => new Date() },
    { label: "+15 " + (language === "ar" ? "يوم" : "jours"), getDate: () => addDays(new Date(), 15) },
    { label: "+30 " + (language === "ar" ? "يوم" : "jours"), getDate: () => addDays(new Date(), 30) },
    { label: language === "ar" ? "نهاية الشهر" : "Fin du mois", getDate: () => endOfMonth(new Date()) },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            "h-10 w-full px-3.5 bg-background border border-border/50 rounded-xl hover:bg-muted/40 transition-colors flex items-center text-sm font-medium disabled:opacity-50 disabled:pointer-events-none",
            className
          )}
        >
          {showIcon && <CalendarIcon className="w-4 h-4 text-muted-foreground me-2 shrink-0" />}
          <span className={cn("truncate font-mono tabular-nums", !selected && "text-muted-foreground font-normal font-sans")}>
            {selected ? format(selected, "dd MMM yyyy", { locale }) : placeholder || (language === "ar" ? "اختر التاريخ" : "Sélectionner une date")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3 rounded-2xl">
        {presets && (
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-border/50">
            {presetOptions.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSelect(preset.getDate())}
                className="px-2.5 py-1 text-xs font-medium rounded-full bg-secondary hover:bg-secondary/70 text-foreground transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
        <Calendar mode="single" selected={selected} onSelect={handleSelect} locale={locale} defaultMonth={selected} initialFocus />
      </PopoverContent>
    </Popover>
  );
}
