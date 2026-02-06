import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fixImageUrl = (url: string | undefined | null) => {
  if (!url) return "";
  if (url.includes("localhost:3000")) {
    // Replace both http and https variants just in case
    let fixed = url.replace("http://localhost:3000", "https://rentelme-server.onrender.com");
    fixed = fixed.replace("https://localhost:3000", "https://rentelme-server.onrender.com");
    return fixed;
  }
  return url;
};
