import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc, orderBy, deleteDoc, deleteField } from "firebase/firestore";
import { fixImageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, Check, X, TrendingUp, Clock, RefreshCw, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Advertisements() {
    const [requests, setRequests] = useState<any[]>([]);
    const [activeAds, setActiveAds] = useState<any[]>([]);
    const [expiredAds, setExpiredAds] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPropId, setSelectedPropId] = useState("");
    const [adDuration, setAdDuration] = useState("7");

    // Confirmation Dialog State
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        type: 'approve' | 'reject' | 'stop' | null;
        itemId: string | null;
        itemData?: any; // For approval (duration etc)
    }>({ isOpen: false, type: null, itemId: null, itemData: null });
    const [dialogOpen, setDialogOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            console.log("Fetching advertisement data...");

            // Fetch ALL ad requests
            const reqQuery = query(collection(db, "ad_requests"), orderBy("createdAt", "desc"));
            const reqSnap = await getDocs(reqQuery);
            const allRequests: any[] = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            console.log("Total ad_requests found:", allRequests.length);

            // Filter pending only
            const pendingRequests = allRequests.filter((r: any) => r.status === "pending");
            setRequests(pendingRequests);

            // Fetch ALL sponsored properties
            const adsQuery = query(collection(db, "properties"), where("isSponsored", "==", true));
            const adsSnap = await getDocs(adsQuery);
            const allAds: any[] = adsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            console.log("Total sponsored properties:", allAds.length);

            // Helper for robust parsing
            const parseDate = (d: any) => {
                if (!d) return null;
                if (typeof d.toDate === 'function') return d.toDate();
                const parsed = new Date(d);
                return isNaN(parsed.getTime()) ? null : parsed;
            };

            // Separate active vs expired with robust check
            const now = new Date();
            const active = allAds.filter((ad: any) => {
                const date = parseDate(ad.sponsoredUntil);
                return date && date > now;
            });

            // Treat missing or invalid dates as expired to ensure cleanup
            const expired = allAds.filter((ad: any) => {
                const date = parseDate(ad.sponsoredUntil);
                return !date || date <= now;
            });

            // AUTO-CLEANUP: Remove expired ads and delete their requests
            if (expired.length > 0) {
                console.log(`🧹 Auto-cleaning ${expired.length} expired ads...`);

                for (const expiredAd of expired) {
                    try {
                        // Remove sponsored status and DELETE date fields
                        await updateDoc(doc(db, "properties", expiredAd.id), {
                            isSponsored: false,
                            sponsoredUntil: deleteField(),
                            sponsoredAt: deleteField()
                        });

                        // Delete associated ad requests
                        const reqQuery = query(
                            collection(db, "ad_requests"),
                            where("propertyId", "==", expiredAd.id)
                        );
                        const reqSnapshot = await getDocs(reqQuery);

                        for (const reqDoc of reqSnapshot.docs) {
                            await deleteDoc(reqDoc.ref);
                        }

                        console.log(`✅ Cleaned up expired ad: ${expiredAd.title}`);
                    } catch (error) {
                        console.error(`Failed to cleanup ad ${expiredAd.id}:`, error);
                    }
                }
            }

            setActiveAds(active);
            setExpiredAds(expired);

        } catch (error) {
            console.error("Error fetching advertisement data:", error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleSearch = async () => {
        if (searchQuery.length < 2) {
            toast.error("Enter at least 2 characters");
            return;
        }

        setIsSearching(true);
        try {
            const q = query(collection(db, "properties"));
            const snap = await getDocs(q);
            const allProps = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            const searchLower = searchQuery.toLowerCase();
            const results = allProps.filter((p: any) =>
                p.title?.toLowerCase().includes(searchLower) ||
                p.ownerName?.toLowerCase().includes(searchLower) ||
                p.ownerPhone?.includes(searchQuery) ||
                p.ownerEmail?.toLowerCase().includes(searchLower) ||
                p.id === searchQuery
            );

            setSearchResults(results);

            if (results.length === 0) {
                toast.info("No properties found");
            }
        } catch (e) {
            console.error(e);
            toast.error("Search failed");
        } finally {
            setIsSearching(false);
        }
    };

    const openConfirm = (type: 'approve' | 'reject' | 'stop', id: string, data?: any) => {
        setConfirmDialog({ isOpen: true, type, itemId: id, itemData: data });
    };

    const handleConfirmAction = async () => {
        if (!confirmDialog.type || !confirmDialog.itemId) return;

        try {
            if (confirmDialog.type === 'approve') {
                const request = confirmDialog.itemData;
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + parseInt(request.duration || 7));

                // Update property to sponsored
                await updateDoc(doc(db, "properties", request.propertyId), {
                    isSponsored: true,
                    sponsoredUntil: endDate.toISOString(),
                    sponsoredAt: new Date().toISOString()
                });

                // Delete the ad request from database (cleanup)
                await deleteDoc(doc(db, "ad_requests", request.id));

                toast.success("Ad request approved!");
            }
            else if (confirmDialog.type === 'reject') {
                await deleteDoc(doc(db, "ad_requests", confirmDialog.itemId));
                toast.success("Request rejected and deleted");
            }
            else if (confirmDialog.type === 'stop') {
                // Remove sponsored status from property and DELETE the date fields
                await updateDoc(doc(db, "properties", confirmDialog.itemId), {
                    isSponsored: false,
                    sponsoredUntil: deleteField(),
                    sponsoredAt: deleteField()
                });

                // Delete any associated ad requests for this property
                const requestsQuery = query(
                    collection(db, "ad_requests"),
                    where("propertyId", "==", confirmDialog.itemId)
                );
                const requestsSnapshot = await getDocs(requestsQuery);

                // Delete all associated requests
                const deletePromises = requestsSnapshot.docs.map(doc =>
                    deleteDoc(doc.ref)
                );
                await Promise.all(deletePromises);

                toast.success("Ad stopped and requests cleaned up");
            }

            fetchData();
        } catch (error) {
            console.error(error);
            toast.error(`Failed to ${confirmDialog.type} ad`);
        } finally {
            setConfirmDialog({ isOpen: false, type: null, itemId: null });
        }
    };

    const renewAd = async (propertyId: string, days: number = 7) => {
        try {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + days);

            await updateDoc(doc(db, "properties", propertyId), {
                isSponsored: true,
                sponsoredUntil: endDate.toISOString(),
                sponsoredAt: new Date().toISOString()
            });

            toast.success(`Ad renewed for ${days} days`);
            fetchData();
        } catch (error) {
            toast.error("Failed to renew ad");
        }
    };

    const handleManualAdd = async () => {
        if (!selectedPropId) {
            toast.error("Please select a property");
            return;
        }

        try {
            const days = parseInt(adDuration);
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + days);

            await updateDoc(doc(db, "properties", selectedPropId), {
                isSponsored: true,
                sponsoredUntil: endDate.toISOString(),
                sponsoredAt: new Date().toISOString()
            });

            toast.success(`Property sponsored for ${days} days!`);
            setDialogOpen(false);
            setSearchResults([]);
            setSearchQuery("");
            setSelectedPropId("");
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Failed to sponsor property");
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-amber-500" />
                        Advertisement Manager
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage premium listings and ad requests</p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>

                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="gap-2">
                                <TrendingUp className="w-4 h-4" /> Add Premium Ad
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Sponsor a Property</DialogTitle>
                                <DialogDescription>
                                    Search by property title, owner name, phone, or email
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Search Property</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Name, Phone, Title, or ID..."
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                        <Button variant="outline" size="icon" onClick={handleSearch} disabled={isSearching}>
                                            <Search className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    {searchResults.length > 0 && (
                                        <div className="border rounded-md max-h-60 overflow-y-auto mt-2 bg-slate-50">
                                            {searchResults.map((p: any) => (
                                                <div
                                                    key={p.id}
                                                    className={`p-3 text-sm cursor-pointer hover:bg-slate-200 border-b last:border-0 ${selectedPropId === p.id ? 'bg-primary/20' : ''}`}
                                                    onClick={() => setSelectedPropId(p.id)}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <p className="font-semibold">{p.title}</p>
                                                            <p className="text-xs text-muted-foreground">Owner: {p.ownerName} • {p.ownerPhone}</p>
                                                            <p className="text-xs text-muted-foreground">₹{p.price} • {p.location}</p>
                                                        </div>
                                                        {selectedPropId === p.id && <Check className="w-5 h-5 text-green-600 ml-2" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Duration</Label>
                                    <Select value={adDuration} onValueChange={setAdDuration}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="3">3 Days</SelectItem>
                                            <SelectItem value="7">7 Days (Standard)</SelectItem>
                                            <SelectItem value="15">15 Days</SelectItem>
                                            <SelectItem value="30">30 Days</SelectItem>
                                            <SelectItem value="60">60 Days</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleManualAdd} disabled={!selectedPropId}>Activate Ad</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{requests.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Ads</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{activeAds.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Currently running</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Expired Ads</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{expiredAds.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Need renewal</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="requests" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger>
                    <TabsTrigger value="active">Active ({activeAds.length})</TabsTrigger>
                    <TabsTrigger value="expired">Expired ({expiredAds.length})</TabsTrigger>
                </TabsList>

                {/* REQUESTS TAB */}
                <TabsContent value="requests" className="space-y-4">
                    {loading ? (
                        <div className="p-12 text-center">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                            <p className="text-muted-foreground">Loading requests...</p>
                        </div>
                    ) : requests.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                                <p className="font-semibold">No pending ad requests</p>
                                <p className="text-sm text-muted-foreground">New requests will appear here</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {requests.map(req => (
                                <Card key={req.id} className="border-l-4 border-l-amber-500">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                                                    <Calendar className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold">{req.propertyTitle || "Property Request"}</h3>
                                                    <div className="text-sm text-muted-foreground space-y-1 mt-1">
                                                        <p>Owner: <span className="font-medium">{req.ownerName}</span> ({req.ownerEmail})</p>
                                                        <p>Duration: <span className="font-semibold text-amber-600">{req.duration} Days</span></p>
                                                        <p className="text-xs">Property ID: {req.propertyId}</p>
                                                        <p className="text-xs">Requested: {new Date(req.createdAt).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 w-full md:w-auto">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-red-600 hover:bg-red-50 hover:text-red-700 flex-1"
                                                    onClick={() => openConfirm('reject', req.id)}
                                                >
                                                    <X className="w-4 h-4 mr-1" />
                                                    Reject
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                                                    onClick={() => openConfirm('approve', req.id, req)}
                                                >
                                                    <Check className="w-4 h-4 mr-1" />
                                                    Approve
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* ACTIVE ADS TAB */}
                <TabsContent value="active" className="space-y-4">
                    {activeAds.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                                <p className="font-semibold">No active advertisements</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activeAds.map(ad => (
                                <Card key={ad.id} className="overflow-hidden border-emerald-200">
                                    <div className="h-40 w-full bg-gray-100 relative">
                                        <img src={fixImageUrl(ad.image)} alt={ad.title} className="w-full h-full object-cover" />
                                        <Badge className="absolute top-2 right-2 bg-emerald-500">
                                            <TrendingUp className="w-3 h-3 mr-1" />
                                            Live
                                        </Badge>
                                    </div>
                                    <CardContent className="p-4">
                                        <h3 className="font-bold truncate text-sm">{ad.title}</h3>
                                        <div className="text-xs text-muted-foreground mt-2 space-y-1">
                                            <p className="font-semibold text-emerald-600">
                                                Expires: {new Date(ad.sponsoredUntil).toLocaleDateString()}
                                            </p>
                                            <p>Owner: {ad.ownerName}</p>
                                            <p>₹{ad.price}</p>
                                        </div>
                                        <div className="flex gap-2 mt-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 text-xs"
                                                onClick={() => renewAd(ad.id, 7)}
                                            >
                                                Renew
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="flex-1 text-xs"
                                                onClick={() => openConfirm('stop', ad.id)}
                                            >
                                                Stop
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* EXPIRED ADS TAB */}
                <TabsContent value="expired" className="space-y-4">
                    {expiredAds.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <p className="text-muted-foreground">No expired ads</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {expiredAds.map(ad => (
                                <Card key={ad.id} className="overflow-hidden border-red-200 opacity-75">
                                    <div className="h-40 w-full bg-gray-100 relative">
                                        <img src={fixImageUrl(ad.image)} alt={ad.title} className="w-full h-full object-cover grayscale" />
                                        <Badge className="absolute top-2 right-2 bg-red-500">Expired</Badge>
                                    </div>
                                    <CardContent className="p-4">
                                        <h3 className="font-bold truncate text-sm">{ad.title}</h3>
                                        <div className="text-xs text-muted-foreground mt-2 space-y-1">
                                            <p className="text-red-600 font-semibold">
                                                Expired: {ad.sponsoredUntil ? new Date(ad.sponsoredUntil).toLocaleDateString() : 'N/A'}
                                            </p>
                                            <p>Owner: {ad.ownerName}</p>
                                        </div>
                                        <div className="flex gap-2 mt-3">
                                            <Button
                                                size="sm"
                                                className="flex-1 text-xs bg-primary"
                                                onClick={() => renewAd(ad.id, 7)}
                                            >
                                                Renew
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 text-xs"
                                                onClick={() => openConfirm('stop', ad.id)}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmDialog.type === 'approve' && "Approve Advertisement?"}
                            {confirmDialog.type === 'reject' && "Reject Request?"}
                            {confirmDialog.type === 'stop' && "Stop Advertisement?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDialog.type === 'approve' && "This will promote the property to the Premium Collection immediately. The user will be notified."}
                            {confirmDialog.type === 'reject' && "Are you sure? This request will be permanently deleted and cannot be undone."}
                            {confirmDialog.type === 'stop' && "This will remove the ad from the Premium Collection instantly. This action cannot be undone."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmAction}
                            className={
                                confirmDialog.type === 'approve'
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-red-600 hover:bg-red-700"
                            }
                        >
                            {confirmDialog.type === 'approve' ? "Confirm Approval" : "Yes, Proceed"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
