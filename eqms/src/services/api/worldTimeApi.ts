/**
 * World Time API Service
 * Provides real-time timezone information from worldtimeapi.org
 */

interface WorldTimeResponse {
  datetime: string;
  timezone: string;
  abbreviation: string;
  utc_offset: string;
}

interface TimeData {
  datetime: Date;
  timezone: string;
  abbreviation: string;
  utcOffset: string;
}

/**
 * Fetch current time from World Time API
 * @param timezone - IANA timezone identifier (default: Asia/Ho_Chi_Minh)
 * @returns TimeData object with datetime and timezone info
 */
export const fetchWorldTime = async (
  timezone: string = 'Asia/Ho_Chi_Minh'
): Promise<TimeData> => {
  try {
    const response = await fetch(
      `https://worldtimeapi.org/api/timezone/${timezone}`
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: WorldTimeResponse = await response.json();

    return {
      datetime: new Date(data.datetime),
      timezone: data.timezone,
      abbreviation: data.abbreviation,
      utcOffset: data.utc_offset,
    };
  } catch (error) {
    console.error('Failed to fetch time from World Time API:', error);
    // Fallback to local time
    return {
      datetime: new Date(),
      timezone: 'Local',
      abbreviation: 'Local',
      utcOffset: '',
    };
  }
};

/**
 * Get list of available timezones for a region
 * @param region - Region name (e.g., 'Asia', 'Europe', 'America')
 * @returns Array of timezone identifiers
 */
export const fetchTimezonesByRegion = async (
  region: string
): Promise<string[]> => {
  try {
    const response = await fetch(
      `https://worldtimeapi.org/api/timezone/${region}`
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch timezones:', error);
    return [];
  }
};
