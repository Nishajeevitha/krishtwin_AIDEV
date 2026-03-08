

const WeatherAPI = {

  // Pune, Maharashtra coordinates 
  LAT: 18.5204,
  LON: 73.8567,
  CITY: "Pune, Maharashtra",

  // Weather condition codes → emoji + label
  conditionMap: {
    0:  { icon: "☀️",  label: "Clear Sky" },
    1:  { icon: "🌤️", label: "Mainly Clear" },
    2:  { icon: "⛅",  label: "Partly Cloudy" },
    3:  { icon: "☁️",  label: "Overcast" },
    45: { icon: "🌫️", label: "Foggy" },
    48: { icon: "🌫️", label: "Icy Fog" },
    51: { icon: "🌦️", label: "Light Drizzle" },
    61: { icon: "🌧️", label: "Light Rain" },
    63: { icon: "🌧️", label: "Moderate Rain" },
    65: { icon: "🌧️", label: "Heavy Rain" },
    71: { icon: "🌨️", label: "Light Snow" },
    80: { icon: "🌦️", label: "Rain Showers" },
    95: { icon: "⛈️",  label: "Thunderstorm" },
    99: { icon: "⛈️",  label: "Heavy Thunderstorm" }
  },

  dayNames: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],

  /**
   * Fetch current weather + 7-day forecast
   * Returns structured data ready for dashboard
   */
  async fetchWeather(lat = this.LAT, lon = this.LON) {
    const url = `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
      `&timezone=Asia%2FKolkata&forecast_days=7`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Weather fetch failed");
      const raw = await res.json();
      return this.parseWeather(raw);
    } catch (err) {
      console.warn("Weather API failed, using fallback data:", err.message);
      return this.getFallbackData();
    }
  },

  /**
   * Parse Open-Meteo response into dashboard-friendly format
   */
  parseWeather(raw) {
    const cur = raw.current;
    const daily = raw.daily;
    const cond = this.conditionMap[cur.weather_code] || { icon: "🌤️", label: "Clear" };

    const current = {
      temp:      Math.round(cur.temperature_2m),
      humidity:  cur.relative_humidity_2m,
      windSpeed: Math.round(cur.wind_speed_10m),
      rainfall:  cur.precipitation || 0,
      condition: cond.label,
      icon:      cond.icon
    };

    const forecast = daily.time.map((dateStr, i) => {
      const date = new Date(dateStr);
      const dayName = i === 0 ? "Today" : this.dayNames[date.getDay()];
      const dc = this.conditionMap[daily.weather_code[i]] || { icon: "🌤️", label: "Clear" };
      return {
        day:       dayName,
        high:      Math.round(daily.temperature_2m_max[i]),
        low:       Math.round(daily.temperature_2m_min[i]),
        rain:      daily.precipitation_probability_max[i] || 0,
        condition: dc.label,
        icon:      dc.icon
      };
    });

    // Farming advice based on conditions
    const advice = this.getFarmingAdvice(current, forecast);

    return { current, forecast, advice, source: "live", city: this.CITY };
  },

  /**
   * AI-style farming advice based on weather
   */
  getFarmingAdvice(current, forecast) {
    const tips = [];

    if (current.temp > 35)
      tips.push({ type: "warning", msg: "🌡️ High heat today — irrigate early morning or evening to reduce evaporation." });

    if (current.humidity < 40)
      tips.push({ type: "warning", msg: "💨 Low humidity detected — increase irrigation frequency for sensitive crops." });

    const rainDay = forecast.find(d => d.rain > 60);
    if (rainDay)
      tips.push({ type: "info", msg: `🌧️ Heavy rain expected ${rainDay.day} (${rainDay.rain}%) — hold irrigation 1 day before.` });

    const hotDay = forecast.find(d => d.high > 36);
    if (hotDay)
      tips.push({ type: "warning", msg: `☀️ Heat stress risk ${hotDay.day} (${hotDay.high}°C) — prepare shade netting for tomato/corn.` });

    if (tips.length === 0)
      tips.push({ type: "good", msg: "✅ Weather conditions are favorable for all crops this week." });

    return tips;
  },

  /**
   * Fallback data when API is unavailable (offline demo)
   */
  getFallbackData() {
    return {
      source: "fallback",
      city: this.CITY,
      current: { temp: 28, humidity: 62, windSpeed: 12, rainfall: 0, condition: "Partly Cloudy", icon: "⛅" },
      forecast: [
        { day: "Today", high: 30, low: 18, rain: 0,  condition: "Sunny",         icon: "☀️" },
        { day: "Tue",   high: 33, low: 20, rain: 5,  condition: "Partly Cloudy", icon: "⛅" },
        { day: "Wed",   high: 36, low: 22, rain: 0,  condition: "Hot",           icon: "🌡️" },
        { day: "Thu",   high: 29, low: 19, rain: 85, condition: "Thunderstorm",  icon: "⛈️" },
        { day: "Fri",   high: 25, low: 17, rain: 70, condition: "Rainy",         icon: "🌧️" },
        { day: "Sat",   high: 27, low: 18, rain: 20, condition: "Cloudy",        icon: "☁️" },
        { day: "Sun",   high: 31, low: 19, rain: 0,  condition: "Sunny",         icon: "☀️" }
      ],
      advice: [{ type: "info", msg: "⚡ Using offline weather data. Connect internet for live forecast." }]
    };
  }
};

// Export for use in other files
if (typeof module !== 'undefined') module.exports = WeatherAPI;
