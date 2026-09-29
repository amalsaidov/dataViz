import { MERCATOR_MAX_LATITUDE, projectLonLat, unprojectLonLat, webMercator } from './projection';

describe('webMercator', () => {
  it('maps the world to the square from -0.5 to 0.5, with y down', () => {
    expect(projectLonLat([0, 0])[0]).toBe(0);
    expect(projectLonLat([0, 0])[1]).toBeCloseTo(0, 12);
    const [x0, y0] = projectLonLat([-180, MERCATOR_MAX_LATITUDE]);
    const [x1, y1] = projectLonLat([180, -MERCATOR_MAX_LATITUDE]);
    expect(x0).toBeCloseTo(-0.5, 9);
    expect(y0).toBeCloseTo(-0.5, 9);
    expect(x1).toBeCloseTo(0.5, 9);
    expect(y1).toBeCloseTo(0.5, 9);
  });

  it('matches EPSG:3857 metres divided by the world width', () => {
    // EPSG:3857 of [10, 50]: [1113194.9079, 6446275.8410] m. World width: 40075016.6856 m.
    const [x, y] = projectLonLat([10, 50]);
    expect(x * 40075016.6856).toBeCloseTo(1113194.9079, 2);
    expect(-y * 40075016.6856).toBeCloseTo(6446275.841, 2);
  });

  it('clamps the poles, so that Antarctica stays finite', () => {
    expect(projectLonLat([0, -90])).toEqual(projectLonLat([0, -MERCATOR_MAX_LATITUDE]));
    expect(Number.isFinite(projectLonLat([0, 90])[1])).toBe(true);
  });

  it('unproject is the inverse of project', () => {
    for (const p of [
      [0, 0],
      [-100, 40],
      [135, -25],
      [179.9, 80],
    ]) {
      const [lon, lat] = unprojectLonLat(projectLonLat(p));
      expect(lon).toBeCloseTo(p[0], 9);
      expect(lat).toBeCloseTo(p[1], 9);
    }
    expect(webMercator.unproject(webMercator.project([14, 46]))[1]).toBeCloseTo(46, 9);
  });
});
