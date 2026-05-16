import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  key?: React.Key;
}

const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn("animate-pulse bg-app-text/5 rounded-2xl", className)} />
);

export default function WeatherSkeleton() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-[390px] mx-auto px-1 py-4">
      {/* Search Bar Skeleton */}
      <Skeleton className="h-14 rounded-[28px] w-full" />

      {/* Hero Section Skeleton */}
      <div className="flex flex-col items-center pt-8 pb-4">
        <Skeleton className="w-24 h-4 mb-4 rounded-full" />
        <Skeleton className="w-32 h-20 mb-2" />
        <Skeleton className="w-40 h-6 mb-8" />
        
        <div className="flex gap-4 w-full justify-center">
          <Skeleton className="w-20 h-8 rounded-full" />
          <Skeleton className="w-20 h-8 rounded-full" />
        </div>
      </div>

      {/* Hourly Forecast Skeleton */}
      <div className="flex flex-col gap-4">
        <Skeleton className="w-32 h-4 ml-2" />
        <div className="flex gap-3 overflow-hidden pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="min-w-[70px] h-[130px] rounded-[30px]" />
          ))}
        </div>
      </div>

      {/* 7-Day Forecast Skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between px-2">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-4 h-4" />
        </div>
        <div className="bg-app-surface backdrop-blur-3xl rounded-[32px] p-2 border border-app-border">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b border-app-border last:border-none">
              <Skeleton className="w-20 h-4" />
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="w-24 h-4" />
            </div>
          ))}
        </div>
      </div>

      {/* AQI Skeleton */}
      <div className="bg-app-surface border border-app-border rounded-[32px] p-6 h-[280px]">
        <div className="flex justify-between mb-8">
          <Skeleton className="w-40 h-6" />
          <Skeleton className="w-12 h-6 rounded-full" />
        </div>
        <Skeleton className="w-24 h-16 mb-4" />
        <Skeleton className="w-48 h-6 mb-6" />
        <Skeleton className="w-full h-2 rounded-full mb-8" />
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="flex-1 h-12" />
          ))}
        </div>
      </div>

      {/* Details Grid Skeleton */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[124px] rounded-[28px]" />
        ))}
      </div>
    </div>
  );
}
