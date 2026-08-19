import { forwardRef } from "react";
import { RiUserLine, RiCalendarLine } from "@remixicon/react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@sordi/ui";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  className?: string;
}

export const Header = forwardRef<HTMLDivElement, HeaderProps>(
  function Header({ className }, ref) {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
      await signOut();
      navigate('/auth');
    };

    return (
      <header 
        ref={ref}
        className="h-16 bg-transparent flex items-center justify-between px-8 pl-20 lg:pl-8"
      >
        {/* Date pill */}
        <div className="hidden sm:flex items-center gap-2 bg-card rounded-[6px] px-4 py-2 shadow-card border border-border/30 hover:border-border/60 transition-all duration-200 group cursor-default">
          <RiCalendarLine className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-hover:scale-110 group-hover:text-primary" />
          <span className="text-sm font-medium">
            {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-10 h-10 rounded-[6px] bg-primary flex items-center justify-center shadow-card hover:opacity-95 hover:shadow-elevated transition-all duration-200 active:scale-[0.96] group">
                <RiUserLine className="w-4 h-4 text-primary-foreground transition-transform duration-200 group-hover:scale-110" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-[6px] p-2 animate-in fade-in-0 zoom-in-95 duration-200 shadow-elevated">
              {user && (
                <>
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem 
                onClick={handleLogout} 
                className="text-destructive rounded-[6px] cursor-pointer"
              >
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    );
  }
);

Header.displayName = "Header";
