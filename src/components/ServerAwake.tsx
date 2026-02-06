import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export const SERVER_URL = "https://rentelme-server.onrender.com";

export const ServerAwake = ({ children }: { children: React.ReactNode }) => {
    const [isAwake, setIsAwake] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const wakeUp = async () => {
            try {
                const res = await fetch(`${SERVER_URL}/`);
                if (res.ok) {
                    setIsAwake(true);
                } else {
                    throw new Error("Server sleeping");
                }
            } catch (e) {
                // Retry logic for cold start (it can take up to 60s)
                if (attempt < 10) {
                    setTimeout(() => setAttempt(p => p + 1), 2000);
                }
            }
        };

        wakeUp();
    }, [attempt]);

    if (!isAwake) {
        return (
            <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-gray-100">
                    <div className="relative w-16 h-16 mx-auto mb-6">
                        <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <Loader2 className="absolute inset-0 w-full h-full p-4 text-primary animate-pulse" />
                    </div>
                    <h2 className="text-xl font-bold text-navy mb-2">Starting Secure Server</h2>
                    <p className="text-muted-foreground text-sm">
                        Please wait a moment while we establish a secure connection to the cloud backend. This normally takes about 30-50 seconds.
                    </p>
                    <div className="mt-6 h-1 w-full bg-secondary/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-progress origin-left w-full duration-[40s]"></div>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
