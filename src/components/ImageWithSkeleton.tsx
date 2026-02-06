import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

interface ImageWithSkeletonProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    containerClassName?: string;
    children?: React.ReactNode;
}

export const ImageWithSkeleton = ({ containerClassName = "", className = "", src, alt, children, ...props }: ImageWithSkeletonProps) => {
    const [isLoading, setIsLoading] = useState(true);

    // Fix Legacy Localhost URLs to Production Render URL
    const processedSrc = src?.includes("localhost:3000")
        ? src.replace("http://localhost:3000", "https://rentelme-server.onrender.com")
        : src;

    return (
        <div className={`relative overflow-hidden bg-muted ${containerClassName}`}>
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-secondary/10 animate-pulse z-10">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                </div>
            )}
            <img
                src={processedSrc}
                alt={alt}
                className={`${className} transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setIsLoading(false)}
                onError={(e) => {
                    setIsLoading(false);
                    e.currentTarget.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";
                }}
                {...props}
            />
            {children}
        </div>
    );
};
