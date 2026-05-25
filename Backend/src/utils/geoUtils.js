/**
 * Geo-distance calculation utility (Haversine formula)
 */

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance in meters between two GPS coordinates
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Check if coordinates are within allowed radius of college
 */
function isWithinCampus(studentLat, studentLon, collegeLat, collegeLon, radiusMeters) {
  const distance = calculateDistance(studentLat, studentLon, collegeLat, collegeLon);
  return {
    isWithin: distance <= radiusMeters,
    distance: Math.round(distance),
  };
}

module.exports = { calculateDistance, isWithinCampus };
