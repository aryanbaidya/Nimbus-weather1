import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GLASS_STYLE = "bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[24px]";
export const GLASS_STYLE_SUBTLE = "bg-white/5 backdrop-blur-xl border border-white/5 rounded-[20px]";
