const { haversine, calculateGpxMetadata } = require('./gpxUtils');

describe('haversine', () => {
  test('should return 0 for same coordinates', () => {
    const distance = haversine(48.8566, 2.3522, 48.8566, 2.3522);
    expect(distance).toBe(0);
  });

  test('should calculate distance between Paris and Berlin (~877 km)', () => {
    const distance = haversine(48.8566, 2.3522, 52.5200, 13.4050);
    expect(distance).toBeGreaterThan(800000);
    expect(distance).toBeLessThan(950000);
  });

  test('should calculate short distance accurately (~1 km)', () => {
    const distance = haversine(48.8566, 2.3522, 48.8656, 2.3522);
    expect(distance).toBeGreaterThan(900);
    expect(distance).toBeLessThan(1100);
  });

  test('should handle negative coordinates', () => {
    const distance = haversine(-33.8688, 151.2093, -33.9200, 151.1800);
    expect(distance).toBeGreaterThan(5000);
  });
});

describe('calculateGpxMetadata', () => {
  test('should return 0 distance for empty array', () => {
    const result = calculateGpxMetadata([]);
    expect(result.distance).toBe(0);
  });

  test('should return 0 distance for single point', () => {
    const result = calculateGpxMetadata([{ lat: 48.8566, lng: 2.3522 }]);
    expect(result.distance).toBe(0);
  });

  test('should calculate distance for two points', () => {
    const points = [
      { lat: 48.8566, lng: 2.3522 },
      { lat: 48.8656, lng: 2.3522 }
    ];
    const result = calculateGpxMetadata(points);
    expect(result.distance).toBeGreaterThan(0.9);
    expect(result.distance).toBeLessThan(1.1);
  });

  test('should calculate total distance for multiple points', () => {
    const points = [
      { lat: 48.8566, lng: 2.3522 },
      { lat: 48.8656, lng: 2.3522 },
      { lat: 48.8746, lng: 2.3522 }
    ];
    const result = calculateGpxMetadata(points);
    expect(result.distance).toBeGreaterThan(1.8);
  });
});