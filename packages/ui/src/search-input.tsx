import { forwardRef } from "react";
import { RiSearchLine, RiCloseLine } from "@remixicon/react";
import { Input } from "./input";
import { cn } from "./lib/utils";

interface SearchInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  containerClassName?: string;
}

/**
 * Every list page had its own hand-positioned search icon and no way to
 * clear a query except selecting and deleting the text. One component,
 * used everywhere search appears, fixes that gap in one place.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onChange, className, containerClassName, placeholder = "Rechercher...", ...props }, ref) {
    return (
      <div className={cn("relative", containerClassName)}>
        <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn("pl-11", value && "pr-9", className)}
          {...props}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Effacer la recherche"
          >
            <RiCloseLine className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);
