import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { RiArrowRightSLine, RiQuestionLine, RiAddLine, RiSearchLine, RiPictureInPictureLine as WidgetIcon } from "@remixicon/react";
import { invoke } from "@tauri-apps/api/core";
import { Tooltip, TooltipTrigger, TooltipContent } from "@sordi/ui";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { WorkspaceAccountMenu } from "@/components/layout/WorkspaceAccountMenu";
import { useLanguage } from "@/hooks/useLanguage";
import { useNavigate } from "react-router-dom";
import { usePageHeaderState } from "@/hooks/usePageHeader";
import { cn } from "@/lib/utils";

interface HeaderProps {
  className?: string;
}

export const Header = forwardRef<HTMLDivElement, HeaderProps>(
  function Header({ className }, ref) {
    const { t } = useTranslation("common");
    const navigate = useNavigate();
    const { isRtl } = useLanguage();
    const { breadcrumb } = usePageHeaderState();

    return (
      <header
        ref={ref}
        data-tauri-drag-region
        // h-[72px] (not h-16) so this row's own vertical center sits a
        // little further down the window — closer to where the Sidebar's
        // wordmark lands below its h-9 traffic-light clearance strip,
        // instead of the topbar's controls floating right at the very top
        // edge while the sidebar logo sits a full row lower.
        // Clean, bright translucent surface matching the Sidebar — barely-
        // there blur, hairline border, no glowing frame.
        // Dark mode stays fully transparent as before.
        className="h-[72px] flex items-center justify-between px-8 ps-20 lg:ps-8 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 dark:bg-transparent dark:backdrop-blur-none dark:border-transparent"
      >
        {/* Search sits at the very left, ahead of the title — every page
            already repeats its own title as a large H1 right below this
            bar, so this corner is better spent on the one thing that's
            actually missing from the rest of the row: a way to jump
            anywhere from anywhere. Styled as a pill input rather than a
            bare icon button — it opens the exact same command palette on
            click, just reads as "search field" rather than "hidden
            action" at a glance. */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
            aria-label="Rechercher"
            className="flex items-center gap-2 w-64 md:w-80 shrink-0 rounded-xl bg-white/80 dark:bg-card/80 border border-slate-200/80 dark:border-border/60 shadow-xs px-3.5 py-1.5 text-xs text-slate-500 dark:text-muted-foreground hover:bg-white dark:hover:bg-card transition-colors duration-150"
          >
            <RiSearchLine className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-start truncate">Rechercher facture, client, projet...</span>
            <span className="shrink-0 rounded-md border border-slate-200/80 dark:border-border/60 bg-slate-50 dark:bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:text-muted-foreground/80">
              ⌘K
            </span>
          </button>

          {/* Breadcrumb only — a flat page title (e.g. "Tableau de bord")
              used to render here too, but every page already shows that
              exact same title as its own large H1 right below this bar.
              A breadcrumb earns its place because it says something the H1
              doesn't (e.g. "Factures > FACT-2024-001"); a bare repeat of
              the H1 doesn't, so it's gone rather than shown twice. */}
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="flex items-center gap-1.5 min-w-0 text-sm">
              {breadcrumb.map((item, i) => {
                const isLast = i === breadcrumb.length - 1;
                return (
                  <span key={i} className="flex items-center gap-1.5 min-w-0">
                    {item.path ? (
                      <button
                        onClick={() => navigate(item.path!)}
                        className="text-muted-foreground hover:text-foreground transition-colors truncate"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <span className={isLast ? "font-semibold text-foreground truncate" : "text-muted-foreground truncate"}>
                        {item.label}
                      </span>
                    )}
                    {!isLast && (
                      <RiArrowRightSLine className={cn("w-3.5 h-3.5 shrink-0 text-muted-foreground/50", isRtl && "-scale-x-100")} />
                    )}
                  </span>
                );
              })}
            </nav>
          )}
        </div>

        {/* Account identity, workspace, language, and theme are now all
            unified behind WorkspaceAccountMenu (rightmost) — the sidebar
            footer that used to hold the account card is gone, so this is
            the one place both concepts live. Notifications/help stay as
            plain minimal icon buttons — quiet by default, not competing
            with the primary quick-action or the profile pill for
            attention. */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/invoices/new")}
                aria-label="Nouvelle facture"
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-card flex items-center justify-center hover:bg-primary-hover hover:scale-105 active:scale-90 transition-all duration-200 ease-out ms-1.5"
              >
                <RiAddLine className="w-5 h-5 transition-transform duration-200" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center" sideOffset={8}>Nouvelle facture</TooltipContent>
          </Tooltip>
          <NotificationBell />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => invoke("toggle_widget_window").catch(() => {})}
                aria-label="Widget flottant"
                className="p-2 rounded-lg text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-secondary transition-colors duration-150"
              >
                <WidgetIcon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center" sideOffset={6}>Widget flottant</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="mailto:contact@sordi.app"
                aria-label={t("help")}
                className="p-2 rounded-lg text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-secondary transition-colors duration-150"
              >
                <RiQuestionLine className="w-4 h-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("help")}</TooltipContent>
          </Tooltip>
          <div className="w-px h-6 bg-border/60 mx-1" />
          <WorkspaceAccountMenu />
        </div>
      </header>
    );
  }
);

Header.displayName = "Header";
