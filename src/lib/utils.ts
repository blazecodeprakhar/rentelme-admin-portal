import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fixImageUrl = (url: string | undefined | null) => {
  if (!url) return "";
  if (url.includes("localhost:3000")) {
    return url.replace("http://localhost:3000", "https://rentelme-server.onrender.com");
  }
  return url;
};
