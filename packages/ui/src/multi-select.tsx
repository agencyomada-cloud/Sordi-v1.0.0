import * as React from "react";
import { RiCloseLine as X, RiArrowDownSLine as ChevronDown } from "@remixicon/react";
import { Badge } from "./badge";
import { Command, CommandGroup, CommandItem, CommandList } from "./command";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "./lib/utils";

type Option = {
    label: string;
    value: string;
};

interface MultiSelectProps {
    options: Option[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
}

export function MultiSelect({ options, selected, onChange, placeholder = "Select...", className }: MultiSelectProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState("");

    const handleUnselect = (value: string) => {
        onChange(selected.filter((s) => s !== value));
    };

    const handleSelect = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((s) => s !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const selectedLabels = selected.map(s => options.find(o => o.value === s)?.label).filter(Boolean);

    return (
        <Command className={cn("overflow-visible bg-transparent h-auto relative", open && "z-50", className)}>
            <div
                className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-border/50 bg-secondary/30 px-3.5 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary focus-within:bg-card cursor-text transition-all duration-200"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    inputRef.current?.focus();
                    setOpen(true);
                }}
            >
                <div className="flex gap-1 flex-wrap">
                    {selected.map((item) => {
                        const option = options.find((o) => o.value === item);
                        return (
                            <Badge key={item} variant="secondary" className="hover:bg-secondary bg-background border-border/50 rounded-full py-0.5 px-1.5 text-xs font-medium">
                                {option?.label ?? item}
                                <button
                                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleUnselect(item);
                                        }
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    onClick={() => handleUnselect(item)}
                                >
                                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </button>
                            </Badge>
                        );
                    })}
                </div>
                <CommandPrimitive.Input
                    ref={inputRef}
                    value={inputValue}
                    onValueChange={setInputValue}
                    onBlur={() => setOpen(false)}
                    onFocus={() => setOpen(true)}
                    placeholder={selected.length === 0 ? placeholder : undefined}
                    className="bg-transparent outline-none placeholder:text-muted-foreground flex-1 min-w-[50px] py-1 text-sm"
                />
                <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
            </div>
            <div className="relative mt-1.5 z-50">
                {open && options.length > 0 ? (
                    <div className="absolute w-full z-50 top-0 rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-elevated outline-none animate-in fade-in-0 zoom-in-95 duration-150">
                        {/* Prevent blur when clicking on the list */}
                        <CommandList
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            <CommandGroup className="max-h-64 overflow-auto">
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        onSelect={() => {
                                            handleSelect(option.value);
                                            setInputValue("");
                                        }}
                                        className="cursor-pointer"
                                        // Also prevent blur here just in case
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                    >
                                        <div
                                            className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${selected.includes(option.value)
                                                ? "bg-primary text-primary-foreground"
                                                : "opacity-50 [&_svg]:invisible"
                                                }`}
                                        >
                                            <svg
                                                className="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </div>
                                        <span>{option.label}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </div>
                ) : null}
            </div>
        </Command>
    );
}
