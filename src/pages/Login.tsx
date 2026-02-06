
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Building2, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            // Check if admin is rentelme0@gmail.com
            const ADMIN_EMAIL = "rentelme0@gmail.com";
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Special Logic for Super Admin
            if (userCredential.user.email === ADMIN_EMAIL) {
                const userDocRef = doc(db, "users", userCredential.user.uid);

                // Try to check/seed admin
                try {
                    const userDoc = await getDoc(userDocRef);
                    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
                        await setDoc(userDocRef, {
                            uid: userCredential.user.uid,
                            email: ADMIN_EMAIL,
                            role: "admin",
                            fullName: "Super Admin",
                            createdAt: new Date().toISOString()
                        }, { merge: true });
                    }
                } catch (readErr: any) {
                    console.warn("Read failed, attempting blind write for admin seed:", readErr);
                    try {
                        await setDoc(userDocRef, {
                            uid: userCredential.user.uid,
                            email: ADMIN_EMAIL,
                            role: "admin",
                            fullName: "Super Admin",
                            createdAt: new Date().toISOString()
                        }, { merge: true });
                    } catch (writeErr) {
                        throw writeErr;
                    }
                }

                navigate("/dashboard");
                return;
            }

            // Normal Admin/Employee Login
            const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
            if (userDoc.exists() && (userDoc.data().role === "admin" || userDoc.data().role === "employee")) {
                navigate("/dashboard");
            } else {
                throw new Error("Unauthorized access. Admin only.");
            }

        } catch (err: any) {
            console.error("Login error:", err);

            // AUTO-SEED Super Admin if missing in AUTH
            if ((err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') && email === "rentelme0@gmail.com") {
                try {
                    const newUserCred = await createUserWithEmailAndPassword(auth, email, password);
                    await setDoc(doc(db, "users", newUserCred.user.uid), {
                        uid: newUserCred.user.uid,
                        email: email,
                        role: "admin",
                        fullName: "Super Admin",
                        createdAt: new Date().toISOString()
                    });
                    navigate("/dashboard");
                    return;
                } catch (createErr: any) {
                    setError("Failed to create/login admin account: " + createErr.message);
                    return;
                }
            }

            setError(err.message || "Invalid email or password");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-black px-4">
            <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>

            <Card className="w-full max-w-md shadow-xl border-border/40 backdrop-blur-sm bg-background/95">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-6">
                        <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                            <Building2 className="h-6 w-6 text-primary-foreground" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-center tracking-tight">Admin Portal</CardTitle>
                    <CardDescription className="text-center text-muted-foreground">
                        Enter your credentials to access the dashboard
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md text-center">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@rentelme.com"
                                    className="pl-9"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="pl-9 pr-10"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full shadow-lg shadow-primary/20" size="lg" disabled={isLoading}>
                            {isLoading ? "Authenticating..." : "Sign In"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            <div className="absolute bottom-6 text-center text-xs text-muted-foreground">
                <p>&copy; 2026 RenTelMe Inc. Authorized Access Only.</p>
            </div>
        </div>
    );
}
