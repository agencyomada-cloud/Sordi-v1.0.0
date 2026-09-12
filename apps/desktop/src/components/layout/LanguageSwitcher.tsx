import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";
import { LANGUAGES, type SupportedLanguage } from "@/i18n/languages";

const OPTIONS: { code: SupportedLanguage; label: string }[] = [
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
];

/** Compact pill toggle ("FR" / "AR") — sits inside the account menu's
 *  unified segmented utility strip alongside the theme toggle (see
 *  WorkspaceAccountMenu.tsx), so the active state matches that strip's own
 *  raised-chip treatment rather than rendering as a separate plain-text
 *  control. */
export function LanguageSwitcher() {
  const { t } = useTranslation("common");
  const { language, setLanguage } = useLanguage();

  const handleSelect = (code: SupportedLanguage) => {
    if (code === language) return;
    setLanguage(code);
    toast.success(t("language.switchedTo", { language: LANGUAGES[code].nativeName }));
  };

  return (
    <div role="group" aria-label={t("language.label")} className="flex items-center gap-0.5">
      {OPTIONS.map((option) => {
        const active = language === option.code;
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => handleSelect(option.code)}
            aria-pressed={active}
            className={cn(
              "h-6 px-2 rounded text-[11px] font-medium transition-colors duration-150 border",
              active
                ? "bg-card dark:bg-white/[0.08] text-foreground font-semibold shadow-sm border-border dark:border-white/[0.1]"
                : "text-muted-foreground hover:text-foreground border-transparent"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
