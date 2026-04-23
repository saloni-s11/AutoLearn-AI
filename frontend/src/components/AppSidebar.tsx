import {
  LayoutDashboard,
  Upload,
  BookOpen,
  HelpCircle,
  Layers,
  History,
  Brain,
  Search,
  LogOut,
  User as UserIcon,
  Map,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useStudy } from "@/context/StudyContext";
import { NavLink } from "react-router-dom";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Upload Content", url: "/upload", icon: Upload },
  { title: "My Learning", url: "/learning", icon: BookOpen },
  { title: "Personal Roadmap", url: "/roadmap", icon: Map },
  { title: "Research Search", url: "/research", icon: Search },
  { title: "Quiz & Practice", url: "/quiz", icon: HelpCircle },
  { title: "Flashcards", url: "/flashcards", icon: Layers },
  { title: "History", url: "/history", icon: History },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, logout } = useStudy();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-card/50 backdrop-blur-xl">
      <SidebarHeader className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary-bg shadow-lg shadow-primary/20">
            <Brain className="h-6 w-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-heading font-black text-foreground tracking-tight text-xl leading-none">AutoLearn</span>
              <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mt-1">AI Studio</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-2 pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    className="h-11 rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-300 group px-3"
                  >
                    <NavLink to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
                      {!isCollapsed && <span className="font-bold text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/50">
        {!isCollapsed ? (
          <div className="space-y-4">
             <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/50">
                <div className="h-8 w-8 rounded-full gradient-primary-bg flex items-center justify-center text-xs text-white uppercase font-black">
                   {user?.[0] || <UserIcon className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-sm font-black text-foreground truncate">{user || "Scholar"}</p>
                   <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Pro Account</p>
                </div>
             </div>
             <button 
                onClick={logout}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all duration-300 font-bold text-sm"
             >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
             </button>
          </div>
        ) : (
          <button onClick={logout} className="h-10 w-10 flex items-center justify-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all mx-auto">
             <LogOut className="h-4 w-4" />
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
