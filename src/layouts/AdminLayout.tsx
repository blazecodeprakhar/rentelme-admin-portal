
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Building2, Home, Users, Settings, LogOut, Menu, Bell, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function AdminLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [pendingCount, setPendingCount] = useState(0);
    const [adRequestsCount, setAdRequestsCount] = useState(0);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        // Real-time listener for pending approvals
        const q = query(collection(db, "properties"), where("status", "==", "Pending"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPendingCount(snapshot.size);
        });

        // Real-time listener for ad requests
        const adQuery = query(collection(db, "ad_requests"), where("status", "==", "pending"));
        const unsubscribeAds = onSnapshot(adQuery, (snapshot) => {
            setAdRequestsCount(snapshot.size);
        });

        return () => {
            unsubscribe();
            unsubscribeAds();
        };
    }, []);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const navItems = [
        { name: "Dashboard", href: "/dashboard", icon: Home },
        { name: "Properties", href: "/properties", icon: Building2, badge: pendingCount },
        { name: "Advertisements", href: "/advertisements", icon: TrendingUp, badge: adRequestsCount },
        { name: "Users", href: "/users", icon: Users },
        { name: "Settings", href: "/settings", icon: Settings },
    ];

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-muted/40 flex">
            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
                    !isSidebarOpen && "-translate-x-full lg:w-20"
                )}
            >
                <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-2 font-bold text-lg text-sidebar-primary-foreground">
                            <Building2 className="h-6 w-6 text-primary" />
                            <span className="text-secondary-foreground">RenTelMe</span>
                        </div>
                    ) : (
                        <Building2 className="h-6 w-6 text-primary mx-auto" />
                    )}
                </div>
                <div className="p-4 space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                location.pathname === item.href ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-muted-foreground",
                                !isSidebarOpen && "justify-center"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {isSidebarOpen && (
                                <div className="flex items-center justify-between w-full">
                                    <span>{item.name}</span>
                                    {item.badge && item.badge > 0 && (
                                        <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                            {item.badge}
                                        </span>
                                    )}
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
                <div className="absolute bottom-4 left-0 right-0 p-4">
                    <Button
                        variant="ghost"
                        className={cn("w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10", !isSidebarOpen && "justify-center px-2")}
                        onClick={handleLogout}
                    >
                        <LogOut className="h-5 w-5" />
                        {isSidebarOpen && <span className="ml-3">Log Out</span>}
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-6 shadow-sm">
                    <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden">
                        <Menu className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden lg:flex">
                        <Menu className="h-5 w-5" />
                    </Button>
                    <div className="ml-auto flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="relative">
                            <Bell className="h-5 w-5 text-muted-foreground" />
                            {pendingCount > 0 && (
                                <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
                            )}
                        </Button>
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
                            AD
                        </div>
                    </div>
                </header>
                <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
    );
}
