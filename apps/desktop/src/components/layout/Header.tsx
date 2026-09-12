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
        // Strict native titlebar height (40px) — the sidebar's own h-9
        // drag-region strip above its wordmark already clears the macOS
        // traffic lights (they land in the sidebar's top-left corner, not
        // this header, since the header starts to the right of it), so no
        // extra left inset is needed here beyond the mobile-hamburger
        // clearance below lg.
        //
        // A 3-column `grid` here (equal 1fr tracks) used to force the right
        // action cluster into a fixed 1/3 of the header regardless of how
        // narrow the window got — once that cell was narrower than its own
        // content (Facture button + 3 icon buttons + account menu, no
        // shrink protection), the buttons visually spilled out of their
        // grid cell and overlapped the search box next to it. A `flex
        // justify-between` row instead gives the shrink-0 zones (this one
        // and the right cluster below) their real content width first, and
        // only the search zone in the middle actually compresses.
        className="h-10 flex items-center justify-between gap-3 px-4 ps-16 lg:ps-4 bg-background/95 backdrop-blur-sm border-b border-border/80 select-none overflow-hidden"
      >
        {/* Left — breadcrumb / current module title only. A flat page title
            (e.g. "Tableau de bord") used to repeat here too, but every page
            already shows that exact title as its own H1 below this bar — a
            breadcrumb earns its place by saying something the H1 doesn't
            (e.g. "Factures > FACT-2024-001"). */}
        <div className="flex items-center gap-4 min-w-0 shrink">
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="flex items-center gap-1.5 min-w-0 text-xs font-medium">
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
                      <span className={isLast ? "font-medium text-foreground truncate" : "text-muted-foreground truncate"}>
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

        {/* Center — the one Quick Search trigger for the whole shell; opens
            the same command palette the sidebar owns the state/dialog for.
            The only zone allowed to actually compress: bounded so it never
            shrinks below a usable width, but also never keeps growing past
            320px just because the window has spare room. */}
        <div className="flex items-center justify-center min-w-[180px] max-w-[320px] flex-1">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
            aria-label="Rechercher"
            className="flex items-center justify-between gap-2 w-full h-7 min-w-0 rounded-md bg-muted/40 hover:bg-muted/70 border border-border/60 px-3 text-xs text-muted-foreground transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <RiSearchLine className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Rechercher facture, client, projet...</span>
            </span>
            <span className="shrink-0 rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/80">
              ⌘K
            </span>
          </button>
        </div>

        {/* Right — action cluster. Account identity, workspace, language,
            and theme are all unified behind WorkspaceAccountMenu
            (rightmost); notifications/help/widget stay as plain compact
            icon buttons, quiet by default rather than competing with the
            primary quick-action or the profile trigger for attention.
            `shrink-0` on the whole cluster is what actually stops the
            collision — it guarantees this zone keeps its full content
            width and only the search zone above gives up space; Widget/
            Help are the two truly redundant entries (both are also
            reachable from the sidebar / ⌘K), so they're the first to go
            once the window gets genuinely narrow. */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/invoices/new")}
                aria-label="Nouvelle facture"
                className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1 hover:bg-primary-hover active:scale-[0.97] transition-all duration-150 shrink-0"
              >
                <RiAddLine className="w-3.5 h-3.5" />
                Facture
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
                className="hidden xl:flex h-7 w-7 shrink-0 rounded-md items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors duration-150"
              >
                <WidgetIcon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center" sideOffset={6}>Widget flottant</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-help-drawer"))}
                aria-label={t("help")}
                className="hidden xl:flex h-7 w-7 shrink-0 rounded-md items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors duration-150"
              >
                <RiQuestionLine className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("help")}</TooltipContent>
          </Tooltip>
          <div className="hidden xl:block w-px h-5 bg-border/60 mx-1 shrink-0" />
          <WorkspaceAccountMenu />
        </div>
      </header>
    );
  }
);

Header.displayName = "Header";
