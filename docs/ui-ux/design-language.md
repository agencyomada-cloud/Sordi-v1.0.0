# Design Language

Source: `apps/desktop/src/index.css` (CSS custom properties / Tailwind theme tokens) and `apps/desktop/src/components/layout/Sidebar.tsx` (navigation structure). All values below are read directly from these files, not estimated.

## Brand identity: "Crimson/Coral Red rebrand"

The in-code comments explicitly name this palette the "Crimson/Coral Red rebrand," replacing an earlier "Electric Indigo" primary color. The signature accent is:

- **Primary / accent (Coral Red)**: `#EB3B48` — HSL `356 81% 58%` — used for primary buttons, the active sidebar-nav highlight, focus rings, chart series 1, and the elevated-shadow glow.
- **Primary hover/pressed**: `#D82F3C` — HSL `355 68% 52%`.
- **Accent-soft tint**: `#FDF1F2` — HSL `355 75% 97%` — the pale background used behind active/hovered sidebar nav items and other "soft highlight" surfaces, rather than a solid full-saturation fill. This softer treatment (a tinted pill instead of a loud solid block) is a deliberate, commented design decision in the Sidebar component.

## Light mode tokens

| Token | HSL | Approx. hex | Usage |
|---|---|---|---|
| `--background` | `210 22% 96%` | `#F4F6F8` | Page canvas |
| `--foreground` | `224 25% 11%` | near-black | Body text |
| `--card` | `0 0% 100%` | `#FFFFFF` | Card surfaces, one level above the tinted background |
| `--primary` / `--accent` | `356 81% 58%` | `#EB3B48` | Brand accent (buttons, active states, focus) |
| `--primary-hover` | `355 68% 52%` | `#D82F3C` | Hover/pressed accent |
| `--accent-soft` | `355 75% 97%` | `#FDF1F2` | Soft tint behind active/hover nav items |
| `--secondary` / `--muted` | `222 18% 94%` | light slate | Secondary surfaces, muted backgrounds |
| `--destructive` | `0 84% 60%` | red | Destructive actions — deliberately a *different* red from the brand accent, so destructive actions still read as their own semantic color rather than just "the brand color" |
| `--warning` | `38 92% 50%` | amber | Warning states |
| `--border` / `--input` | `222 20% 90%` | slate hairline | Borders, input outlines |
| `--status-paid` / `--status-paid-bg` | `160 84% 33%` / `160 60% 95%` | emerald | "Paid" status |
| `--status-pending` / `-bg` | `38 92% 50%` / `38 60% 95%` | amber | "Pending" status |
| `--status-unpaid` / `-bg` | `0 84% 60%` / `0 30% 96%` | red | "Unpaid" status |
| `--status-draft` / `-bg` | `222 10% 46%` / `222 18% 94%` | slate | "Draft" status |
| `--chart-1` … `--chart-5` | Coral Red, Amber, Emerald, Red, Purple | | Chart series colors, brand color first then distinct hues for legibility |
| `--radius` / `-sm` / `-lg` / `-xl` / `-full` | 10px / 8px / 16px / 20px / 9999px | | A "soft/rounded" system-wide radius scale, explicitly chosen (per in-code comment) to replace a flatter, more "minimal corporate" 6px-everywhere look with a softer, modern SaaS feel |

## Dark mode tokens

Dark mode exists as a complete token set (`.dark` class selector) but — per an explicit in-code comment — **no UI toggle is wired up yet**; `next-themes` is configured with `enableSystem`, so dark mode currently only activates by following the OS-level color scheme preference, not via any in-app switch.

| Token | HSL | Approx. hex |
|---|---|---|
| `--background` | `220 13% 5%` | `#0A0B0D` |
| `--card` | `225 10% 8%` | `#121316` |
| `--primary` / `--accent` | `356 81% 66%` | lighter coral, boosted lightness for dark-surface contrast |
| `--accent-soft` | `355 30% 14%` | dark-mode equivalent tint |
| `--destructive` | `0 62% 40%` | deeper red |

## Typography

- **Google Fonts (loaded but not the app chrome font)**: Montserrat, Inter, Poppins, Roboto — these remain available specifically as **selectable PDF document fonts** (Settings → Apparence & Logo → font picker for invoice/delivery/order documents), not for the app's own UI.
- **App UI chrome typeface**: **Plus Jakarta Sans** (Latin/French) paired with **Readex Pro** (Arabic) — both self-hosted via `@fontsource` rather than a Google Fonts CDN import, a deliberate choice for an offline-first desktop app so the UI font isn't a hard network dependency.
- **Tabular/financial-figure pairing**: **JetBrains Mono** and **Space Grotesk**, self-hosted the same way, used wherever numeric figures need fixed-width digit alignment (the `.stat-number` utility class combines `font-mono` with `tabular-nums`).
- **Body copy**: 1.5x line-height — the in-code comment notes this matters more than usual because the app's chosen typeface's tall x-height reads cramped at tighter line-heights.
- **Headings**: tighter (1.2x) line-height than body copy, `font-semibold` (not bold) with tight letter-tracking and `text-wrap: balance` (so multi-line titles don't leave a lonely orphan word on the last line) — the in-code comment explicitly references this as the same restrained-weight convention used by Linear/Stripe/Raycast, versus a heavier bold treatment.
- **Tables**: `tabular-nums` applied at the table level so money/quantity columns align vertically digit-by-digit rather than shifting per proportional character width.

## Shadows

Four shadow tokens layer subtlety with a brand-tinted glow reserved for elevated/primary elements: `--shadow-soft` and `--shadow-card` are neutral, low-opacity black shadows for ordinary card elevation; `--shadow-elevated` and `--shadow-glow` are tinted with the Coral Red accent color (`rgba(235, 59, 72, ...)`) and reserved for elements that should visually pop as "the important thing on screen" (e.g. a primary CTA), rather than applied indiscriminately.

## Sidebar navigation structure

Source: `apps/desktop/src/components/layout/Sidebar.tsx` + `apps/desktop/src/i18n/locales/fr/navigation.json` (exact French labels, not paraphrased).

The sidebar is a bespoke component (not built on `@sordi/ui`'s generic `Sidebar` primitive — see [`docs/design-system/component-catalogue.md`](../design-system/component-catalogue.md)), organized as a tree hierarchy: a single top-level "Vue d'ensemble" (Dashboard) entry, followed by five collapsible groups, plus a pinned "Système" group at the very bottom that never scrolls out of view:

| Group (i18n key) | French label | Links |
|---|---|---|
| *(top item)* | Tableau de bord | Dashboard (`/`) |
| `groups.sales` | **Ventes & Clients** | Facturation, Devis, Livraisons, Contrats, Clients |
| `groups.purchasing` | **Achats & Charges** | Dépenses & Charges, Fournisseurs, Commandes |
| `groups.operations` | **Gestion & Opérations** | Projets, Équipe & Salaires, Catalogue & Services |
| `groups.pilotage` | **Pilotage & RH** | Paiements, Analyses & Rapports, Employés & Contrats, Associés & Dividendes |
| `groups.system` | **Système** *(pinned)* | Paramètres Entreprise, Historique d'activité, Intégrations & Sauvegardes |

Notable UX details:
- Each group header is independently collapsible (state persisted to `localStorage` under `sordi.sidebar.collapsedGroups`), and collapsed-group state is remembered across sessions.
- The whole sidebar can also collapse to an icon-only rail (a separate, narrower mode from group-collapsing), animating width/opacity rather than snapping instantly.
- A ⌘K / Ctrl+K command palette (built on `@sordi/ui`'s `Command` primitives) is reachable from a search field at the top of the sidebar, searching both static page names and live client/invoice records via `useGlobalSearch`.
- Active nav items get the soft accent-tint treatment (`bg-sidebar-accent` / coral text) plus a small horizontal nudge (`translate-x-1`, mirrored in RTL) rather than a heavier solid-fill selected state.
- Badge counts (small numeric pills) appear next to Commandes, Facturation, Livraisons, and Historique, sourced from `useSidebarCounts()` (unpaid invoices, pending orders, un-invoiced deliveries, unread history entries) rather than separate backend endpoints.
- Full RTL support: `isRtl` (from `useLanguage()`) flips hover-translate direction, mirrors the collapse-toggle chevron, and the codebase uses Tailwind's logical properties (`ms-`/`me-`/`ps-`/`pe-`, "start"/"end" instead of "left"/"right") throughout so Arabic mode doesn't require a parallel set of styles.

## Print / PDF layout

`index.css` also defines an A4 (`210mm x 297mm`) print stylesheet (`@page`, `@media print`) that hides all app chrome (nav, header, buttons) and shows only the invoice/document print view — used for the browser-native print path, distinct from (and simpler than) the dedicated `@react-pdf/renderer`/headless-Chromium PDF generation pipeline described in [`docs/architecture/frontend.md`](../architecture/frontend.md#pdf-generation-pipeline).
