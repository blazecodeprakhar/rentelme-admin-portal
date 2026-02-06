
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Moon, Sun, Monitor, UserPlus, Trash2, Shield, Users, Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useState, useEffect } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut } from "firebase/auth";
import { collection, getDocs, query, where, deleteDoc, doc, setDoc, getFirestore } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Manually defining config to ensure it works even if env vars are flaky, though usually they are fine
// Using the same config as in firebase.ts for consistency
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export default function Settings() {
    const { setTheme, theme } = useTheme();
    const { currentUser } = useAuth();

    // Employee Management State
    const [employees, setEmployees] = useState<any[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [newEmployee, setNewEmployee] = useState({ name: "", email: "", password: "" });
    const [creatingEmployee, setCreatingEmployee] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // Password visibility for add employee form
    const [showEmpPassword, setShowEmpPassword] = useState(false);

    useEffect(() => {
        // Check if current user is the super admin (rentelme0@gmail.com)
        if (currentUser?.email === 'rentelme0@gmail.com') {
            setIsSuperAdmin(true);
            fetchEmployees();
        }
    }, [currentUser]);

    const fetchEmployees = async () => {
        setLoadingEmployees(true);
        try {
            // Fetch users with role 'employee'
            const q = query(collection(db, "users"), where("role", "==", "employee"));
            const querySnapshot = await getDocs(q);
            const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEmployees(fetched);
        } catch (error) {
            console.error("Error fetching employees:", error);
            toast.error("Failed to load employees.");
        } finally {
            setLoadingEmployees(false);
        }
    };

    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingEmployee(true);

        let secondaryApp: any = null;

        try {
            // 1. Initialize secondary app to create user without signing out admin
            // We use a unique name to avoid conflicts
            const appName = "SecondaryApp-" + new Date().getTime();
            secondaryApp = initializeApp(firebaseConfig, appName);
            const secondaryAuth = getAuth(secondaryApp);

            // 2. Create user in Auth (this signs them in on the secondary app instance)
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmployee.email, newEmployee.password);
            const user = userCredential.user;

            // 3. Create user doc in Firestore
            // CRITICAL FIX: We use the secondary app's Firestore instance.
            // Why? Because 'user' is authenticated on 'secondaryApp'.
            // The default 'db' is authenticated as 'Super Admin'.
            // If we use 'db', we are writing as Super Admin. This SHOULD work if Super Admin has permission.
            // BUT if we use 'secondaryDb', we are writing as 'New Employee'.
            // A user ALWAYS has permission to write their own profile (typically).
            // This is safer if Rules block Admin from writing random user docs.

            // However, to be extra safe against "only owner can write" rules, let's try writing as the User themselves.
            const secondaryDb = getFirestore(secondaryApp);

            await setDoc(doc(secondaryDb, "users", user.uid), {
                uid: user.uid,
                email: newEmployee.email,
                displayName: newEmployee.name,
                role: "employee",
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.email
            });

            // 4. Sign out secondary auth
            await secondarySignOut(secondaryAuth);

            toast.success("Employee created successfully!");
            setNewEmployee({ name: "", email: "", password: "" });
            fetchEmployees(); // Refresh list

        } catch (error: any) {
            console.error("Error creating employee:", error);
            if (error.code === 'auth/email-already-in-use') {
                toast.error("Email is already in use.");
            } else if (error.code === 'permission-denied') {
                toast.error("Permission denied. Database rules might be blocking creation.");
            } else {
                toast.error("Failed to create employee: " + error.message);
            }
        } finally {
            if (secondaryApp) {
                try {
                    deleteApp(secondaryApp);
                } catch (e) {
                    // ignore cleanup errors
                    console.log("Cleanup warning", e);
                }
            }
            setCreatingEmployee(false);
        }
    };

    const handleDeleteEmployee = async (employeeId: string) => {
        try {
            // 1. Delete from Firestore
            await deleteDoc(doc(db, "users", employeeId));

            toast.success("Employee deleted successfully. Access revoked.");
            setEmployees(employees.filter(emp => emp.id !== employeeId));
        } catch (error) {
            console.error("Error deleting employee:", error);
            toast.error("Failed to delete employee.");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-1">Manage your platform preferences and team.</p>
            </div>

            <Tabs defaultValue="appearance" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="appearance" className="flex gap-2"><Monitor className="w-4 h-4" /> Appearance</TabsTrigger>
                    <TabsTrigger value="account" className="flex gap-2"><Shield className="w-4 h-4" /> Account</TabsTrigger>
                    {isSuperAdmin && (
                        <TabsTrigger value="team" className="flex gap-2"><Users className="w-4 h-4" /> Employee Management</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="appearance">
                    <Card>
                        <CardHeader>
                            <CardTitle>Theme Preferences</CardTitle>
                            <CardDescription>
                                Customize the look and feel of the admin portal.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <h3 className="text-base font-medium">Dark Mode</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Switch between light and dark themes.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row bg-muted rounded-lg p-1 gap-1 w-full md:w-auto">
                                    <Button
                                        variant={theme === "light" ? "default" : "ghost"}
                                        size="sm"
                                        className="h-9 rounded-md px-3 justify-start sm:justify-center"
                                        onClick={() => setTheme("light")}
                                    >
                                        <Sun className="h-4 w-4 mr-2" /> Light
                                    </Button>
                                    <Button
                                        variant={theme === "dark" ? "default" : "ghost"}
                                        size="sm"
                                        className="h-9 rounded-md px-3 justify-start sm:justify-center"
                                        onClick={() => setTheme("dark")}
                                    >
                                        <Moon className="h-4 w-4 mr-2" /> Dark
                                    </Button>
                                    <Button
                                        variant={theme === "system" ? "default" : "ghost"}
                                        size="sm"
                                        className="h-9 rounded-md px-3 justify-start sm:justify-center"
                                        onClick={() => setTheme("system")}
                                    >
                                        <Monitor className="h-4 w-4 mr-2" /> System
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="account">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Information</CardTitle>
                            <CardDescription>Update your personal details.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 max-w-xl">
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" value={currentUser?.email || ''} disabled />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="role">Role</Label>
                                    <Input id="role" value={isSuperAdmin ? 'Super Admin' : 'Employee'} disabled />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {isSuperAdmin && (
                    <TabsContent value="team" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserPlus className="h-5 w-5 text-primary" />
                                    Add New Employee
                                </CardTitle>
                                <CardDescription>
                                    Create a new account for your staff. They can log in to manage properties but cannot modify settings.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleCreateEmployee} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="empName">Full Name</Label>
                                            <Input
                                                id="empName"
                                                placeholder="John Doe"
                                                value={newEmployee.name}
                                                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="empEmail">Email Address</Label>
                                            <Input
                                                id="empEmail"
                                                type="email"
                                                placeholder="employee@rentelme.com"
                                                value={newEmployee.email}
                                                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="empPass">Password</Label>
                                            <div className="relative">
                                                <Input
                                                    id="empPass"
                                                    type={showEmpPassword ? "text" : "password"}
                                                    placeholder="Strong password"
                                                    value={newEmployee.password}
                                                    onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                                                    minLength={6}
                                                    required
                                                    className="pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowEmpPassword(!showEmpPassword)}
                                                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showEmpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <Button type="submit" disabled={creatingEmployee} className="w-full bg-primary hover:bg-primary/90">
                                        {creatingEmployee ? "Creating Account..." : "Create Employee Account"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Team Directory</CardTitle>
                                <CardDescription>
                                    Manage existing employee accounts.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingEmployees ? (
                                    <div className="text-center py-8">Loading team...</div>
                                ) : employees.length > 0 ? (
                                    <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="min-w-[150px]">Name</TableHead>
                                                    <TableHead className="min-w-[200px]">Email</TableHead>
                                                    <TableHead className="min-w-[100px]">Role</TableHead>
                                                    <TableHead className="min-w-[120px]">Created</TableHead>
                                                    <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {employees.map((emp) => (
                                                    <TableRow key={emp.id}>
                                                        <TableCell className="font-medium">{emp.displayName || "N/A"}</TableCell>
                                                        <TableCell>{emp.email}</TableCell>
                                                        <TableCell>
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                                                                {emp.role}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground text-sm">
                                                            {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString() : 'N/A'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Revoke Access?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Are you sure you want to delete <b>{emp.email}</b>? They will no longer be able to log in to the admin portal.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteEmployee(emp.id)} className="bg-destructive">Revoke Access</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="text-center py-10 bg-muted/20 rounded-lg border border-dashed">
                                        <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                                        <h3 className="font-medium text-muted-foreground">No employees found</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Add your first team member above.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
