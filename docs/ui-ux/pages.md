# Pages Reference

Written descriptions of the screens in `apps/desktop/src/pages/`, based on reading the actual page components. The most central pages are described in full paragraphs; less central ones get a one-line summary.

## Dashboard — `Index.tsx`

The main landing page after login, organized into five vertically stacked "tiers." Tier 1 is a header row with quick period-preset pills (Ce mois / Ce trimestre / Cette année), a year selector, a "Vue Globale" vs "Comparaison vs N-1" toggle, and a refresh button. Tier 2 is a borderless 4-cell KPI ribbon (Chiffre d'Affaires HT, Charges Réelles, Bénéfice Net, Trésorerie), each with a small animated number (`useCountUp`), a trend-delta badge in comparison mode, and a micro-sparkline. Tier 3 is a 12-column grid: an 8-column diverging bar chart ("Flux de Trésorerie & Marges," current month highlighted in the brand Crimson/Coral Red `#EB3B48`, other months muted gray) beside a 4-column donut chart ("Répartition par Projet," top 5 projects plus an "Autres" bucket). Tier 4 pairs an 8-column "Santé & Rentabilité des Projets" list (per-project budget-consumption bar, team avatar stack, margin % badge, status badge) with a 4-column "Activité Récente" timeline fed from the activity log. Tier 5 is a full-width table of "Factures & Échéances en attente" (pending/overdue invoices sorted by due date). All figures are French-locale-formatted DZD ("XXX XXX DA").

## Invoices — `Invoices.tsx`

The list page for all billing documents (factures, proformas, avoirs), with six filter tabs (Toutes, Factures, Proformas, Avoirs, Payées, Impayées) synced to the URL's `?tab=` param. Header actions create an Avoir (credit note), a Proforma, or a new Facture. Below the tabs is a sort dropdown (date/N°/client/montant, asc/desc) and a search box, then a bulk-action bar (visible once rows are checked) offering "Marquer comme payées," "Télécharger en lot" (ZIP export), and "Supprimer la sélection." The table shows N°, Client, Date, Montant, and a clickable status badge (dropdown to set Payée/Émise/Brouillon/Annulée inline) plus per-row hover actions: copy ID, download PDF, and a "..." menu (Voir détails, Envoyer par email, Modifier, Convertir en Facture, Paiement, Avoir, Supprimer).

## Invoice detail — `InvoiceDetail.tsx`

Single-document view toggling between a rendered document "Aperçu" (default) and a "Vue détail" stats breakdown (Sous-total HT, Remise, Total TVA, Timbre, Total TTC cards, then an items table, payment info, notes). The header title/number is inline-editable (click to edit), shows a status badge, and includes an omada-agency-branch-only project-assignment dropdown ("Aucun projet" / pick a project) that links the invoice into a project's derived budget. Action buttons: toggle preview mode, "Aperçu PDF Vectoriel," Imprimer, Télécharger, Envoyer par Email, and a "Plus Actions" dropdown (Enregistrer Paiement, Créer un Avoir, Générer Bon de Livraison, Convertir en Facture for proformas, Modifier).

## New/Edit Invoice — `NewInvoice.tsx`

The interactive invoice builder/editor (the same component handles both create and edit, switching on an `:id` route param). It auto-saves a full form draft to `localStorage` on every keystroke, restoring it on reload with a "Brouillon restauré" toast and a "Brouillon enregistré à HH:MM" indicator — the invoice date itself is deliberately never restored from a stale draft. It computes Algerian tax rules client-side for live preview: per-item TVA, and the tiered "timbre" (stamp duty) that only applies for cash ("Espèces") payments. The bulk of the page is a WYSIWYG document preview/editor plus a small live-totals strip and action buttons (Télécharger PDF, Créer/Mettre à jour). On submit, if the invoice originated from a client's "draft products" queue, it auto-marks the invoice paid and deducts the amount from the client's advance-payment balance.

## Contracts — `Contracts.tsx`

Lists generated service-prestation contracts (réf, client, projet lié, services, montant TTC, date) with a search box and a 3-cell metric strip (Total Contrats / En cours / Signés — "Signés" is hardcoded to 0 since there is no signature-tracking field in the schema yet). Clicking a row (or the "..." menu's Aperçu/Imprimer PDF) generates a contract PDF pulling company identity from the active company and payment-split/tranche data from the contract's `payment_split`. "Nouveau Contrat" opens a contract-builder modal that lets the user pick services from the catalogue, choose a payment split (e.g. 50/50), and generates the linked milestone invoices. Rows can be deleted with a confirm dialog.

## Clients — `Clients.tsx`

The client list/CRM entry point, with a 3-cell metric strip (Total Clients / Nouveaux ce mois / Wilayas couvertes), CSV import/export buttons next to "Nouveau client," and a broad free-text search across name/code/phone/email/NIF/NIS/RC/AI/activité/wilaya/city/address. The table shows Code, Nom, Téléphone, Wilaya, and a computed status badge reflecting payment/activity health. Row actions: Voir, Modifier, Supprimer (with confirm dialog). Inactive clients render dimmed.

## Client detail — `ClientDetail.tsx`

A large single-client workspace with four tabs: **Aperçu** (five overview-stat cards computed live from invoices/payments — Chiffre d'affaires total, Client depuis, Délai de paiement moyen, Fréquence d'achat, Statut — plus a second row of Total Factures/Payées/En Attente/Solde Dû cards), **Factures** (that client's invoice history with inline status editing), **Produits achetés** (purchase history with product/month/year filters, and a "draft products" staging queue that feeds into New Invoice), and **Avances & Pré-paiements** (advance-payment ledger with add/edit/delete and date-range filtering). The header has a back button, client name/code/wilaya, and a "Modifier" button opening an edit dialog.

## Settings — `Settings.tsx`

The largest page in the app, organized into five tabs:
- **Informations Entreprise** — company identity: name, RC/NIF/NIS/AI, RIB, capital, contact info, a multi-entry phone list, and an "extra info" list.
- **Apparence & Logo** — PDF theme picker (`structure` / `epure` / `moderne`), font picker, an automated PDF backup directory, document customization, logo upload/sizing, and the **"Cachet et Signature" card** (confirmed present in source: `apps/desktop/src/pages/Settings.tsx`, around line 729) — separate file-upload fields for "Cachet Électronique" and "Signature" (PNG/JPG/WEBP/SVG, compressed client-side on upload), a live preview of each, an adjustable height-in-pixels slider for each, and a "Retirer" clear button once an image is set. A further "Éléments visuels" card handles a footer/group logo, a background pattern, and a QR code image.
- **Sécurité** — password change.
- **Notifications & Sons** — notification sound toggle.
- **Envoi d'Emails** — Gmail SMTP sender address + App Password used by the in-app email-dispatch feature.

Settings also hosts the irreversible "reset to factory state" flow (see [`data-flows.md`](../architecture/data-flows.md#flow-3-factory-reset)) behind a typed-confirmation dialog.

## Auth / Login — `Auth.tsx`

The login/setup screen, split into a left "trust panel" (shown only on large screens: an animated blueprint-style background, a floating card composition, and copy reading "Le système de gestion interne exclusif d'Omada Marketing & Digital Solutions" with a "Sétif, Algérie" footer signature) and a right login card. The card shows the Sordi logo, an app version badge, and a form that adapts based on whether a password has ever been set: first run shows "Configuration initiale" with password + confirm-password fields; returning users see "Connexion à Sordi" with just a password field (plus an Identifiant field only in the non-Tauri web-preview mode) and a "Se souvenir de moi" checkbox. A footer note shows license state ("Licence active — Appareil vérifié..." vs "Mode consultation..."). An intro splash animation holds for a fixed minimum ~1.4 seconds before revealing the login form, regardless of how fast the actual auth check resolves.

## Projects — `Projects.tsx`

Project list with a 4-cell metric strip (Total Projets / En Cours / À Risque with a "RAS"/"Attention requise" trend badge / Terminés) and a row of status-filter pills (Tous, En retard, Dépassement budgétaire, À risque, En cours, Nouveau, Terminé). The table shows Projet, Client, Responsable, a "Budget facturé / prévu" progress-bar cell (turns red when over budget), and a status badge. Completed projects render dimmed.

## Project detail — `ProjectDetail.tsx`

A single-page (no tabs) project workspace combining: budget cards (Budget prévu / facturé / payé), a "Rentabilité & Finances Réelles" card (real HT revenue minus direct costs), a conditional "Paiement freelance" card when a freelancer is assigned to the project, a "Détails" card, task management (kanban-style statuses: à_faire → en_cours → en_revision_interne → envoyé_client → approuvé), deliverables management, a "Factures liées" table, expense tracking scoped to the project, and a "Nouveau Contrat" action.

## Payroll — `Payroll.tsx`

A large payroll management page built around a selectable period (Mois/Trimestre/Semestre/Année) and anchor month. Top stat cards: "Coût total de la paie" for the month, "Employés en alerte absence," "Bulletins en attente de paiement," plus a warning banner listing unmapped attendance-device codes. Supports importing punch/attendance records (CSV upload), running payroll per employee (with optional primes/bonuses), viewing/editing/deleting individual payroll runs, marking runs Payé (green status badge) vs En attente (amber), and exporting either a CSV or a PDF bulletin de paie / payroll summary per employee or period.

## Partners — `Partners.tsx`

"Associés & Répartition des Bénéfices" — manages equity partners (name, role, equity %, active flag) and their profit withdrawals for a given year, with a KPI strip (Capital Total plus other metrics using a rotating segment color palette for an equity-split visualization). Supports creating/editing/deleting partners, recording/deleting withdrawals, and generating a monthly PDF report for a selected month/year.

## Remaining pages (brief)

| Page | Summary |
|---|---|
| `Deliveries.tsx` | List page for "Bons de livraison" (delivery notes), mirroring the Invoices list pattern. |
| `DeliveryDetail.tsx` | Single delivery-note detail/preview page (document-style header, similar to Invoice Detail). |
| `EditDelivery.tsx` | Edit form wrapper for an existing delivery note. |
| `EditOrder.tsx` | Edit form wrapper for an existing purchase/sales order. |
| `EmployeeDetail.tsx` | Single-employee profile page (photo, documents, advances, attendance). |
| `Expenses.tsx` | "Charges & Dépenses" list/tracking page for company expenses by category. |
| `History.tsx` | "Historique" — the full activity-log page (detailed counterpart to the Dashboard's "Activité Récente" widget). |
| `Integrations.tsx` | "Intégrations" page surfacing Gmail/Sheets/Calendar connection status. |
| `Management.tsx` | Thin wrapper page ("Employés" header) that now renders `management/Employees.tsx` — a comment in source notes the old Projets/Score tabs were retired once the dedicated Projects module replaced them. |
| `management/Employees.tsx` | The employee roster/management section rendered inside Management.tsx. |
| `NewClient.tsx` | Client creation form. |
| `NewCreditNote.tsx` | "Nouvelle facture d'avoir" — credit-note creation flow. |
| `NewDelivery.tsx` | New delivery-note creation form. |
| `NewOrder.tsx` | New purchase/sales order creation form. |
| `NewProforma.tsx` | "Nouvelle Facture Proforma" creation flow. |
| `NewProject.tsx` | Project creation/edit form. |
| `NotFound.tsx` | Generic 404 page. |
| `OrderDetail.tsx` | Single order detail/preview page. |
| `Orders.tsx` | "Bons de Commande" — order list page. |
| `Payments.tsx` | "Suivi des Règlements" — payments tracking/list page. |
| `Products.tsx` | "Catalogue des Services & Offres Digitales" — service catalogue management, including billing units (Forfait/Projet, TJM/Jour, Heure, Abonnement Mensuel, Pack Annuel). |
| `SalesAnalysis.tsx` | "Analyses des Ventes" — a leaner sales-analytics page, complementing the Dashboard's charts. |
| `Suppliers.tsx` | Supplier list/CRM page (mirrors Clients.tsx for the purchasing side). |
| `Upgrade.tsx` | "Passer à Sordi Pro" — license/subscription upgrade page. |
| `VerificationTest.tsx` | "Test de Vérification Système" — an internal diagnostics/QA page, not part of normal navigation. |
