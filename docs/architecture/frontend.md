# Frontend Architecture

## Page routing — `src/App.tsx`

Routing is a flat `react-router-dom` `<Routes>` tree inside a `BrowserRouter`. The provider nesting order (outer to inner) is:

```
ThemeProvider (next-themes, class attribute, light default, system-aware)
  QueryClientProvider (one shared QueryClient for the whole app)
    WorkspaceProvider (multi-company context — see below)
      TooltipProvider (@sordi/ui)
        LanguageBootstrap (reconciles i18next with the DB-backed setting; renders nothing)
        Toaster (sonner)
        LicenseBanner (shows a banner when the license is read-only/inactive)
        BrowserRouter
          Routes
```

`/auth` is the only route outside the `ProtectedRoute` gate. Every other route is nested under `<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>`, so `AppLayout` (sidebar + header + `<Outlet>`) wraps every authenticated page. `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) reads `useAuth()` and redirects to `/auth` if there's no active session.

Several routes are intentionally duplicated: a canonical path (e.g. `/invoices`) and a "sidebar-tree" alias (e.g. `/factures`) point at the exact same page component. This exists because the sidebar was restructured into a tree hierarchy (VENTES & CLIENTS, ACHATS & CHARGES, etc. — see [`docs/ui-ux/design-language.md`](../ui-ux/design-language.md)) without renaming the underlying routes that the rest of the app's `navigate()`/`<Link>` calls already depended on — so both paths resolve to the same component rather than one canonical route being renamed everywhere.

## The hooks layer pattern

Every business entity has a dedicated file in `src/hooks/` (see the [full hooks reference](./hooks-reference.md)) that wraps TanStack Query around the `db` object from `src/lib/database.ts`. The pattern is consistent across all 36 hook files:

```ts
// apps/desktop/src/hooks/useInvoices.ts (abridged)
export function useInvoices(status?: InvoiceStatus, invoiceType?: InvoiceType) {
  const { activeCompanyId } = useWorkspace();
  return useQuery({
    queryKey: ["invoices", activeCompanyId, status, invoiceType],
    queryFn: () => db.invoices.getAll(activeCompanyId, status, invoiceType),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useWorkspace();
  return useMutation({
    mutationFn: async (data: CreateInvoiceData) => {
      const validated = createInvoiceSchema.parse(data);           // Zod validation
      return await db.invoices.create({ ...validated, company_id: activeCompanyId });
    },
    onSuccess: (invoice, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      db.history.log({ action: "CREATE", entity_type: "INVOICE", entity_id: invoice.id, description: /* ... */ });
      toast.success(/* French success message */);
    },
    onError: (error) => { /* toast.error + logError */ },
  });
}
```

Every mutation hook in the codebase follows this same shape: Zod-validate → call `db.<entity>.<verb>()` → on success, invalidate the relevant query keys (always including its own list, usually `dashboard-stats`, sometimes cross-entity keys like `client-products`) → write an entry via `db.history.log()` → show a French `sonner` toast. This consistency is what makes the [hooks reference](./hooks-reference.md) enumerable at a glance — nearly every hook file is the same template applied to a different entity.

## The `db` object and `safeInvoke` — `src/lib/database.ts`

This ~1450-line file is the single seam between the React frontend and the Rust backend. Two things make it work in both a real Tauri window and a plain browser (used for local web-preview development without building the Tauri shell):

```ts
const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

async function safeInvoke<T>(cmd: string, args?: Record<string, any>, fallbackFn?: () => T | Promise<T>): Promise<T> {
  if (!isTauri) {
    if (fallbackFn) return fallbackFn();
    throw new Error(`Command ${cmd} not available in web mode`);
  }
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`Tauri invoke "${cmd}" failed, using fallback:`, err);
    if (fallbackFn) return fallbackFn();
    throw err;
  }
}
```

Every entry point on the exported `db` object (`db.clients`, `db.invoices`, `db.contracts`, `db.companies`, `db.license`, `db.search`, `db.history`, ...) is a thin method that calls `safeInvoke("<tauri_command_name>", args, fallbackFn)`. The `fallbackFn` reads/writes an in-memory `mockStore` (`src/lib/mockStore.ts`) so the app remains partially usable when opened as a plain web page (e.g. for UI-only development) with no Tauri runtime and no Rust backend behind it. This is also, incidentally, why `safeInvoke` catching a *failed* invoke and silently falling back matters: a real command failure in the Tauri window (e.g. a license-gate rejection) still surfaces because most `db` methods pass no `fallbackFn` for mutating calls, so the `catch` block re-throws instead of masking the error.

The `db` object is organized into namespaces mirroring the backend's command groups: `db.companies`, `db.clients`, `db.suppliers`, `db.products`, `db.invoices`, `db.payments`, `db.orders`, `db.deliveryNotes`, `db.expenses`, `db.settings`, `db.employees`, `db.payroll`, `db.projects`, `db.contracts`, `db.partners`, `db.license`, `db.search`, `db.history`, etc. — a 1:1 mapping onto the Tauri command groups documented in [`command-reference.md`](./command-reference.md).

## Workspace / multi-company context — `src/hooks/useWorkspace.tsx`

`WorkspaceProvider` is the mechanism that makes "one installation, several company workspaces" work:

- On mount, it fetches `db.companies.getAll()` once with a 5-minute `staleTime` (companies rarely change, and the whole app blocks on this resolving before any company-scoped query fires).
- The selected `activeCompanyId` is held in React state and mirrored to `localStorage` (`sordi.workspace.activeCompanyId`), so the last-used workspace persists across app restarts.
- If the stored id doesn't match any company that actually exists (e.g. the app was reinstalled, or the database came from a different machine), it silently falls back to the first company in the list.
- `switchCompany(id)` updates state, persists it, and calls a **blanket `queryClient.invalidateQueries()`** with no arguments — because every company-scoped hook includes `activeCompanyId` in its query key, this single call is enough to guarantee no stale cross-company data is left rendered anywhere in the app after a switch, without having to enumerate every affected query key by hand.
- `useWorkspace()` throws if called outside the provider — the same fail-fast convention the codebase uses for its other context hooks, catching a missing-provider bug at the first render instead of silently returning `undefined`.

Every company-scoped hook (`useClients`, `useInvoices`, `useProjects`, etc.) calls `useWorkspace()` to read `activeCompanyId`, both to filter its query and to stamp it onto new records on create.

## PDF generation pipeline

Sordi has **two parallel PDF generation paths**, both wired through `src/lib/pdfGenerator.ts`:

1. **React-tree rendering** via `@react-pdf/renderer`. Document components live in `src/components/pdf/`: `InvoicePDFDocument.tsx`, `InvoiceTemplateEpure.tsx`, `InvoiceTemplateModerne.tsx` (the three selectable invoice themes — Settings' "Apparence & Logo" tab lets the user pick `structure`/`epure`/`moderne`, matching these three components 1:1 via an `INVOICE_PDF_TEMPLATES` lookup table), plus `DeliveryNotePDFDocument.tsx`, `ContractPDFDocument.tsx`, `PayrollPDFDocument.tsx`, `BulletinPaiePDFDocument.tsx` (individual payslip), `CumulativesPDFDocument.tsx`, `MonthlyReportPDF.tsx` (the partners' monthly closing report), and shared types/helpers in `invoicePdfShared.ts`. `pdf(<Document/>)` from `@react-pdf/renderer` renders these to a `Blob`/base64 client-side, entirely in the webview — no round-trip to Rust.
2. **HTML-to-PDF via the Rust backend** (`generate_pdf` Tauri command, backed by `headless_chrome` in `src-tauri/src/pdf_service.rs`) for cases needing a full headless-Chromium rendering pass rather than `@react-pdf/renderer`'s more constrained PDF primitive set — the command takes raw HTML and returns a base64 PDF.

Once a PDF is generated (by either path) as a base64 string, the same small set of Tauri commands takes over for the filesystem/OS side: `open_pdf` (open in the OS default viewer), `save_pdf` (write to Downloads), `save_pdf_to_path` (write to an exact path from a native save dialog via `tauri-plugin-dialog`), and `open_file_path` (open an arbitrary existing file). `save_pdf_backup` additionally files a copy into a per-client folder under a user-configured backup root directory, for the agency's own document retention.

`html2canvas` + `jsPDF` also appear as dependencies, used for a couple of raster-based PDF/export paths (e.g. bulk table exports) distinct from the vector `@react-pdf/renderer` documents.

## Internationalization (i18n)

`src/i18n/` holds the i18next setup (`index.ts`, `languages.ts`) and locale bundles under `locales/fr/` and `locales/ar/`, split into per-domain namespace files: `common.json`, `navigation.json`, `invoicing.json`, `partners.json`. French (`fr`) is the default/primary language (all business copy — toasts, labels, page titles — is written in French throughout the codebase, not just in the locale files); Arabic (`ar`) is the second supported language and drives right-to-left layout via `useLanguage()`'s `isRtl` flag, which several components (notably `Sidebar.tsx`) read directly to mirror icons, translate/hover directions, and border sides (`ms-`/`me-`/`ps-`/`pe-` logical Tailwind properties are used throughout rather than hardcoded `ml-`/`mr-`, precisely so the RTL flip works without duplicating styles). `useLanguage()` (`src/hooks/useLanguage.ts`) is the single source of truth reconciling i18next's in-memory language, a `localStorage` cache, and the durable `settings.current_language` value stored in the database — so the chosen language survives both a page reload and an app reinstall-with-restored-database.

## Validation layer

`src/lib/validations.ts` holds Zod schemas (`clientSchema`, `createInvoiceSchema`, etc.) used by the mutation hooks before any data reaches `db.<entity>.create/update()`. This is a client-side convenience layer only — the authoritative validation and business rules (tax calculation, numbering, license gating) live in the Rust backend, since the frontend's TypeScript types and Zod schemas can't be trusted as the only line of defense in an architecture where the IPC boundary is the real security/consistency boundary.
