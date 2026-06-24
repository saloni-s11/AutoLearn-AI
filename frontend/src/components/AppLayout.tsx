import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NavLink } from "react-router-dom";
import { useStudy } from "@/context/StudyContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useStudy();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/50 px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            <NavLink to="/profile" title="Your profile">
              <div className="h-8 w-8 rounded-full gradient-primary-bg flex items-center justify-center text-xs font-bold text-primary-foreground hover:opacity-80 transition-opacity uppercase">
                {user?.[0] ?? "U"}
              </div>
            </NavLink>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
