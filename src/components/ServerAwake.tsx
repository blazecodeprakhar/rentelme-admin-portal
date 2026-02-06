import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export const SERVER_URL = "https://rentelme-server.onrender.com";

export const ServerAwake = ({ children }: { children: React.ReactNode }) => {
    const [attempt, setAttempt] = useState(0);

    // Non-blocking background ping
    useEffect(() => {
        const wakeUp = async () => {
            try {
                await fetch(`${SERVER_URL}/`);
            } catch (e) {
                if (attempt < 5) {
                    setTimeout(() => setAttempt(p => p + 1), 5000);
                }
            }
        };

        wakeUp();
    }, [attempt]);

    return <>{children}</>;
};
