import { Component, type ErrorInfo, type ReactNode } from "react";
import { RiErrorWarningLine as AlertIcon, RiRefreshLine as Refresh, RiHome4Line as Home } from "@remixicon/react";
import { Button } from "@sordi/ui";

interface Props {
  children: ReactNode;
  /** SPA navigation back to "/" — falls back to a hard reload only if the
   *  caller doesn't supply one (this is a class component, so it can't
   *  call useNavigate() itself). */
  onGoHome?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Wraps the routed page content (see AppLayout.tsx) so an uncaught render
 * error in one page — e.g. indexing a lookup map with a status/value the
 * map doesn't cover — shows a recoverable fallback instead of blanking the
 * entire app to a white screen. Sidebar/header stay mounted above this
 * boundary, so navigation remains available even when a page has crashed.
 * Must be a class component: React only supports error boundaries via
 * getDerivedStateFromError/componentDidCatch, not hooks. AppLayout keys this
 * by the current route path, so navigating away from a crashed page remounts
 * a fresh boundary instead of leaving the fallback stuck.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route render crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center bg-card rounded-3xl border border-border/30 shadow-card p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertIcon className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Une erreur est survenue</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Cette page n'a pas pu s'afficher correctement. Vous pouvez réessayer ou retourner au tableau de bord.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2 rounded-full"
                onClick={() => this.setState({ error: null })}
              >
                <Refresh className="w-4 h-4" />
                Réessayer
              </Button>
              <Button
                type="button"
                className="gap-2 rounded-full"
                onClick={() => {
                  this.setState({ error: null });
                  if (this.props.onGoHome) this.props.onGoHome();
                  else window.location.assign("/");
                }}
              >
                <Home className="w-4 h-4" />
                Tableau de bord
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
