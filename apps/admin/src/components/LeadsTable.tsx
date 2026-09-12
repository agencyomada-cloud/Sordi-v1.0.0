import { EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@sordi/ui";
import { RiUserAddLine as LeadIcon, RiWhatsappLine as WhatsAppIcon } from "@remixicon/react";
import type { LeadRow } from "@/lib/adminApi";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const OS_LABEL: Record<LeadRow["osType"], string> = { macos: "macOS", windows: "Windows" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface LeadsTableProps {
  leads: LeadRow[];
}

export function LeadsTable({ leads }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <EmptyState
        icon={LeadIcon}
        title="Aucun prospect pour le moment"
        description="Les téléchargements depuis la page d'accueil apparaîtront ici instantanément."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>WhatsApp</TableHead>
          <TableHead>Entreprise</TableHead>
          <TableHead>OS</TableHead>
          <TableHead>Reçu le</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell className="font-medium text-sm">{lead.name}</TableCell>
            <TableCell>
              <a
                href={buildWhatsAppLink(lead.phone)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
                +213{lead.phone}
              </a>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{lead.company || "—"}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{OS_LABEL[lead.osType]}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{formatDateTime(lead.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
