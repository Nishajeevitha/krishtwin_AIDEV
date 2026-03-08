/**
 * AgroMind IoT Sensor Simulator
 * Mimics real sensor fluctuations so your dashboard feels LIVE
 * In a real system, this would be replaced by actual hardware readings
 */

const SensorSimulator = {

  // Base readings loaded from farm-data.json
  baseData: null,

  // How much each sensor can fluctuate per update
  fluctuation: {
    soilMoisture: 2,    // ±2%
    soilPH:       0.05, // ±0.05
    nitrogen:     1,    // ±1 mg/kg
    phosphorus:   0.5,
    potassium:    0.8,
    soilTemp:     0.3,  // ±0.3°C
    airTemp:      0.5,
    humidity:     1.5
  },

  // Safe ranges for each sensor (triggers alert if outside)
  thresholds: {
    soilMoisture: { min: 35, max: 80,  unit: "%",     label: "Soil Moisture" },
    soilPH:       { min: 5.5, max: 7.5, unit: "pH",   label: "Soil pH" },
    nitrogen:     { min: 30, max: 60,  unit: "mg/kg",  label: "Nitrogen" },
    phosphorus:   { min: 15, max: 50,  unit: "mg/kg",  label: "Phosphorus" },
    potassium:    { min: 20, max: 55,  unit: "mg/kg",  label: "Potassium" },
    soilTemp:     { min: 15, max: 32,  unit: "°C",     label: "Soil Temp" },
    airTemp:      { min: 10, max: 38,  unit: "°C",     label: "Air Temp" },
    humidity:     { min: 40, max: 85,  unit: "%",      label: "Humidity" }
  },

  /**
   * Load base data from farm-data.json
   */
  async init() {
    try {
      const res = await fetch('./data/farm-data.json');
      this.baseData = await res.json();
      console.log("✅ Sensor data loaded:", this.baseData.farm.name);
      return this.baseData;
    } catch (err) {
      console.error("❌ Could not load farm-data.json:", err);
      return null;
    }
  },

  /**
   * Apply small random fluctuation to a value
   * Makes data look like real live sensor readings
   */
  fluctuate(value, key) {
    const range = this.fluctuation[key] || 0.5;
    const delta = (Math.random() - 0.5) * 2 * range;
    return Math.round((value + delta) * 10) / 10;
  },

  /**
   * Get live sensor reading for a zone (with fluctuation)
   */
  getLiveReading(zone) {
    const base = zone.sensors;
    const live = {};
    for (const key in base) {
      live[key] = this.fluctuate(base[key], key);
    }
    return live;
  },

  /**
   * Check if a reading is outside safe thresholds
   * Returns array of alerts
   */
  checkAlerts(zoneName, cropName, readings) {
    const alerts = [];
    for (const [key, value] of Object.entries(readings)) {
      const t = this.thresholds[key];
      if (!t) continue;
      if (value < t.min) {
        alerts.push({
          type: value < t.min * 0.8 ? "critical" : "warning",
          sensor: key,
          label: t.label,
          value: `${value}${t.unit}`,
          message: `${t.label} is LOW at ${value}${t.unit} (min: ${t.min}${t.unit}) in ${zoneName}`,
          zone: zoneName,
          crop: cropName
        });
      } else if (value > t.max) {
        alerts.push({
          type: "warning",
          sensor: key,
          label: t.label,
          value: `${value}${t.unit}`,
          message: `${t.label} is HIGH at ${value}${t.unit} (max: ${t.max}${t.unit}) in ${zoneName}`,
          zone: zoneName,
          crop: cropName
        });
      }
    }
    return alerts;
  },

  /**
   * Calculate crop health score from sensor readings
   * Returns 0–100
   */
  calculateHealthScore(readings) {
    let score = 100;
    let checks = 0;

    for (const [key, value] of Object.entries(readings)) {
      const t = this.thresholds[key];
      if (!t) continue;
      checks++;
      const range = t.max - t.min;
      const mid = (t.max + t.min) / 2;
      const deviation = Math.abs(value - mid) / (range / 2);
      if (deviation > 1) score -= 15; // out of range: big penalty
      else if (deviation > 0.7) score -= 7; // near edge: small penalty
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  },

  /**
   * Generate irrigation recommendation based on soil moisture
   */
  getIrrigationRec(moisture, cropType) {
    if (moisture < 25) return { action: "irrigate_now",    label: "🚨 Irrigate Immediately", color: "#fc6b6b" };
    if (moisture < 35) return { action: "irrigate_soon",   label: "⚠️ Irrigate Today",       color: "#fcd34d" };
    if (moisture < 50) return { action: "monitor",         label: "👀 Monitor Closely",       color: "#67b8f7" };
    if (moisture < 70) return { action: "optimal",         label: "✅ Optimal Moisture",      color: "#5eea82" };
    return                     { action: "reduce",         label: "⬇️ Reduce Irrigation",    color: "#c084fc" };
  },

  /**
   * Get fertilizer recommendation based on NPK levels
   */
  getFertilizerRec(n, p, k) {
    const recs = [];
    if (n < 30) recs.push("Add Urea (46-0-0) — Nitrogen deficient");
    if (p < 15) recs.push("Add SSP (0-16-0) — Phosphorus deficient");
    if (k < 20) recs.push("Add MOP (0-0-60) — Potassium deficient");
    if (recs.length === 0) recs.push("NPK levels optimal — no fertilizer needed");
    return recs;
  },

  /**
   * Simulate all zones updating in real-time
   * Call this every 5 seconds to keep dashboard live
   */
  getFullUpdate(farmData) {
    if (!farmData) return null;
    const updatedZones = farmData.zones.map(zone => {
      const liveReadings = this.getLiveReading(zone);
      const healthScore = this.calculateHealthScore(liveReadings);
      const sensorAlerts = this.checkAlerts(zone.name, zone.crop, liveReadings);
      const irrigRec = this.getIrrigationRec(liveReadings.soilMoisture, zone.crop);
      const fertRec = this.getFertilizerRec(liveReadings.nitrogen, liveReadings.phosphorus, liveReadings.potassium);
      return {
        ...zone,
        sensors: liveReadings,
        healthScore,
        sensorAlerts,
        irrigationRec: irrigRec,
        fertilizerRec: fertRec,
        lastUpdated: new Date().toISOString()
      };
    });

    return { ...farmData, zones: updatedZones, lastUpdated: new Date().toISOString() };
  }
};

if (typeof module !== 'undefined') module.exports = SensorSimulator;
