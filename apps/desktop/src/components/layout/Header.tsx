import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { RiArrowRightSLine, RiQuestionLine } from "@remixicon/react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@sordi/ui";
import { NotificationBell } from "@/components/layout/NotificationBell";
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
    const { title, breadcrumb } = usePageHeaderState();

    return (
      <header
        ref={ref}
        data-tauri-drag-region
        className="h-16 bg-transparent flex items-center justify-between px-8 ps-20 lg:ps-8"
      >
        {/* Page title / breadcrumb — the app's only "where am I" indicator
            once you're past the sidebar's active-state highlight. */}
        <div className="min-w-0">
          {breadcrumb && breadcrumb.length > 0 ? (
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
          ) : (
            <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
          )}
        </div>

        {/* Account identity, language, and theme now live in one place —
            the Sidebar's Account Popover — instead of being duplicated
            here too; this stays a lean utility row. */}
        <div className="flex items-center gap-3">
          <NotificationBell />
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="mailto:contact@sordi.app"
                className="w-10 h-10 rounded-full bg-card border border-border/50 shadow-card flex items-center justify-center hover:bg-secondary transition-all duration-200 active:scale-[0.96] text-muted-foreground hover:text-foreground"
              >
                <RiQuestionLine className="w-4 h-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("help")}</TooltipContent>
          </Tooltip>
        </div>
      </header>
    );
  }
);

Header.displayName = "Header";
