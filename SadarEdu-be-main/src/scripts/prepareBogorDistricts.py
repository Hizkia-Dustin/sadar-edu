"""Build the public map snapshot; see ../data/README.md for source URLs and command."""
import json
import sys
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from shapely import coverage_is_valid, coverage_simplify

DATA = Path(__file__).resolve().parents[1] / 'data'
population = json.loads((DATA / 'bogor-population-2024.json').read_text())
source_dir = Path(sys.argv[1])
SOURCE_URL = 'https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/BATAS_WILAYAH/MapServer/3'
EDITION = '2022 (revisi 27 Desember 2022)'
source = json.loads((source_dir / 'bogor-big-districts-source.geojson').read_text())
source_features = sorted(source['features'], key=lambda f: f['properties']['kdcpum'])
assert len(source_features) == 46
geometries = [shape(feature['geometry']) for feature in source_features]
assert all(g.is_valid for g in geometries)
assert coverage_is_valid(geometries), 'Sumber memiliki overlap atau sisi yang tidak tersambung'

# Satu operasi untuk seluruh coverage: sisi bersama disederhanakan sekali, bukan per poligon.
# Jangan menambal celah dengan buffer/nearest district karena dapat mengarang kepemilikan wilayah.
geometries = coverage_simplify(geometries, 0.0001)
assert coverage_is_valid(geometries)
names = {(region, name.lower().replace(' ', '')): name
         for region in ('kabupaten', 'kota') for name in population[region]}

features = []
for feature, geometry in zip(source_features, geometries):
    properties = feature['properties']
    assert properties['kdpkab'] in ('32.01', '32.71')
    region = 'kabupaten' if properties['kdpkab'] == '32.01' else 'kota'
    name = names[(region, properties['wadmkc'].lower().replace(' ', ''))]
    assert geometry.is_valid and not geometry.is_empty and geometry.geom_type in ('Polygon', 'MultiPolygon'), name
    raw = population[region][name]
    count = sum(raw) if isinstance(raw, list) else raw
    district_id = f"geo:{region}:{name.lower().replace(' ', '-')}"
    features.append({
        'type': 'Feature', 'id': district_id, 'bbox': list(geometry.bounds),
        'geometry': mapping(geometry),
        'properties': {
            'id': district_id, 'nama': name, 'region': region,
            'kode_kecamatan': properties['kdcpum'],
            'kabupaten_kota': 'Kabupaten Bogor' if region == 'kabupaten' else 'Kota Bogor',
            'penduduk': count, 'tahun': population['year'],
            'sumber_penduduk': population['sources'][region]['url'],
        },
    })

assert len(features) == 46 and len({f['id'] for f in features}) == 46
for region, expected_count in [('kabupaten', 40), ('kota', 6)]:
    subset = [f for f in features if f['properties']['region'] == region]
    assert len(subset) == expected_count
    assert sum(f['properties']['penduduk'] for f in subset) == population['sources'][region]['expectedTotal'], region

result = {'type': 'FeatureCollection', 'features': features, 'meta': {
    'tahun': population['year'], 'sources': population['sources'],
    'catatan': 'Jumlah penduduk total, bukan kepadatan atau skor kebutuhan sekolah. Metode kabupaten dan kota berbeda.',
    'sumber_batas': SOURCE_URL, 'edisi_batas': EDITION,
    'batas_kabupaten': 'BIG: Peta Wilayah Administrasi Kecamatan, edisi ' + EDITION,
    'batas_kota': 'BIG: Peta Wilayah Administrasi Kecamatan, edisi ' + EDITION,
}}
# Bulatkan setelah validasi, lalu periksa ulang coverage agar tidak muncul celah numerik.
def rounded(value):
    if isinstance(value, float): return round(value, 7)
    if isinstance(value, (list, tuple)): return [rounded(v) for v in value]
    if isinstance(value, dict): return {k: rounded(v) for k, v in value.items()}
    return value
result = rounded(result)
assert all(shape(f['geometry']).is_valid for f in result['features'])
final_geometries = [shape(f['geometry']) for f in result['features']]
assert coverage_is_valid(final_geometries), 'Pembulatan merusak sambungan poligon'
combined = unary_union(final_geometries)
assert combined.geom_type == 'Polygon' and len(combined.interiors) == 0, 'Coverage memiliki celah internal'

# Outline dan filter frontend diturunkan dari coverage yang sama agar tidak beda versi lagi.
frontend_data = DATA.parents[2] / 'sadar-edu-main' / 'src' / 'data'
for filename, subset, properties in [
    ('bogor.geojson.json', final_geometries, {'name': 'Bogor', 'codes': ['32.01', '32.71']}),
    ('kabupaten-bogor.geojson.json', [shape(f['geometry']) for f in result['features'] if f['properties']['region'] == 'kabupaten'], {'name': 'Kabupaten Bogor', 'code': '32.01'}),
]:
    outline = unary_union(subset)
    boundary = {'type': 'Feature', 'bbox': list(outline.bounds), 'geometry': mapping(outline),
                'properties': {**properties, 'source': 'Badan Informasi Geospasial', 'edition': EDITION, 'source_url': SOURCE_URL}}
    (frontend_data / filename).write_text(json.dumps(rounded(boundary), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
target = DATA / 'bogor-kecamatan.geojson.json'
target.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(features)} districts, {target.stat().st_size:,} bytes; both population totals verified')
