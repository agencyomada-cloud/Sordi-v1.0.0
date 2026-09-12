import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { cn, compressImage } from "@/lib/utils";
import { useActiveCompany, useUpdateActiveCompany } from "@/hooks/useActiveCompany";

// Shown in the invoice header's logo slot in the interactive editor only,
// whenever no company logo has been uploaded — an Odoo-style minimal
// upload cue, not the bulky bordered badge with a building icon and two
// lines of text this used to be. Editor-only: the read-only preview and
// PDF export never render this at all (an issued document with no logo
// just has empty space there, not a "no logo" prompt aimed at the user).
//
// Clicking it uploads a logo directly, in place — the same
// read/compress/persist flow Settings.tsx's own logo field uses, writing
// straight to the active company row so every open invoice picks it up
// immediately via useSettings(). update_company (Rust) is a full-row
// overwrite, not a partial patch, so every other company field has to be
// resent unchanged alongside the new logo — mirrors exactly what
// Settings.tsx hydrates into its own form when loading `company`.
export function InvoiceLogoPlaceholder({
  className,
  tone = "default",
}: {
  className?: string;
  /** "onAccent" — for the Moderne theme's solid colored header band, where
   *  the default muted/border-dashed treatment would read as invisible
   *  against a saturated brand color. Uses translucent white instead. */
  tone?: "default" | "onAccent";
}) {
  const { company } = useActiveCompany();
  const updateCompany = useUpdateActiveCompany();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !company) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        const compressed = await compressImage(base64, 400); // 400px width is plenty for PDF
        await updateCompany.mutateAsync({
          name: company.name,
          logo_base64: compressed,
          activity: company.activity || "",
          rc: company.rc || "",
          nif: company.nif || "",
          nis: company.nis || "",
          article_imposition: company.article_imposition || "",
          cnas_adherent: company.cnas_adherent || "",
          rib: company.rib || "",
          capital: company.capital || "",
          bank_agency: company.bank_agency || "",
          website: company.website || "",
          phone: company.phone || "",
          phones: company.phones || "",
          email: company.email || "",
          address: company.address || "",
          extra_info: company.extra_info || "",
        });
        toast.success("Logo ajouté");
      } catch (err) {
        toast.error("Erreur lors de l'envoi du logo");
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      role="button"
      onClick={() => fileInputRef.current?.click()}
      className={cn(
        "w-28 h-16 rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors",
        tone === "onAccent"
          ? "border-white/40 bg-white/10 hover:bg-white/20"
          : "border-border/80 bg-muted/20 hover:bg-muted/40",
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
      />
      <ImagePlus className={cn("w-4 h-4", tone === "onAccent" ? "text-white/70" : "text-muted-foreground/60")} strokeWidth={1.5} />
      <span className={cn("text-[10px] font-medium", tone === "onAccent" ? "text-white/80" : "text-muted-foreground/70")}>
        Ajouter un logo
      </span>
    </div>
  );
}
