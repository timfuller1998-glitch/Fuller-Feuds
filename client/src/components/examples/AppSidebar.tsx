import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from '../AppSidebar'

export default function AppSidebarExample() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          currentUser={{
            name: "Alex Johnson",
            isOnline: true
          }}
          onNavigate={(path) => console.log('Navigate to:', path)}
          onCreateTopic={() => console.log('Create topic clicked')}
          onLogout={() => console.log('Logout clicked')}
        />
        <div className="flex-1 p-8 bg-muted/20">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Sidebar Example</h2>
            <p className="text-muted-foreground">
              This is the main content area. The sidebar on the left contains navigation and categories.
            </p>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}