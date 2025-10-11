// Calculate telemetry statistics
export const calculateStats = (telemetryData) => {
  if (!telemetryData || telemetryData.length === 0) return null;

  const speeds = telemetryData.map(d => d.speed_kmh);
  const rpms = telemetryData.map(d => d.rpm);
  const throttles = telemetryData.map(d => d.throttle_pct);
  const brakes = telemetryData.map(d => d.brake_pct);
  const gForces = telemetryData.map(d => Math.sqrt(d.g_long ** 2 + d.g_lat ** 2));

  return {
    maxSpeed: Math.max(...speeds),
    avgSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
    maxRPM: Math.max(...rpms),
    avgThrottle: throttles.reduce((a, b) => a + b, 0) / throttles.length,
    maxGForce: Math.max(...gForces),
    brakeEvents: brakes.filter(b => b > 10).length,
    gearChanges: telemetryData.filter((d, i) => i > 0 && d.gear !== telemetryData[i - 1].gear).length,
    lapTime: telemetryData[telemetryData.length - 1].timestamp_s,
    distance: telemetryData[telemetryData.length - 1].arc_length_m / 1000
  };
};

// Calculate driving style analysis
export const calculateDrivingStyle = (telemetryData, stats) => {
  if (!telemetryData || !stats) return null;

  const fullThrottle = telemetryData.filter(d => d.throttle_pct > 95).length;
  const brakeEvents = telemetryData.filter(d => d.brake_pct > 10).length;
  const gForces = telemetryData.map(d => Math.sqrt(d.g_long ** 2 + d.g_lat ** 2));
  const avgGForce = gForces.reduce((sum, g) => sum + g, 0) / telemetryData.length;

  const throttlePercent = (fullThrottle / telemetryData.length * 100);
  const brakeEventsPerKm = stats.distance > 0 ? brakeEvents / stats.distance : 0;

  const gForceFactor = Math.min(avgGForce / 1.5, 1);
  const throttleFactor = Math.min(throttlePercent / 50, 1);
  const brakeFactor = Math.min(brakeEventsPerKm / 20, 1);

  const aggressivenessScore = Math.round(((gForceFactor + throttleFactor + brakeFactor) / 3) * 100);

  const coasting = telemetryData.filter(d => d.throttle_pct < 5 && d.brake_pct < 5).length;
  const coastingPercent = (coasting / telemetryData.length * 100);

  return {
    aggressiveness: aggressivenessScore,
    throttlePercent: throttlePercent.toFixed(1),
    coastingPercent: coastingPercent.toFixed(1),
    brakeEvents,
    brakeEventsPerKm: brakeEventsPerKm.toFixed(1),
    gearChanges: stats.gearChanges
  };
};

// Get random color for stats
export const getRandomColor = () => {
  const blueShades = ['#3b82f6', '#60a5fa', '#0ea5e9', '#06b6d4', '#22d3ee', '#818cf8'];
  return blueShades[Math.floor(Math.random() * blueShades.length)];
};


