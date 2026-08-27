# `@sordi/ui` Component Catalogue

Shared shadcn/Radix-based React component library for Sordi, a Tauri desktop ERP app. Location: `packages/ui/src/`. All components are exported via `packages/ui/src/index.ts` (`export * from "./<file>"`), plus two special cases: `Toaster`/`toast` are re-exported from `./sonner`, and `cn` is re-exported individually from `./lib/utils`.

**Public API note**: `index.ts` has a harmless duplicate `export * from "./calendar"` line. Every one of the 49 source files is re-exported — the package's public surface is 1:1 with its file list. The stock shadcn `toast.tsx`/`toaster.tsx`/`hooks/use-toast.ts` trio was deliberately removed as dead code; all toast UI in the app goes through `sonner` directly via the `Toaster`/`toast` exports.

## Layout & Structure

### Card
`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` — generic content container, the base surface for panels, dashboard tiles, and form sections. `Card` is `rounded-2xl` with a subtle border and soft shadow (a light inset top highlight); dark mode swaps to a faint top-edge border. `CardHeader` is `p-6 space-y-1.5`; `CardTitle` is an `<h3>`; `CardContent` is `p-6 pt-0`; `CardFooter` is a flex row, `p-6 pt-0`.

### Separator
`Separator` — thin divider line. Props: `orientation: "horizontal" | "vertical"` (default horizontal), `decorative` (default true).

### Aspect Ratio
`AspectRatio` — thin Radix wrapper enforcing a fixed width/height ratio on its child.

### Scroll Area
`ScrollArea`, `ScrollBar` — custom-styled scrollable viewport with a themed thin scrollbar/thumb, replacing native OS scrollbars. `ScrollBar` accepts `orientation: "vertical" | "horizontal"`.

### Resizable
`ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` — drag-resizable split-pane layout (wraps `react-resizable-panels`). `ResizableHandle` takes `withHandle` to render a visible grip dot.

### Sidebar
`SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarRail`, `SidebarInset`, `SidebarInput`, `SidebarHeader`, `SidebarFooter`, `SidebarSeparator`, `SidebarContent`, `SidebarGroup`, `SidebarGroupAction`, `SidebarGroupContent`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuButton`, `SidebarMenuItem`, `SidebarMenuSkeleton`, `SidebarMenuSub`, `SidebarMenuSubButton`, `SidebarMenuSubItem`, `useSidebar` — the full collapsible app-shell sidebar block (stock shadcn pattern). Persists open/collapsed state to a cookie (`sidebar:state`), auto-collapses to an off-canvas `Sheet` on mobile, supports Cmd/Ctrl+B. `Sidebar` props: `side: "left" | "right"`, `variant: "sidebar" | "floating" | "inset"`, `collapsible: "offcanvas" | "icon" | "none"`. `SidebarMenuButton`: `variant: "default" | "outline"`, `size: "default" | "sm" | "lg"`, with a `tooltip` prop shown only when collapsed to icon rail. Widths are CSS vars (`--sidebar-width`: 16rem/18rem mobile, `--sidebar-width-icon`: 3rem).

Note: the desktop app's actual sidebar (`apps/desktop/src/components/layout/Sidebar.tsx`) is a bespoke component, not built on this primitive — see [`docs/ui-ux/design-language.md`](../ui-ux/design-language.md).

### Table
`Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption` — dense data-table primitive styled for a compact look (11px uppercase micro-label headers, sticky+blurred header on scroll). `TableRow` has a custom `dimmed?: boolean` prop that visually recedes archived/cancelled/void rows without hiding them. `TableHead`/`TableCell` both accept a custom `numeric?: boolean` prop that right-aligns and switches to tabular/mono figures for numeric columns.

## Forms & Inputs

### Button
`Button`, `buttonVariants` — the primary interactive control, supports `asChild` (Radix `Slot`).
- `variant`: `"default" | "destructive" | "outline" | "secondary" | "ghost" | "link"`
- `size`: `"default" | "sm" | "lg" | "icon"`
- Fully rounded (`rounded-full`) at every size; `default` variant has a soft-to-elevated shadow lift plus an inset glass highlight on hover.

### Input
`Input` — styled text input (`rounded-xl`, `h-11`, secondary background that brightens/rings on focus).

### Textarea
`Textarea` — styled multiline text input, `min-h-[80px]`.

### Label
`Label` — Radix `Label.Root` wrapper, `text-sm font-medium`, dims when its paired control is disabled.

### Checkbox
`Checkbox` — square checkbox with a check-icon indicator when checked.

### Radio Group
`RadioGroup`, `RadioGroupItem` — circular radio buttons in a `grid gap-2` group, filled-dot indicator when selected.

### Switch
`Switch` — toggle switch, `h-6 w-11` pill track, thumb slides on checked state.

### Slider
`Slider` — Radix range slider with a filled track and draggable thumb.

### Select
`Select`, `SelectGroup`, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectLabel`, `SelectItem`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton` — dropdown/listbox (Radix Select). `SelectTrigger` matches Input's styling (`rounded-xl`, `h-11`); `SelectContent` supports `position: "popper" | "item-aligned"` (default popper).

### Multi Select
`MultiSelect` — **custom.** Combobox-style multi-value picker built on `cmdk`'s `Command` primitive: selected values render as removable `Badge` chips inside the field, typing filters a dropdown list. Props: `options: {label, value}[]`, `selected: string[]`, `onChange: (selected: string[]) => void`, `placeholder?`, `className?`.

### Search Input
`SearchInput` — **custom.** Wraps `Input` with a fixed left search icon and a conditional right "clear" button (shown only when there's a value). Props: `value: string`, `onChange: (value: string) => void` (takes the string directly, not an event), `containerClassName?`, plus other Input props. Default placeholder is French: `"Rechercher..."`.

### Input OTP
`InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator` — one-time-passcode input (wraps `input-otp`). `InputOTPSlot` takes an `index` and renders a blinking caret when active.

### Form
`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField` — React Hook Form integration (stock shadcn form kit). `Form` = `FormProvider`; `FormField` wraps RHF's `Controller`; `FormLabel`/`FormMessage` auto-wire ARIA attributes and error-driven styling via context.

### Toggle / Toggle Group
`Toggle`, `toggleVariants` — single pressable toggle. `variant: "default" | "outline"`, `size: "default" | "sm" | "lg"`. `ToggleGroup`, `ToggleGroupItem` — group of toggles sharing one variant/size via context.

### Calendar
`Calendar` — date picker (wraps `react-day-picker`). Custom-styled month grid: rounded-lg pill for the selected day (not a full circle), muted-secondary for today, custom chevron icons. Accepts all `DayPicker` props passed through unchanged.

## Feedback & Status

### Alert
`Alert`, `AlertTitle`, `AlertDescription` — static inline banner (`role="alert"`). `variant: "default" | "destructive"`.

### Badge
`Badge`, `badgeVariants` — small general-purpose pill/chip (not status-specific — see StatusBadge below for that use case).
- `variant`: `"default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "error" | "draft"`
- `success`/`warning`/`error` are low-opacity alpha-tinted chips (emerald/amber/rose), reserved for things like an equity-percentage tag rather than true status pills.
- `draft` = muted border/background/text.

### Progress
`Progress` — horizontal progress bar (Radix Progress), `value` 0–100. Extra `indicatorClassName?` prop to style the filled portion separately from the track.

### Skeleton
`Skeleton` — plain pulsing placeholder block. Building block for custom loading states elsewhere.

### Loading State — custom
`LoadingState`, `TableLoading`.
- `LoadingState`: centered spinner + message text. Prop: `message?` (default `"Chargement..."`).
- `TableLoading`: renders placeholder `TableRow`/`TableCell` skeletons for a table mid-fetch. Props: `columns?` (default 6), `rows?` (default 5), `numericColumns?: number[]` (right-aligns the skeleton bar for columns that will hold numeric data, avoiding layout shift). Uses a fixed (non-random) width cycle per column/row.

### Empty State — custom
`EmptyState` — "nothing here yet" placeholder for empty lists/tables, with entity-aware default icons.
- Props: `title` (required), `description?`, `icon?: React.ElementType`, `type?`, `action?: {label, onClick}`, `className?`, `size?: "default" | "compact"`.
- `type` maps to domain entities, each with its own Remix icon mirroring the sidebar nav icon for that section: `invoices`, `clients`, `suppliers`, `products`, `deliveries`, `payments`, `expenses`, `orders`, `projects`, `history`, `partners`, `payroll`, `employees`, `default` (fallback).
- `size: "compact"` fits inside a card body (e.g. a dashboard chart card): smaller icon badge, body-weight text, small outline button. `"default"` is the full-page/full-table treatment (64px icon circle, heading text, default button).

### Status Badge — custom, domain-specific
`StatusBadge`, `StatusDot`, `statusBadgeVariants`, type `StatusBadgeTone`. Implements a neutral monochrome pill (same background/text regardless of status) carrying a small 5px colored dot to indicate actual status — this replaced an older alpha-tinted colored-`Badge` approach for genuine status indicators.
- `StatusBadgeTone = "success" | "warning" | "error" | "neutral"` — this is the **tone enum**, not literal business statuses. Callers map their own domain status (invoice paid/unpaid, order fulfilled/pending, etc.) onto one of these 4 tones: `success` → emerald dot, `warning` → amber dot, `error` → rose dot, `neutral` → muted dot (default).
- `StatusBadge` renders a `<div>` + `<StatusDot>` + label text; `StatusDot` is exported separately for standalone reuse.
- `statusBadgeVariants({className})` is a pure className generator for the rare case the chip must render as a non-`div` element.

### Sonner (Toast)
`Toaster`, `toast` — wraps the `sonner` toast library, theme-aware (via `next-themes`), positioned bottom-right, `richColors` + `closeButton` + `expand` enabled, 3.5s default duration, rounded/card-matched styling. This is the app's only toast system.

## Overlays & Dialogs

### Dialog
`Dialog`, `DialogPortal`, `DialogOverlay`, `DialogClose`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` — modal dialog (Radix Dialog). `DialogOverlay` is a blurred translucent scrim; `DialogContent` is a glass panel (`bg-popover/90 backdrop-blur-md`, `rounded-2xl`) centered on screen, with a built-in close (X) button.

### Alert Dialog
`AlertDialog`, `AlertDialogPortal`, `AlertDialogOverlay`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel` — confirmation/blocking dialog, same glass-panel treatment as Dialog but requires an explicit action (no free-dismiss overlay click). `AlertDialogAction` uses default button styling; `AlertDialogCancel` uses outline. No built-in close X.

### Sheet
`Sheet`, `SheetTrigger`, `SheetClose`, `SheetPortal`, `SheetOverlay`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription` — slide-in panel from a screen edge (built on Radix Dialog). `SheetContent` prop `side: "top" | "bottom" | "left" | "right"` (default right); left/right variants are `w-3/4` capped at `sm:max-w-sm`.

### Drawer
`Drawer`, `DrawerTrigger`, `DrawerPortal`, `DrawerClose`, `DrawerContent`, `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription` — bottom-sheet-style drawer (wraps `vaul`). `shouldScaleBackground` defaults true. Includes a drag handle bar.

### Popover
`Popover`, `PopoverTrigger`, `PopoverContent` — floating panel anchored to a trigger, `w-72`, same glass-panel styling as Dialog. Props `align` (default center), `sideOffset` (default 4).

### Hover Card
`HoverCard`, `HoverCardTrigger`, `HoverCardContent` — floating preview card on hover, `w-64`.

### Tooltip
`Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` — small hover/focus label, compact glass-panel styling (`px-3 py-1.5 text-xs`). `TooltipProvider` wraps the whole app in `App.tsx`.

### Dropdown Menu
`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`, `DropdownMenuRadioGroup` — contextual action menu, same glass-panel treatment as Dialog. Item/SubTrigger/Label support an `inset?: boolean` prop for icon-alignment indentation.

### Context Menu
`ContextMenu` + full family (mirrors Dropdown Menu's API) — right-click menu, flat/opaque popover styling (not glass), triggered by right-click/long-press.

### Menubar
`Menubar` + full family — horizontal app-menubar (File/Edit-style), same submenu/checkbox/radio item family as Dropdown/Context menus.

### Command
`Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut`, `CommandSeparator` — command-palette/fuzzy-search list (wraps `cmdk`). `CommandDialog` wraps it in a `Dialog` for the Cmd+K palette; takes `shouldFilter?: boolean` to disable cmdk's built-in fuzzy filtering when the consumer filters itself (e.g. server-side search). This is what powers the sidebar's `⌘K` command palette, and what `MultiSelect` is built directly on top of.

## Navigation

### Breadcrumb
`Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis` — standard breadcrumb trail. `BreadcrumbSeparator` defaults to a chevron-right icon. `BreadcrumbPage` marks the current page with `aria-current="page"`.

### Pagination
`Pagination`, `PaginationContent`, `PaginationEllipsis`, `PaginationItem`, `PaginationLink`, `PaginationNext`, `PaginationPrevious` — page-number navigation. `PaginationLink` takes `isActive?: boolean` (outline variant when active, ghost otherwise).

### Tabs
`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — standard Radix Tabs; the active tab gets a background + shadow.

### Navigation Menu
`NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuContent`, `NavigationMenuTrigger`, `NavigationMenuLink`, `NavigationMenuIndicator`, `NavigationMenuViewport`, `navigationMenuTriggerStyle` — full mega-menu-style navigation with animated viewport and arrow indicator.

## Data Display

### Avatar
`Avatar`, `AvatarImage`, `AvatarFallback` — circular user/entity image with fallback, `h-10 w-10` default.

### Accordion
`Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` — expand/collapse sections, chevron rotates 180° when open.

### Collapsible
`Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` — bare Radix Collapsible passthrough, no custom styling (lower-level than Accordion).

### Carousel
`Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext`, type `CarouselApi` — slideshow (wraps `embla-carousel-react`). Props: `orientation: "horizontal" | "vertical"`, `opts`, `plugins`, `setApi`. Keyboard arrow-key navigation built in.

### Chart
`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle`, type `ChartConfig` — Recharts wrapper providing themed containers/tooltips/legends driven by a single `ChartConfig` object (`{[key]: {label?, icon?, color?} | {label?, icon?, theme: {light, dark}}}`).
- `ChartContainer` injects the config into context and generates scoped CSS variables (`--color-<key>`) per chart instance, themed independently per light/dark mode.
- Security note: `ChartStyle` sanitizes CSS custom-property keys and color values via regex allow-lists (hex/rgb/hsla/named colors/`var()`/`hsl(var())`) before injecting them into a `<style dangerouslySetInnerHTML>` block — comments in the source explicitly note `ChartConfig` must come from developer-defined config, never raw user input, treating this sanitization as defense-in-depth only.
- `ChartTooltipContent`: `indicator: "line" | "dot" | "dashed"` (default dot), plus `hideLabel`, `hideIndicator`, `nameKey`, `labelKey`, `formatter`, `labelFormatter`.

## Hooks & Utilities (non-component)

- **`hooks/use-mobile.tsx`**: `useIsMobile()` — returns `true` when viewport width < 768px, reactive via `matchMedia`. Used internally by `Sidebar` to switch to the mobile Sheet-based layout.
- **`lib/utils.ts`**: `cn(...inputs: ClassValue[])` — the standard shadcn class-merging helper (`clsx` + `tailwind-merge`), used by virtually every component for `className` composition/override.

## Summary

All 49 source files are re-exported from `index.ts` with no orphaned files and no missing exports. The library is a fairly standard shadcn/Radix base (Dialog, Select, Table, Form, etc.) plus a small set of genuinely custom, domain-aware components — `StatusBadge`/`StatusDot`, `EmptyState`, `LoadingState`/`TableLoading`, `SearchInput`, and `MultiSelect` — that encode Sordi-specific UX conventions (French default copy, entity-aware icons, the neutral-pill-plus-dot status treatment) rather than being generic shadcn boilerplate.
