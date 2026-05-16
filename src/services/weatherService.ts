import { Location, WeatherData } from '../types';

const GEO_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_API_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const ASTRONOMY_API_URL = 'https://astronomy-api.open-meteo.com/v1/astronomy';

export const fetchWithTimeout = async (url: string, options: any = {}, timeout = 25000, retries = 3): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    // Keep it as a "Simple Request" to avoid preflight issues & ad-blocker sensitivity
    const response = await fetch(url, { 
      ...options, 
      signal: controller.signal,
      cache: 'no-cache'
    });
    clearTimeout(id);

    // Handle 429 specifically with an automated wait
    if (response.status === 429 && retries > 0) {
      const waitTime = 4000 + Math.random() * 3000;
      await new Promise(r => setTimeout(r, waitTime));
      return fetchWithTimeout(url, options, timeout, retries - 1);
    }

    if (!response.ok && retries > 0 && response.status >= 500) {
      await new Promise(r => setTimeout(r, 3000));
      return fetchWithTimeout(url, options, timeout, retries - 1);
    }

    return response;
  } catch (e) {
    clearTimeout(id);
    
    if (e instanceof Error && e.name === 'AbortError') {
      if (retries > 0) {
        return fetchWithTimeout(url, options, timeout, retries - 1);
      }
      throw new Error(`The connection to ${new URL(url).hostname} timed out. Please check your internet connection.`);
    }

    if (e instanceof TypeError) {
      const msg = e.message.toLowerCase();
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('connection') || msg.includes('dns')) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 2000 + (3 - retries) * 1000));
          return fetchWithTimeout(url, options, timeout, retries - 1);
        }
        throw new Error('Could not connect to the weather server. You might be offline or using an ad-blocker.');
      }
    }
    
    // Retry on other network errors that might not be TypeError
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return fetchWithTimeout(url, options, timeout, retries - 1);
    }
    throw e;
  }
};

export async function searchLocations(query: string): Promise<Location[]> {
  if (query.length < 2) return [];
  
  try {
    // Shorter timeout and no retries for search to keep it snappy
    const response = await fetchWithTimeout(`${GEO_API_URL}?name=${encodeURIComponent(query)}&count=10&language=en&format=json`, {}, 5000, 0);
    
    if (!response.ok) {
       return [];
    }

    const data = await response.json();
    
    if (!data || !data.results) return [];
    
    return data.results.map((item: any) => ({
      id: item.id || Math.random(),
      name: item.name || 'Unknown',
      latitude: item.latitude,
      longitude: item.longitude,
      country: item.country || '',
      admin1: item.admin1,
      timezone: item.timezone || 'UTC',
    }));
  } catch (err) {
    console.warn('Location search failed:', err);
    return [];
  }
}

export const getAQIInfo = (aqi: number) => {
  if (aqi <= 50) return { 
    label: 'Good', 
    color: '#00e400',
    recommendation: 'Ideal for outdoor activities and fresh air.'
  };
  if (aqi <= 100) return { 
    label: 'Moderate', 
    color: '#ffff00',
    recommendation: 'Unusually sensitive people should consider limiting outdoor exertion.'
  };
  if (aqi <= 150) return { 
    label: 'Unhealthy for Sensitive Groups', 
    color: '#ff7e00',
    recommendation: 'Sensitive groups should reduce prolonged outdoor activity.'
  };
  if (aqi <= 200) return { 
    label: 'Unhealthy', 
    color: '#ff0000',
    recommendation: 'Everyone should reduce prolonged outdoor exertion.'
  };
  if (aqi <= 300) return { 
    label: 'Very Unhealthy', 
    color: '#8f3f97',
    recommendation: 'Avoid outdoor activity. Keep windows closed.'
  };
  return { 
    label: 'Hazardous', 
    color: '#7e0023',
    recommendation: 'Stay indoors. Health emergency conditions.'
  };
};

export const getMoonPhaseInfo = (phase: number) => {
  // Open-Meteo moon_phase: 0: New Moon, 0.25: First Quarter, 0.5: Full Moon, 0.75: Last Quarter, 1.0: New Moon
  // Normalized illumination based on distance from New Moon (0 or 1)
  const distFromNew = Math.min(phase, 1 - phase);
  const illumination = Math.round(distFromNew * 200);

  if (phase === 0 || phase === 1) return { label: 'New Moon', illumination: 0, icon: 'Moon' as const };
  if (phase > 0 && phase < 0.25) return { label: 'Waxing Crescent', illumination, icon: 'Moon' as const };
  if (phase === 0.25) return { label: 'First Quarter', illumination: 50, icon: 'Moon' as const };
  if (phase > 0.25 && phase < 0.5) return { label: 'Waxing Gibbous', illumination, icon: 'MoonStar' as const };
  if (phase === 0.5) return { label: 'Full Moon', illumination: 100, icon: 'MoonStar' as const };
  if (phase > 0.5 && phase < 0.75) return { label: 'Waning Gibbous', illumination, icon: 'MoonStar' as const };
  if (phase === 0.75) return { label: 'Last Quarter', illumination: 50, icon: 'Moon' as const };
  return { label: 'Waning Crescent', illumination, icon: 'Moon' as const };
};

export async function fetchWeatherBulk(locations: Location[]): Promise<Record<number, WeatherData>> {
  if (!locations.length) return {};

  const lats = locations.map(l => l.latitude.toFixed(4)).join(',');
  const lons = locations.map(l => l.longitude.toFixed(4)).join(',');

  const weatherParams = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    hourly: 'temperature_2m,weather_code,precipitation_probability,wind_direction_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,visibility,surface_pressure,precipitation',
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'ms',
  });

  const aqiParams = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    current: 'us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone',
    timezone: 'auto',
  });

  const weatherPromise = fetchWithTimeout(`${WEATHER_API_URL}?${weatherParams.toString()}`).catch(err => {
    console.warn('Bulk Weather fetch failed (will retry staggered):', err.message);
    throw new Error(`Failed to contact weather service: ${err.message}`);
  });

  const aqiPromise = fetchWithTimeout(`${AIR_QUALITY_API_URL}?${aqiParams.toString()}`).catch(err => {
    console.warn('Bulk AQI Fetch Failed:', err);
    return null;
  });

  // Astronomy API is single-location only. Fetch in parallel.
  const astroPromises = locations.map(l => 
    fetchWithTimeout(`${ASTRONOMY_API_URL}?latitude=${l.latitude}&longitude=${l.longitude}&daily=sunrise,sunset,moon_phase&timezone=auto`)
      .then(res => res.ok ? res.json() : null)
      .catch(err => {
        console.warn('Individual Astro Fetch Failed:', err);
        return null;
      })
  );

  const [weatherRes, aqiRes, astroResults] = await Promise.all([
    weatherPromise, 
    aqiPromise, 
    Promise.all(astroPromises)
  ]);

  if (!weatherRes || !weatherRes.ok) {
    throw new Error('Bulk Weather API Error');
  }

  // Open-Meteo returns an array of objects if multiple coords are provided
  const weatherDataArray = await weatherRes.json();
  const aqiDataArray = aqiRes && aqiRes.ok ? await aqiRes.json() : null;

  const results: Record<number, WeatherData> = {};

  locations.forEach((_, index) => {
    // If multiple coords, result is array. If single coord, result is object.
    const weatherData = Array.isArray(weatherDataArray) ? weatherDataArray[index] : weatherDataArray;
    const aqiData = Array.isArray(aqiDataArray) ? aqiDataArray[index] : aqiDataArray;
    const astroData = astroResults[index];

    if (!weatherData?.current) return;

    let usAqi: number | undefined;
    let pm10: number | undefined;
    let pm2_5: number | undefined;
    let no2: number | undefined;
    let o3: number | undefined;
    let co: number | undefined;
    
    if (aqiData?.current) {
      usAqi = aqiData.current.us_aqi;
      pm10 = aqiData.current.pm10;
      pm2_5 = aqiData.current.pm2_5;
      no2 = aqiData.current.nitrogen_dioxide;
      o3 = aqiData.current.ozone;
      co = aqiData.current.carbon_monoxide;
    }

    const aqiInfo = usAqi !== undefined ? getAQIInfo(usAqi) : null;

    results[index] = {
      current: {
        time: weatherData.current.time,
        temperature: weatherData.current.temperature_2m,
        relativeHumidity: weatherData.current.relative_humidity_2m,
        weatherCode: weatherData.current.weather_code,
        windSpeed: weatherData.current.wind_speed_10m,
        windDirection: weatherData.current.wind_direction_10m,
        apparentTemperature: weatherData.current.apparent_temperature,
        isDay: weatherData.current.is_day === 1,
        visibility: weatherData.current.visibility,
        surfacePressure: weatherData.current.surface_pressure,
        precipitation: weatherData.current.precipitation,
      },
      hourly: {
        time: weatherData.hourly.time,
        temperature: weatherData.hourly.temperature_2m,
        weatherCode: weatherData.hourly.weather_code,
        precipitationProbability: weatherData.hourly.precipitation_probability,
        windDirection: weatherData.hourly.wind_direction_10m,
      },
      daily: {
        time: weatherData.daily.time,
        weatherCode: weatherData.daily.weather_code,
        temperatureMax: weatherData.daily.temperature_2m_max,
        temperatureMin: weatherData.daily.temperature_2m_min,
        sunrise: astroData?.daily?.sunrise || weatherData.daily.sunrise,
        sunset: astroData?.daily?.sunset || weatherData.daily.sunset,
        uvIndex: weatherData.daily.uv_index_max,
        moonPhase: astroData?.daily?.moon_phase || [0],
        precipitationSum: weatherData.daily.precipitation_sum || [0],
      },
      airQuality: aqiInfo ? {
        usAqi: usAqi ?? 0,
        description: aqiInfo.label,
        color: aqiInfo.color,
        recommendation: aqiInfo.recommendation,
        pm10: pm10 ?? 0,
        pm2_5: pm2_5 ?? 0,
        no2: no2 ?? 0,
        o3: o3 ?? 0,
        co: co ?? 0,
      } : undefined,
      fetchedAt: Date.now(),
      timezone: weatherData.timezone
    };
  });

  return results;
}

export async function fetchWeather(lat: number, lon: number, timezone: string): Promise<WeatherData> {
  if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
    throw new Error('Invalid coordinates provided to weather service');
  }

  // Round coordinates to 4 decimal places as some APIs can be picky about extreme precision
  const safeLat = parseFloat(lat.toFixed(4));
  const safeLon = parseFloat(lon.toFixed(4));

  const weatherParams = new URLSearchParams({
    latitude: safeLat.toString(),
    longitude: safeLon.toString(),
    hourly: 'temperature_2m,weather_code,precipitation_probability,wind_direction_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,visibility,surface_pressure,precipitation',
    timezone: timezone || 'auto',
    forecast_days: '7',
    wind_speed_unit: 'ms',
  });

  const aqiParams = new URLSearchParams({
    latitude: safeLat.toString(),
    longitude: safeLon.toString(),
    current: 'us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone',
    timezone: timezone || 'auto',
  });

  const astroParams = new URLSearchParams({
    latitude: safeLat.toString(),
    longitude: safeLon.toString(),
    daily: 'sunrise,sunset,moon_phase',
    timezone: timezone || 'auto',
  });

  // Parallelize fetches for speed, while maintaining robustness
  // Weather is critical, the others are enhancements
  const weatherPromise = fetchWithTimeout(`${WEATHER_API_URL}?${weatherParams.toString()}`).catch(err => {
    console.error('Weather fetch error:', err);
    throw new Error(`Failed to contact weather service: ${err.message}`);
  });

  const aqiPromise = fetchWithTimeout(`${AIR_QUALITY_API_URL}?${aqiParams.toString()}`).catch(err => {
    console.warn('AQI Fetch Failed:', err);
    return null;
  });

  const astroPromise = fetchWithTimeout(`${ASTRONOMY_API_URL}?${astroParams.toString()}`).catch(err => {
    console.warn('Astro Fetch Failed:', err);
    return null;
  });

  const [weatherRes, aqiRes, astroRes] = await Promise.all([weatherPromise, aqiPromise, astroPromise]);

  if (!weatherRes || !weatherRes.ok) {
    const errorText = weatherRes ? await weatherRes.text().catch(() => 'No details') : 'Network error';
    throw new Error(`Weather API Error (${weatherRes?.status || 'Network'}): ${errorText}`);
  }

  const weatherData = await weatherRes.json();
  const aqiData = aqiRes && aqiRes.ok ? await aqiRes.json() : null;
  const astroData = astroRes && astroRes.ok ? await astroRes.json() : null;

  // Debugging logs for intermittent failures
  if (!weatherData) throw new Error('Weather service returned empty response');
  
  let usAqi: number | undefined;
  let pm10: number | undefined;
  let pm2_5: number | undefined;
  let no2: number | undefined;
  let o3: number | undefined;
  let co: number | undefined;
  
  if (aqiData?.current) {
    usAqi = aqiData.current.us_aqi;
    pm10 = aqiData.current.pm10;
    pm2_5 = aqiData.current.pm2_5;
    no2 = aqiData.current.nitrogen_dioxide;
    o3 = aqiData.current.ozone;
    co = aqiData.current.carbon_monoxide;
  }

  const aqiInfo = usAqi !== undefined ? getAQIInfo(usAqi) : null;

  if (!weatherData.current || !weatherData.hourly || !weatherData.daily) {
    throw new Error('Invalid weather data structure received');
  }

  return {
    current: {
      time: weatherData.current.time,
      temperature: weatherData.current.temperature_2m,
      relativeHumidity: weatherData.current.relative_humidity_2m,
      weatherCode: weatherData.current.weather_code,
      windSpeed: weatherData.current.wind_speed_10m,
      windDirection: weatherData.current.wind_direction_10m,
      apparentTemperature: weatherData.current.apparent_temperature,
      isDay: weatherData.current.is_day === 1,
      visibility: weatherData.current.visibility,
      surfacePressure: weatherData.current.surface_pressure,
      precipitation: weatherData.current.precipitation,
    },
    hourly: {
      time: weatherData.hourly.time,
      temperature: weatherData.hourly.temperature_2m,
      weatherCode: weatherData.hourly.weather_code,
      precipitationProbability: weatherData.hourly.precipitation_probability,
      windDirection: weatherData.hourly.wind_direction_10m,
    },
    daily: {
      time: weatherData.daily.time,
      weatherCode: weatherData.daily.weather_code,
      temperatureMax: weatherData.daily.temperature_2m_max,
      temperatureMin: weatherData.daily.temperature_2m_min,
      sunrise: astroData?.daily?.sunrise || weatherData.daily.sunrise,
      sunset: astroData?.daily?.sunset || weatherData.daily.sunset,
      uvIndex: weatherData.daily.uv_index_max,
      moonPhase: astroData?.daily?.moon_phase || [0],
      precipitationSum: weatherData.daily.precipitation_sum || [0],
    },
    airQuality: aqiInfo ? {
      usAqi: usAqi ?? 0,
      description: aqiInfo.label,
      color: aqiInfo.color,
      recommendation: aqiInfo.recommendation,
      pm10: pm10 ?? 0,
      pm2_5: pm2_5 ?? 0,
      no2: no2 ?? 0,
      o3: o3 ?? 0,
      co: co ?? 0,
    } : undefined,
    fetchedAt: Date.now(),
    timezone: weatherData.timezone
  };
}

// Weather code to description and icon mapping
export function getWeatherInfo(code: number, isDay: boolean = true) {
  const mapping: Record<number, { label: string; icon: string }> = {
    0: { label: 'Clear Sky', icon: isDay ? 'Sun' : 'Moon' },
    1: { label: 'Mainly Clear', icon: isDay ? 'Sun' : 'Moon' },
    2: { label: 'Partly Cloudy', icon: isDay ? 'CloudSun' : 'CloudMoon' },
    3: { label: 'Overcast', icon: 'Cloud' },
    45: { label: 'Foggy', icon: 'CloudFog' },
    48: { label: 'Rime Fog', icon: 'CloudFog' },
    51: { label: 'Light Drizzle', icon: 'CloudDrizzle' },
    53: { label: 'Moderate Drizzle', icon: 'CloudDrizzle' },
    55: { label: 'Dense Drizzle', icon: 'CloudDrizzle' },
    61: { label: 'Slight Rain', icon: 'CloudRain' },
    63: { label: 'Moderate Rain', icon: 'CloudRain' },
    65: { label: 'Heavy Rain', icon: 'CloudRain' },
    71: { label: 'Slight Snow', icon: 'Snowflake' },
    73: { label: 'Moderate Snow', icon: 'Snowflake' },
    75: { label: 'Heavy Snow', icon: 'Snowflake' },
    80: { label: 'Slight Rain Showers', icon: 'CloudRain' },
    81: { label: 'Moderate Rain Showers', icon: 'CloudRain' },
    82: { label: 'Violent Rain Showers', icon: 'CloudRain' },
    95: { label: 'Thunderstorm', icon: 'CloudLightning' },
    96: { label: 'Thunderstorm with Hail', icon: 'CloudLightning' },
    99: { label: 'Thunderstorm with Heavy Hail', icon: 'CloudLightning' },
  };

  return mapping[code] || { label: 'Unknown', icon: 'Cloud' };
}
