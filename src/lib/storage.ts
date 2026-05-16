import { Location, WeatherData } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'app_settings',
  LOCATIONS: 'app_locations',
  ACTIVE_INDEX: 'app_active_index',
  WEATHER_CACHE: 'app_weather_cache', // Record<locationId_or_name, { data: WeatherData, ts: number }>
};

export function saveWeatherData(locationKey: string, data: WeatherData) {
  try {
    const cacheRaw = localStorage.getItem(STORAGE_KEYS.WEATHER_CACHE);
    const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
    cache[locationKey] = { data, ts: Date.now() };
    localStorage.setItem(STORAGE_KEYS.WEATHER_CACHE, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to save weather data to cache', e);
  }
}

export function getCachedWeatherData(locationKey: string): WeatherData | null {
  try {
    const cacheRaw = localStorage.getItem(STORAGE_KEYS.WEATHER_CACHE);
    if (!cacheRaw) return null;
    const cache = JSON.parse(cacheRaw);
    const cached = cache[locationKey];
    if (!cached) return null;
    return cached.data;
  } catch {
    return null;
  }
}

export { STORAGE_KEYS };
export const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
