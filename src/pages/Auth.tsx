import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Lock, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';

const Auth = () => {
  const { user, loading, needsSetup, isTauri, signIn } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isTauri && !login) {
      toast.error("Veuillez entrer votre identifiant");
      return;
    }
    if (!password) {
      toast.error("Veuillez entrer un mot de passe");
      return;
    }
    if (needsSetup && password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(password, login);
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error.message || "Une erreur est survenue");
    } else {
      toast.success(needsSetup ? "Mot de passe configuré avec succès" : "Connexion réussie");
      navigate('/', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        <div className="bg-card rounded-[6px] p-8 shadow-card border border-border/30">
          <div className="text-center mb-8 flex flex-col items-center">
            <img
              src="/brand/logo-horizontal.svg"
              alt="Sordi"
              className="h-12 w-auto mb-6"
            />
            <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">
              {needsSetup ? "Configuration initiale" : "Bienvenue sur Sordi"}
            </h1>
            <p className="text-muted-foreground">
              {needsSetup
                ? "Définissez un mot de passe pour sécuriser vos données"
                : "Connectez-vous pour accéder à votre espace"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isTauri && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground ml-1">
                  Identifiant
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="admin"
                    className="pl-10"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground ml-1">
                {needsSetup ? "Nouveau mot de passe" : "Mot de passe"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus={isTauri}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {needsSetup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground ml-1">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {needsSetup ? "Configurer Sordi" : "Se connecter"}
            </Button>
          </form>
        </div>
        <p className="text-center mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Sordi V1.0.0{isTauri ? " • Données stockées localement" : ""}
        </p>
      </div>
    </div>
  );
};

export default Auth;
