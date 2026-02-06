
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Building2, Users, CheckCircle2, AlertCircle, Home, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, limit, getCountFromServer } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalProperties: 0,
        activeUsers: 0,
        pendingApprovals: 0,
        verifiedProperties: 0,
        rejectedProperties: 0
    });
    const [recentListings, setRecentListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                // Total Properties
                const propertiesColl = collection(db, "properties");
                const totalPropsSnapshot = await getCountFromServer(propertiesColl);

                // Active Users
                const usersColl = collection(db, "users");
                const usersSnapshot = await getCountFromServer(usersColl);

                // Pending Approvals
                const pendingQuery = query(propertiesColl, where("status", "==", "Pending"));
                const pendingSnapshot = await getCountFromServer(pendingQuery);

                // Verified Properties
                const verifiedQuery = query(propertiesColl, where("status", "==", "Verified"));
                const verifiedSnapshot = await getCountFromServer(verifiedQuery);

                // Rejected Properties
                const rejectedQuery = query(propertiesColl, where("status", "==", "Rejected"));
                const rejectedSnapshot = await getCountFromServer(rejectedQuery);

                setStats({
                    totalProperties: totalPropsSnapshot.data().count,
                    activeUsers: usersSnapshot.data().count,
                    pendingApprovals: pendingSnapshot.data().count,
                    verifiedProperties: verifiedSnapshot.data().count,
                    rejectedProperties: rejectedSnapshot.data().count
                });

                // Fetch Recent Listings (limit 5)
                // Note: We need a composite index for orderBy("createdAt", "desc") + limit(5) usually
                // For now, fetching without ordering to avoid index error in dev loop, or simple fetch
                const recentQuery = query(propertiesColl, limit(5));
                const recentDocs = await getDocs(recentQuery);
                const recent = recentDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setRecentListings(recent);

            } catch (error) {
                console.error("Error fetching dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground mt-1">Overview of system status and data folders.</p>
            </div>

            {/* Stats Grid - Acting as "Folders" */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/properties')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.totalProperties}</div>
                        <p className="text-xs text-muted-foreground">All database records</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/properties')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Listed Properties</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.verifiedProperties}</div>
                        <p className="text-xs text-muted-foreground">Active & Live</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/properties')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.pendingApprovals}</div>
                        <p className="text-xs text-muted-foreground text-amber-500 font-medium">Action required</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/properties')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Rejected Properties</CardTitle>
                        <XCircle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.rejectedProperties}</div>
                        <p className="text-xs text-muted-foreground">Requires changes</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/users')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : stats.activeUsers}</div>
                        <p className="text-xs text-muted-foreground">Registered accounts</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity Mockup */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Property Listings</CardTitle>
                        <CardDescription>
                            Recent property submissions requiring review.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentListings.length > 0 ? recentListings.map((property) => (
                                <div key={property.id} className="flex items-center gap-4 rounded-lg border p-3">
                                    <div className="h-10 w-10 bg-muted rounded-md flex px-2 py-1 items-center justify-center text-xs text-muted-foreground overflow-hidden">
                                        {property.image ? <img src={property.image} className="w-full h-full object-cover" /> : <Home className="h-5 w-5 opacity-20" />}
                                    </div>
                                    <div className="grid gap-1">
                                        <p className="text-sm font-medium leading-none line-clamp-1">{property.title || "Untitled Property"}</p>
                                        <p className="text-xs text-muted-foreground">{property.location || "No location"} • {property.status}</p>
                                    </div>
                                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => navigate('/properties')}>View</Button>
                                </div>
                            )) : (
                                <div className="text-center text-muted-foreground py-4">No recent listings found.</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>System Activity</CardTitle>
                        <CardDescription>
                            Latest system events and logs.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Activity className="h-4 w-4 mt-0.5 text-primary" />
                                <div className="grid gap-0.5">
                                    <p className="text-sm font-medium text-foreground">Database Connected</p>
                                    <p className="text-xs text-muted-foreground">Cloud Firestore Ready</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Activity className="h-4 w-4 mt-0.5 text-primary" />
                                <div className="grid gap-0.5">
                                    <p className="text-sm font-medium text-foreground">Storage Bucket Active</p>
                                    <p className="text-xs text-muted-foreground">Ready for image uploads</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
