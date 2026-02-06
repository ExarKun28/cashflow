import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Home, Plus, Edit, Menu, X, User, Shield } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const applyUser = (email: string | null, fullName: string | null) => {
      setUserEmail(email);
      setUserName(fullName ?? email);
    };

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (!active || error) return;
      const nextUser = data.user ?? null;
      applyUser(
        nextUser?.email ?? null,
        (nextUser?.user_metadata?.full_name as string | null | undefined) ??
          null,
      );
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      applyUser(
        nextUser?.email ?? null,
        (nextUser?.user_metadata?.full_name as string | null | undefined) ??
          null,
      );
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    setLogoutOpen(false);
    await supabase.auth.signOut();
    localStorage.removeItem("sb_access_token");
    navigate("/", { replace: true });
  }, [navigate, setLogoutOpen]);

  const isActive = (path: string) => location.pathname === path;
  const getInitials = (value: string) =>
    value
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const displayName = userName ?? userEmail ?? "User";
  const initials = getInitials(displayName);

  return (
    <aside
      className={`bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"}`}
    >
      <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
        {!isCollapsed && (
          <div>
            <h1 className="text-xl font-bold text-sidebar-foreground">
              CashFlow
            </h1>
            <p className="text-sm text-sidebar-foreground/60 mt-1">
              Manage your finances
            </p>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent p-2 rounded"
        >
          {isCollapsed ? (
            <Menu className="w-5 h-5" />
          ) : (
            <X className="w-5 h-5" />
          )}
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <Button
          onClick={() => navigate("/dashboard")}
          variant={isActive("/dashboard") ? "default" : "ghost"}
          className={`w-full ${isCollapsed ? "justify-center" : "justify-start"}`}
          title={isCollapsed ? "Dashboard" : ""}
        >
          <Home className="w-4 h-4" />
          {!isCollapsed && <span className="ml-2">Dashboard</span>}
        </Button>

        <Button
          onClick={() => navigate("/create")}
          variant={isActive("/create") ? "default" : "ghost"}
          className={`w-full ${isCollapsed ? "justify-center" : "justify-start"}`}
          title={isCollapsed ? "Create" : ""}
        >
          <Plus className="w-4 h-4" />
          {!isCollapsed && <span className="ml-2">Create</span>}
        </Button>

        <Button
          onClick={() => navigate("/update")}
          variant={isActive("/update") ? "default" : "ghost"}
          className={`w-full ${isCollapsed ? "justify-center" : "justify-start"}`}
          title={isCollapsed ? "Update" : ""}
        >
          <Edit className="w-4 h-4" />
          {!isCollapsed && <span className="ml-2">Update</span>}
        </Button>

        <Button
          onClick={() => navigate("/audit-log")}
          variant={isActive("/audit-log") ? "default" : "ghost"}
          className={`w-full ${isCollapsed ? "justify-center" : "justify-start"}`}
          title={isCollapsed ? "Audit Log" : ""}
        >
          <Shield className="w-4 h-4" />
          {!isCollapsed && <span className="ml-2">Audit Log</span>}
        </Button>

        <Button
          onClick={() => navigate("/profile")}
          variant={isActive("/profile") ? "default" : "ghost"}
          className={`w-full ${isCollapsed ? "justify-center" : "justify-start"}`}
          title={isCollapsed ? "Profile" : ""}
        >
          <User className="w-4 h-4" />
          {!isCollapsed && <span className="ml-2">Profile</span>}
        </Button>
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <ThemeToggle collapsed={isCollapsed} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`w-full ${isCollapsed ? "justify-center p-2" : "justify-start"}`}
            >
              <Avatar className="w-6 h-6 mr-2">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              {!isCollapsed && <span>{displayName}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={isCollapsed ? "start" : "end"}
            className="w-56"
          >
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={(event) => {
                event.preventDefault();
                navigate("/profile");
              }}
            >
              <User className="w-4 h-4 mr-2" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setLogoutOpen(true);
                  }}
                  className="cursor-pointer text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to log out? You'll need to log back in
                  to access your cashflows.
                </AlertDialogDescription>
                <div className="flex justify-end gap-2">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLogout}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Logout
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}