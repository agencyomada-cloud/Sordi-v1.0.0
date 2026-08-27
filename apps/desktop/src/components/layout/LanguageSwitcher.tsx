import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";
import { LANGUAGES, type SupportedLanguage } from "@/i18n/languages";

const OPTIONS: { code: SupportedLanguage; label: string }[] = [
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
];

/** Sleek FR/AR segmented toggle — lives in the header next to the user menu. */
export function LanguageSwitcher() {
  const { t } = useTranslation("common");
  const { language, setLanguage } = useLanguage();

  const handleSelect = (code: SupportedLanguage) => {
    if (code === language) return;
    setLanguage(code);
    toast.success(t("language.switchedTo", { language: LANGUAGES[code].nativeName }));
  };

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className="flex items-center rounded-full border border-border bg-secondary/50 p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => handleSelect(option.code)}
          aria-pressed={language === option.code}
          className={cn(
            "px-2.5 py-1 text-xs font-semibold rounded-full transition-all duration-150",
            language === option.code
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
