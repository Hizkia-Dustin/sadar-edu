"""Regresi celah antarwilayah; hanya membaca snapshot lokal, tanpa jaringan/DB."""
import json
import unittest
from pathlib import Path
from shapely import coverage_is_valid
from shapely.geometry import shape, Point
from shapely.ops import unary_union

BACKEND = Path(__file__).resolve().parents[1]
features = json.loads((BACKEND / 'src/data/bogor-kecamatan.geojson.json').read_text(encoding='utf-8'))['features']
geometries = [shape(feature['geometry']) for feature in features]

class BogorCoverageTest(unittest.TestCase):
    def test_no_internal_gaps_or_overlapping_edges(self):
        self.assertEqual(len(geometries), 46)
        self.assertTrue(coverage_is_valid(geometries))
        combined = unary_union(geometries)
        self.assertEqual(combined.geom_type, 'Polygon')
        self.assertEqual(len(combined.interiors), 0)

    def test_previous_gap_belongs_to_bogor_utara(self):
        point = Point(106.8095, -6.548)
        matches = [f['properties']['nama'] for f, g in zip(features, geometries) if g.covers(point)]
        self.assertEqual(matches, ['Bogor Utara'])

    def test_frontend_outlines_match_the_same_coverage(self):
        data = BACKEND.parent / 'sadar-edu-main/src/data'
        for filename, subset in [
            ('bogor.geojson.json', geometries),
            ('kabupaten-bogor.geojson.json', [g for f, g in zip(features, geometries) if f['properties']['region'] == 'kabupaten']),
        ]:
            boundary = shape(json.loads((data / filename).read_text(encoding='utf-8'))['geometry'])
            self.assertLess(boundary.symmetric_difference(unary_union(subset)).area, 1e-12)

if __name__ == '__main__':
    unittest.main()
