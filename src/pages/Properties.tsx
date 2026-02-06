
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Search, MapPin, Home, RefreshCcw, Power, Eye, ImageIcon, Phone, Trash2, Repeat2 } from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, updateDoc, doc, query, deleteDoc } from "firebase/firestore";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";

export default function Properties() {
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [rejectionDialog, setRejectionDialog] = useState<{ isOpen: boolean; propertyId: string | null }>({ isOpen: false, propertyId: null });
    const [detailsDialog, setDetailsDialog] = useState<{ isOpen: boolean; property: any | null }>({ isOpen: false, property: null });
    const [rejectionReason, setRejectionReason] = useState("");
    const [customReason, setCustomReason] = useState("");
    const [selectedImage, setSelectedImage] = useState<string | null>(null); // New State for Image Viewer
    const [activeTab, setActiveTab] = useState("all");

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "properties"));
            const querySnapshot = await getDocs(q);
            const fetchedProperties = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    status: data.status || 'Pending'
                };
            });
            setProperties(fetchedProperties);
        } catch (error) {
            console.error("Error fetching properties:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProperties();
    }, []);

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, "properties", id), {
                status: newStatus,
                isUserActive: true
            });
            setProperties(properties.map(p => p.id === id ? { ...p, status: newStatus, isUserActive: true } : p));
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const handleReject = async () => {
        if (!rejectionDialog.propertyId) return;

        const finalReason = rejectionReason === "Others" ? customReason : rejectionReason;
        if (!finalReason) return;

        try {
            await updateDoc(doc(db, "properties", rejectionDialog.propertyId), {
                status: 'Rejected',
                rejectionReason: finalReason,
                isUserActive: false
            });

            setProperties(properties.map(p => p.id === rejectionDialog.propertyId ? { ...p, status: 'Rejected', rejectionReason: finalReason, isUserActive: false } : p));
            setRejectionDialog({ isOpen: false, propertyId: null });
            setRejectionReason("");
            setCustomReason("");
        } catch (error) {
            console.error("Error rejecting property:", error);
        }
    };

    const toggleActive = async (id: string, currentActive: boolean) => {
        try {
            await updateDoc(doc(db, "properties", id), {
                isUserActive: !currentActive
            });
            setProperties(properties.map(p => p.id === id ? { ...p, isUserActive: !currentActive } : p));
        } catch (error) {
            console.error("Error updating active status:", error);
        }
    };

    const handleDelete = async (id: string) => {
        const toastId = toast.loading("Deleting property and images...");
        try {
            // 1. Find property to get images
            const property = properties.find(p => p.id === id);

            if (property && property.images && property.images.length > 0) {
                const deletionPromises = property.images.map(async (url: string) => {
                    try {
                        // Extract ID from either http://localhost:3000/image/ID or direct link
                        // If using proxy format:
                        if (url.includes('/image/')) {
                            const fileId = url.split('/image/')[1];
                            await fetch(`http://localhost:3000/image/${fileId}`, { method: 'DELETE' });
                        }
                    } catch (e) {
                        console.error("Failed to delete image:", url);
                    }
                });
                await Promise.all(deletionPromises);
            }

            await deleteDoc(doc(db, "properties", id));
            setProperties(properties.filter(p => p.id !== id));
            setDetailsDialog({ isOpen: false, property: null });
            toast.success("Property deleted successfully", { id: toastId });
        } catch (error) {
            console.error("Error deleting property:", error);
            toast.error("Failed to delete property", { id: toastId });
        }
    };

    const filteredProperties = properties.filter(p => {
        const matchesSearch = (p.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (p.location?.toLowerCase() || "").includes(searchTerm.toLowerCase());

        let matchesTab = true;
        if (activeTab === 'pending') matchesTab = (p.status === 'Pending' || !p.status);
        if (activeTab === 'approved') matchesTab = p.status === 'Verified';
        if (activeTab === 'rejected') matchesTab = p.status === 'Rejected';

        return matchesSearch && matchesTab;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Property Management</h1>
                <p className="text-muted-foreground mt-1">Review, approve, or reject property listings.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <Tabs defaultValue="all" className="w-full md:w-auto" onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="all">All Properties</TabsTrigger>
                        <TabsTrigger value="pending">Pending</TabsTrigger>
                        <TabsTrigger value="approved">Approved</TabsTrigger>
                        <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-[300px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search properties..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchProperties}>
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20">Loading Properties...</div>
            ) : filteredProperties.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredProperties.map((property) => (
                        <Card key={property.id} className="overflow-hidden flex flex-col relative">
                            {/* Reapplied Badge */}
                            {property.isReapplication && (
                                <div className="absolute top-2 left-2 z-20 bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
                                    <Repeat2 className="w-3 h-3" /> Reapplied
                                </div>
                            )}

                            <div className="aspect-video w-full bg-muted flex items-center justify-center text-muted-foreground relative group cursor-pointer" onClick={() => setDetailsDialog({ isOpen: true, property })}>
                                {property.image ? (
                                    <ImageWithSkeleton
                                        src={property.image}
                                        alt={property.title}
                                        containerClassName="w-full h-full"
                                        className={`w-full h-full object-cover transition-opacity ${!property.isUserActive ? 'opacity-50 grayscale' : ''}`}
                                    >
                                        {!property.isUserActive && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
                                                <span className="bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">Inactive</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                                            <div className="bg-white/90 text-black px-4 py-2 rounded-full font-medium flex items-center gap-2">
                                                <Eye className="w-4 h-4" /> View Details
                                            </div>
                                        </div>
                                    </ImageWithSkeleton>
                                ) : (
                                    <Home className="h-10 w-10 opacity-20" />
                                )}
                            </div>
                            <CardHeader className="p-4">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1">
                                        <CardTitle className="text-lg line-clamp-1">{property.title || "Untitled Property"}</CardTitle>
                                        <CardDescription className="flex items-center mt-1 line-clamp-1">
                                            <MapPin className="h-3 w-3 mr-1 shrink-0" />
                                            {property.location || "No location provided"}
                                        </CardDescription>
                                    </div>
                                    <div className={`px-2 py-1 rounded-full text-xs font-medium border shrink-0 ${property.status === 'Verified' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                        property.status === 'Rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                                            'bg-amber-100 text-amber-700 border-amber-200'
                                        }`}>
                                        {property.status === 'Verified' ? 'Approved' : property.status || "Pending"}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-4 mt-auto">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Type: {Array.isArray(property.type) ? property.type.join(", ") : property.type || "N/A"}</span>
                                    <span className="font-semibold">₹{property.price}/mo</span>
                                </div>
                                <div className="text-xs text-muted-foreground flex justify-between items-center">
                                    <span>By: {property.ownerName || "Unknown"}</span>
                                    <span className="text-[10px]">{new Date(property.createdAt).toLocaleDateString()}</span>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => toggleActive(property.id, !!property.isUserActive)}
                                        title={property.isUserActive ? "Pause Property" : "Activate Property"}
                                        className={property.isUserActive ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}
                                    >
                                        <Power className="h-4 w-4" />
                                    </Button>

                                    <Button
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                        size="sm"
                                        onClick={() => handleStatusChange(property.id, 'Verified')}
                                        disabled={property.status === 'Verified'}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        {property.status === 'Verified' ? 'Approved' : 'Approve'}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="flex-1"
                                        size="sm"
                                        onClick={() => setRejectionDialog({ isOpen: true, propertyId: property.id })}
                                        disabled={property.status === 'Rejected'}
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        {property.status === 'Rejected' ? 'Rejected' : 'Reject'}
                                    </Button>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete the property listing from the database.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(property.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                    <div className="flex flex-col items-center gap-2">
                        <Home className="h-10 w-10 text-muted-foreground/50" />
                        <h3 className="font-semibold">No properties found</h3>
                        <p className="text-sm text-muted-foreground">
                            {activeTab !== 'all'
                                ? `There are no ${activeTab} properties at the moment.`
                                : "No properties have been listed yet."}
                        </p>
                    </div>
                </div>
            )}

            {/* Rejection Dialog */}
            <Dialog open={rejectionDialog.isOpen} onOpenChange={(open) => !open && setRejectionDialog({ isOpen: false, propertyId: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Property Listing</DialogTitle>
                        <DialogDescription>
                            Please specify the reason for rejection. This will be visible to the user.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Reason</Label>
                            <select
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                            >
                                <option value="" disabled>Select a reason</option>
                                <option value="Incomplete Information">Incomplete Information</option>
                                <option value="Inappropriate Images">Inappropriate Images</option>
                                <option value="Duplicate Listing">Duplicate Listing</option>
                                <option value="Price Mismatch">Price Mismatch</option>
                                <option value="Others">Others</option>
                            </select>
                        </div>
                        {rejectionReason === "Others" && (
                            <div className="space-y-2">
                                <Label>Custom Reason</Label>
                                <Textarea
                                    placeholder="Enter specific reason..."
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectionDialog({ isOpen: false, propertyId: null })}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason || (rejectionReason === "Others" && !customReason)}>Reject Property</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Details Dialog */}
            <Dialog open={detailsDialog.isOpen} onOpenChange={(open) => !open && setDetailsDialog({ isOpen: false, property: null })}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between pr-4">
                            <DialogTitle>Property Details</DialogTitle>
                            {detailsDialog.property?.isReapplication && (
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                                    <Repeat2 className="w-3 h-3" /> Reapplied
                                </span>
                            )}
                        </div>
                        <DialogDescription>
                            Review complete information before taking action.
                        </DialogDescription>
                    </DialogHeader>
                    {detailsDialog.property && (
                        <div className="space-y-6 py-4">
                            {/* Images Grid */}
                            <div className="space-y-2">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4" /> Property Images
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {detailsDialog.property.images && detailsDialog.property.images.length > 0 ? (
                                        detailsDialog.property.images.map((img: string, index: number) => (
                                            <div
                                                key={index}
                                                className="aspect-video bg-muted rounded-md overflow-hidden relative cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                                onClick={() => setSelectedImage(img)}
                                            >
                                                <img src={img} alt={`Property ${index + 1}`} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                                                    <Eye className="w-6 h-6 text-white opacity-0 hover:opacity-100 drop-shadow-md" />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        // Fallback if only main image exists (old data)
                                        <div className="aspect-video bg-muted rounded-md overflow-hidden relative col-span-2 md:col-span-3">
                                            <img src={detailsDialog.property.image} alt="Main" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Title</Label>
                                        <p className="font-medium text-lg">{detailsDialog.property.title}</p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Price</Label>
                                        <p className="font-medium text-lg">₹{detailsDialog.property.price}/month</p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Location</Label>
                                        <p className="text-sm">{detailsDialog.property.address}</p>
                                        <p className="text-sm text-muted-foreground">{detailsDialog.property.city}, {detailsDialog.property.pincode}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Owner Info</Label>
                                        <p className="font-medium">{detailsDialog.property.ownerName}</p>
                                        <div className="flex flex-col gap-1 mt-1">
                                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                <span className="w-4 h-4 flex items-center justify-center rounded-full bg-primary/10 text-[10px]">@</span>
                                                {detailsDialog.property.ownerEmail}
                                            </p>
                                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Phone className="w-3 h-3" />
                                                {detailsDialog.property.ownerPhone || "Not Provided"}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Attributes</Label>
                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                            <div className="bg-secondary/20 p-2 rounded text-xs">
                                                <span className="block text-muted-foreground">Parking</span>
                                                <span className="font-medium capitalize">{detailsDialog.property.parking}</span>
                                            </div>
                                            <div className="bg-secondary/20 p-2 rounded text-xs">
                                                <span className="block text-muted-foreground">For</span>
                                                <span className="font-medium">
                                                    {Array.isArray(detailsDialog.property.type) ? detailsDialog.property.type.join(", ") : detailsDialog.property.type}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Description</Label>
                                <div className="bg-muted/30 p-3 rounded-md text-sm mt-1 whitespace-pre-wrap border">
                                    {detailsDialog.property.description}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <div className="flex-1 flex justify-start">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" className="text-destructive hover:bg-destructive/10">
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Property?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to delete {detailsDialog.property?.title}? This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(detailsDialog.property.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>

                        <Button variant="outline" onClick={() => setDetailsDialog({ isOpen: false, property: null })}>Close</Button>

                        {detailsDialog.property?.status === 'Pending' && (
                            <>
                                <Button variant="destructive" onClick={() => {
                                    setRejectionDialog({ isOpen: true, propertyId: detailsDialog.property.id });
                                    setDetailsDialog({ isOpen: false, property: null });
                                }}>Reject</Button>
                                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                                    handleStatusChange(detailsDialog.property.id, 'Verified');
                                    setDetailsDialog({ isOpen: false, property: null });
                                }}>Approve</Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Image Viewer Dialog */}
            <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
                <DialogContent className="max-w-5xl w-full p-1 bg-black/95 border-none shadow-2xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>View Image</DialogTitle>
                    </DialogHeader>
                    <div className="relative w-full h-[80vh] flex items-center justify-center">
                        <img
                            src={selectedImage || ""}
                            alt="Full Screen View"
                            className="max-w-full max-h-full object-contain rounded-sm"
                        />
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-white/20 transition-colors backdrop-blur-sm"
                        >
                            <XCircle className="w-6 h-6" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
