import React, { useEffect } from 'react';
import { motion, useInView, animate, useMotionValue, useTransform } from 'motion/react';
import { WeatherData, Settings } from '../types';
import { WeatherIcon, RawIcons } from './WeatherIcons';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { cn } from '../lib/utils';

interface SunPathProps {
  weather: WeatherData;
  settings: Settings;
}

export default function SunPath({ weather, settings }: SunPathProps) {
  const containerRef = React.useRef(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });
  
  // Local state to force re-renders for real-time sun movement
  const [, setTick] = React.useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!weather?.daily?.sunrise?.[0] || !weather?.daily?.sunset?.[0]) return null;

  // BUG 1 FIX: Calculate current time in the target location's timezone
  const getNowInLocation = (timezone: string) => {
    try {
      const now = new Date();
      // Use toLocaleString to get the time in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });
      
      const parts = formatter.formatToParts(now);
      const partValues: Record<string, any> = {};
      parts.forEach(p => partValues[p.type] = p.value);
      
      // Construct a Date object that represents the local time in that city
      return new Date(
        parseInt(partValues.year),
        parseInt(partValues.month) - 1,
        parseInt(partValues.day),
        parseInt(partValues.hour),
        parseInt(partValues.minute),
        parseInt(partValues.second)
      );
    } catch (e) {
      console.warn('Timezone conversion failed, falling back to naive:', e);
      return new Date();
    }
  };

  const nowInLocation = getNowInLocation(weather.timezone);
  const currentHour = nowInLocation.getHours();
  const currentMinute = nowInLocation.getMinutes();
  const nowMinutes = currentHour * 60 + currentMinute;

  // Helper to get minutes from H:M format
  const getMinutesFromISO = (iso: string) => {
    // Open-Meteo with timezone=auto returns "YYYY-MM-DDTHH:MM"
    const timePart = iso.split('T')[1] || iso;
    const [h, m] = timePart.split(':').map(Number);
    return h * 60 + m;
  };

  const sunriseMinutes = getMinutesFromISO(weather.daily.sunrise[0]);
  const sunsetMinutes = getMinutesFromISO(weather.daily.sunset[0]);
  
  const totalDaylightMinutes = sunsetMinutes - sunriseMinutes;
  const currentElapsedMinutes = nowMinutes - sunriseMinutes;

  if (isNaN(totalDaylightMinutes) || totalDaylightMinutes <= 0) return null;

  // Progress logic: 0 at sunrise, 1 at sunset
  const isSunVisible = nowMinutes >= sunriseMinutes && nowMinutes <= sunsetMinutes;
  let progress = currentElapsedMinutes / totalDaylightMinutes;
  
  // Night handling: clamp to boundaries
  if (nowMinutes < sunriseMinutes) progress = 0;
  if (nowMinutes > sunsetMinutes) progress = 1;
  
  progress = Math.max(0, Math.min(1, progress));

  // Display formatting for labels using the target timezone
  const formatTime = (iso: string) => {
    try {
      // Open-Meteo with timezone=auto returns strings that are ALREADY local to the city.
      // To display them exactly as-is without browser offset interference, 
      // we append 'Z' to treat it as UTC and then format it in UTC.
      const date = parseISO(iso.includes('Z') ? iso : `${iso}:00Z`);
      return date.toLocaleTimeString("en-US", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return iso;
    }
  };

  const sunriseLabel = formatTime(weather.daily.sunrise[0]);
  const sunsetLabel = formatTime(weather.daily.sunset[0]);

  // Visual Geometry based on image:
  // A perfect smooth Bézier arch (parabola approximation)
  const width = 350;
  const height = 200; // Increased height to accommodate the night arch below
  const horizonY = 100; // Center the horizon
  const curveHeight = 60; 
  
  const startX = 60;
  const endX = 290;
  const centerX = (startX + endX) / 2;
  const daylightControlY = horizonY - (2 * curveHeight);
  const troughHeight = curveHeight * 0.4;

  // Paths following the image style: ensuring horizontal entry (slope 0) at the lowest points on the edges
  const daylightArch = `M ${startX} ${horizonY} Q ${centerX} ${daylightControlY} ${endX} ${horizonY}`;
  // Left trough: starts horizontal at the edge (lowest point) and curves up to sunrise
  const leftTrough = `M 10 ${horizonY + troughHeight} Q 35 ${horizonY + troughHeight} ${startX} ${horizonY}`;
  // Right trough: starts at sunset and curves down to be horizontal at the edge (lowest point)
  const rightTrough = `M ${endX} ${horizonY} Q ${width - 35} ${horizonY + troughHeight} ${width - 10} ${horizonY + troughHeight}`;

  // Motion setup for smooth, path-aligned animation
  const motionProgress = useMotionValue(0);
  
  useEffect(() => {
    if (isInView) {
      animate(motionProgress, progress, { 
        duration: 2.5, 
        ease: [0.34, 1.56, 0.64, 1] // Springy bounce for a premium native feel
      });
    }
  }, [isInView, progress, motionProgress]);

  // Quadratic Bézier formula derived values for pixel-perfect curve tracking
  const sunX = useTransform(motionProgress, (v) => 
    Math.pow(1 - v, 2) * startX + 2 * (1 - v) * v * centerX + Math.pow(v, 2) * endX
  );
  const sunY = useTransform(motionProgress, (v) => 
    Math.pow(1 - v, 2) * horizonY + 2 * (1 - v) * v * daylightControlY + Math.pow(v, 2) * horizonY
  );

  return (
    <div ref={containerRef} className="w-full px-2 mt-2 overflow-hidden bg-transparent">
      <div className="relative w-full h-[160px]">
        <svg viewBox={`0 0 ${width} 160`} className="w-full h-full overflow-visible translate-x-1">
          <defs>
            <linearGradient id="sunDayGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              {/* Morning: Violet -> Red -> Yellow */}
              <stop offset="0%" stopColor="#9C27B0" /> 
              <stop offset="15%" stopColor="#FF3D00" />
              <stop offset="35%" stopColor="#FFD600" />
              
              {/* Noon: Pure White-Yellow spotlight */}
              <stop offset="50%" stopColor="#FFFFFF" />
              
              {/* Afternoon/Sunset: Yellow -> Red -> Violet */}
              <stop offset="65%" stopColor="#FFD600" />
              <stop offset="85%" stopColor="#FF3D00" />
              <stop offset="100%" stopColor="#9C27B0" />
            </linearGradient>

            <clipPath id="horizonClip">
              <rect x="-50" y="-50" width={width + 100} height={horizonY + 50} />
            </clipPath>

            <mask id="sunGap">
              <rect x="-50" y="-50" width={width + 100} height={height + 100} fill="white" />
              <motion.circle 
                style={{ cx: sunX, cy: sunY }}
                animate={{ r: isSunVisible ? 16 : 0 }}
                fill="black" 
              />
            </mask>

            <filter id="sunPulse">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Horizon Line - Long and subtle */}
          <line 
            x1="0" y1={horizonY} x2={width} y2={horizonY} 
            stroke="var(--border-color)" 
            strokeWidth="1" 
          />

          {/* 1. Side Troughs (Below Horizon) - Faded */}
          <path 
            d={leftTrough}
            fill="none" 
            stroke="var(--border-color)" 
            strokeWidth="5" 
            strokeLinecap="round"
          />
          <path 
            d={rightTrough}
            fill="none" 
            stroke="var(--border-color)" 
            strokeWidth="5" 
            strokeLinecap="round"
          />

          {/* Group for elements ABOVE horizon, strictly clipped */}
          <g clipPath="url(#horizonClip)">
            {/* Inner group with mask for the paths only */}
            <g mask="url(#sunGap)">
              {/* 2. Future Path (Theme-aware) - Top Arch */}
              <path 
                d={daylightArch}
                fill="none" 
                stroke="var(--border-color)" 
                strokeWidth="5" 
                strokeLinecap="butt"
              />

              {/* 3. Passed Path (Atmospheric Gradient) - Progressing to Current Time */}
              <motion.path 
                d={daylightArch}
                fill="none" 
                stroke="url(#sunDayGradient)" 
                strokeWidth="5" 
                strokeLinecap="butt"
                initial={{ pathLength: 0 }}
                animate={isInView ? { pathLength: progress } : {}}
                transition={{ duration: 2.5, ease: [0.34, 1.56, 0.64, 1] }}
              />
            </g>

            {/* Current Progress Point / Sun Icon - Mini version of WeatherHero icon */}
            <motion.g
              style={{ x: sunX, y: sunY }}
              initial={{ opacity: 0, scale: 0 }}
              animate={isInView ? { 
                opacity: isSunVisible ? 1 : 0, 
                scale: isSunVisible ? 1 : 0 
              } : {}}
              transition={{ duration: 0.5 }}
            >
              <foreignObject x="-14" y="-14" width="28" height="28">
                <div className="flex items-center justify-center w-full h-full">
                  <WeatherIcon 
                    name="Sun" 
                    forceColoured={true} 
                    className="w-7 h-7" 
                    strokeWidth={2}
                  />
                </div>
              </foreignObject>
            </motion.g>
          </g>

          {/* Sunrise/Sunset Times positioned at the bottom extreme left and right */}
          <text 
            x={15} 
            y={horizonY + 42} 
            textAnchor="start" 
            className="fill-app-text-dim text-[13px] font-bold tracking-tight"
          >
            {sunriseLabel}
          </text>
          <text 
            x={width - 15} 
            y={horizonY + 42} 
            textAnchor="end" 
            className="fill-app-text-dim text-[13px] font-bold tracking-tight"
          >
            {sunsetLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}
