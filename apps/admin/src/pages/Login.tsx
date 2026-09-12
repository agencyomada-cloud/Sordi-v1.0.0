import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@sordi/ui";
import { RiShieldKeyholeLine as KeyIcon } from "@remixicon/react";
import { setAdminKey } from "@/lib/adminAuth";
import { adminApi, AdminApiError } from "@/lib/adminApi";

/**
 * The admin key IS the credential (see adminAuth.ts) — there's no separate
 * login endpoint to call, so "logging in" here means: store the key the
 * admin typed, then prove it works by making one real gated request
 * (GET /admin/devices, harmless and idempotent). A wrong key surfaces as a
 * clean error immediately, rather than the admin discovering it's wrong on
 * the first real action three screens later.
 */
export function Login() {
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || isVerifying) return;

    setIsVerifying(true);
    setAdminKey(key.trim());
    try {
      await adminApi.listDevices();
      navigate("/devices", { replace: true });
    } catch (error) {
      const message = error instanceof AdminApiError && error.status === 401
        ? "Clé admin invalide."
        : "Impossible de contacter l'API — vérifiez qu'elle tourne bien.";
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <KeyIcon className="w-5 h-5 text-primary" />
          </div>
          <CardTitle>Sordi Admin</CardTitle>
          <CardDescription>Entrez la clé admin pour accéder à la gestion des licences.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-key">Clé admin</Label>
              <Input
                id="admin-key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="x-admin-key"
                autoComplete="off"
                autoFocus
                className="font-mono text-sm"
              />
            </div>
            <Button type="submit" className="w-full" disabled={!key.trim() || isVerifying}>
              {isVerifying ? "Vérification..." : "Continuer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
