import { forwardRef } from "react";
import { Bell, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        <div className="hidden sm:flex items-center gap-2 bg-card rounded-full px-4 py-2 shadow-card">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification button */}
          <button className="w-10 h-10 rounded-full bg-card shadow-card flex items-center justify-center hover:bg-secondary transition-all">
            <Bell className="w-4 h-4 text-muted-foreground" />
          </button>
          
          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center shadow-card hover:opacity-90 transition-all">
                <User className="w-4 h-4 text-background" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
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
                className="text-destructive rounded-xl cursor-pointer"
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
