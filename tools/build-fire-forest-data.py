"""Write the Fire Dynamics and Forest Structure data files the app cannot get from a plain query.

Two services need geometry work before they chart honestly:

* CAL FIRE fire perimeters carry each fire's full size (Caldor: 221,786 acres), so area burned in
  the Basin needs each perimeter clipped to the TRPA boundary and measured in California Albers.
* The large tree layer has 84,373 points, too many to draw in a browser, so they are counted in
  hexagons of about 100 acres.

Writes, under Sandbox.Web/public/data/:
  fire-history/area-burned-by-year.json    Year, Acres (in the Basin)
  fire-history/largest-fires.json          Fire, Year, Acres (in the Basin), the 12 largest
  fire-history/fire-perimeters.geojson     clipped perimeters: Fire, Year, Acres, Cause
  large-trees/trees-by-diameter.json       Diameter, Trees
  large-trees/large-tree-hexagons.geojson  100-acre hexagons with the count of Trees in each

Needs geopandas: run with the arcgispro-py3-clone environment, for example
  %LOCALAPPDATA%\\ESRI\\conda\\envs\\arcgispro-py3-clone\\python.exe tools\\build-fire-forest-data.py
"""

import json
import logging
import math
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Polygon, shape

CALFIRE = 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/California_Historic_Fire_Perimeters/FeatureServer/0'
BOUNDARY = 'https://maps.trpa.org/server/rest/services/Boundaries/MapServer/4'
LARGE_TREES = 'https://maps.trpa.org/server/rest/services/Large_Trees_Reference/FeatureServer/0'
ALBERS = 3310  # California Albers, meters
ACRE_M2 = 4046.8564224
HEX_ACRES = 100
OUT = Path(__file__).resolve().parent.parent / 'Sandbox.Web' / 'public' / 'data'

log = logging.getLogger('fire-forest')


def get(url: str, **params) -> dict:
    params.setdefault('f', 'json')
    request = urllib.request.Request(f'{url}?{urllib.parse.urlencode(params)}', headers={'user-agent': 'ltinfo-sandbox'})
    with urllib.request.urlopen(request, timeout=300) as response:
        data = json.load(response)
    if isinstance(data, dict) and data.get('error'):
        raise RuntimeError(f'{url}: {data["error"]}')
    return data


def features(url: str, page: int = 2000, **params) -> list:
    """Every feature of a query as GeoJSON in WGS84, paged."""
    out = []
    while True:
        data = get(f'{url}/query', f='geojson', outSR=4326, resultOffset=len(out), resultRecordCount=page, **params)
        batch = data.get('features', [])
        out.extend(batch)
        more = data.get('exceededTransferLimit') or (data.get('properties') or {}).get('exceededTransferLimit')
        if not batch or not more:
            return out


def frame(rows: list) -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame(
        [r.get('properties') or {} for r in rows],
        geometry=[shape(r['geometry']) if r.get('geometry') else None for r in rows],
        crs=4326,
    )


def write_json(path: Path, rows) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    log.info('wrote %s', path.relative_to(OUT.parent.parent.parent))


def write_geojson(path: Path, gdf: gpd.GeoDataFrame, tolerance: float) -> None:
    gdf = gdf.to_crs(4326)
    gdf['geometry'] = gdf.geometry.simplify(tolerance, preserve_topology=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = gdf.to_json(drop_id=True)
    # Five decimals is about a meter; the files stay small.
    collection = json.loads(text, parse_float=lambda s: round(float(s), 5))
    path.write_text(json.dumps(collection, separators=(',', ':')), encoding='utf-8')
    log.info('wrote %s (%d features, %d KB)', path.relative_to(OUT.parent.parent.parent), len(gdf), path.stat().st_size // 1024)


def basin() -> gpd.GeoDataFrame:
    gdf = frame(features(BOUNDARY, outFields='*', where='1=1'))
    return gpd.GeoDataFrame(geometry=[gdf.to_crs(ALBERS).geometry.union_all()], crs=ALBERS)


def fire_history(boundary: gpd.GeoDataFrame) -> None:
    xmin, ymin, xmax, ymax = boundary.to_crs(4326).total_bounds
    envelope = json.dumps({'xmin': xmin, 'ymin': ymin, 'xmax': xmax, 'ymax': ymax, 'spatialReference': {'wkid': 4326}})
    rows = features(
        CALFIRE,
        where='1=1',
        outFields='YEAR_,FIRE_NAME,CAUSE,GIS_ACRES,AGENCY,UNIT_ID',
        geometry=envelope,
        geometryType='esriGeometryEnvelope',
        inSR=4326,
        spatialRel='esriSpatialRelIntersects',
    )
    fires = frame(rows).dropna(subset=['geometry']).to_crs(ALBERS)
    fires['geometry'] = fires.geometry.make_valid()
    fires['full_acres'] = fires.geometry.area / ACRE_M2
    clipped = gpd.clip(fires, boundary)
    clipped = clipped[~clipped.geometry.is_empty].copy()
    clipped['Acres'] = clipped.geometry.area / ACRE_M2
    # Perimeters drawn along the boundary leave slivers that are not fires in the Basin.
    keep = (clipped['Acres'] >= 5) | (clipped['Acres'] >= 0.5 * clipped['full_acres'])
    for _, r in clipped[~keep].iterrows():
        log.info('dropped sliver: %s %s, %.2f of %.0f acres', r['YEAR_'], r['FIRE_NAME'], r['Acres'], r['full_acres'])
    clipped = clipped[keep & clipped['YEAR_'].notna()].copy()
    clipped['Year'] = clipped['YEAR_'].astype(int)
    clipped['Fire'] = clipped['FIRE_NAME'].fillna('').str.strip().str.title().replace('', 'Unnamed')
    log.info('%d fires in the Basin, %d to %d, %.0f acres', len(clipped), clipped['Year'].min(), clipped['Year'].max(), clipped['Acres'].sum())

    by_year = clipped.groupby('Year')['Acres'].sum()
    years = range(int(by_year.index.min()), int(by_year.index.max()) + 1)
    write_json(OUT / 'fire-history' / 'area-burned-by-year.json', [{'Year': y, 'Acres': round(float(by_year.get(y, 0.0)), 1)} for y in years])

    largest = clipped.sort_values('Acres', ascending=False).head(12)
    write_json(
        OUT / 'fire-history' / 'largest-fires.json',
        [{'Fire': f"{r['Fire']} ({r['Year']})", 'Year': int(r['Year']), 'Acres': round(float(r['Acres']), 1)} for _, r in largest.iterrows()],
    )

    causes = {1: 'Lightning', 2: 'Equipment use', 3: 'Smoking', 4: 'Campfire', 5: 'Debris', 6: 'Railroad', 7: 'Arson',
              8: 'Playing with fire', 9: 'Miscellaneous', 10: 'Vehicle', 11: 'Powerline', 12: 'Firefighter training',
              13: 'Non-firefighter training', 14: 'Unknown', 15: 'Structure', 16: 'Aircraft', 18: 'Escaped prescribed burn',
              19: 'Illegal alien campfire'}
    out = clipped[['Fire', 'Year', 'Acres', 'CAUSE', 'geometry']].copy()
    out['Acres'] = out['Acres'].round(1)
    out['Cause'] = out['CAUSE'].map(lambda c: causes.get(int(c), 'Unknown') if c == c and c is not None else 'Unknown')
    out = out.drop(columns='CAUSE').sort_values('Year', ascending=False)
    # Text, so the map list and popups show 2021 rather than a count of 2,021.
    out['Year'] = out['Year'].astype(str)
    write_geojson(OUT / 'fire-history' / 'fire-perimeters.geojson', out, 0.00015)


def hexagons(bounds, acres: float) -> list:
    """Flat-topped hexagons of the given area covering the bounds (meters)."""
    side = math.sqrt(2 * acres * ACRE_M2 / (3 * math.sqrt(3)))
    dx, dy = 1.5 * side, math.sqrt(3) * side
    xmin, ymin, xmax, ymax = bounds
    cells, col = [], 0
    x = xmin
    while x <= xmax + dx:
        y = ymin - (dy / 2 if col % 2 else 0)
        while y <= ymax + dy:
            cells.append(Polygon([(x + side * math.cos(math.radians(a)), y + side * math.sin(math.radians(a))) for a in range(0, 360, 60)]))
            y += dy
        x += dx
        col += 1
    return cells


def large_trees() -> None:
    rows = features(LARGE_TREES, where='1=1', outFields='ImpDBH1')
    trees = frame(rows).dropna(subset=['geometry']).to_crs(ALBERS)
    log.info('%d large trees', len(trees))

    # Diameters are imputed from LiDAR height and cluster at a few values, so the classes are 4 inches wide.
    classes = [(36, 40), (40, 44), (44, 48), (48, None)]
    dbh = trees['ImpDBH1']
    out = []
    for low, high in classes:
        n = int(((dbh >= low) & (dbh < high)).sum()) if high else int((dbh >= low).sum())
        out.append({'Diameter': f'{low} to {high} in.' if high else f'{low} in. and up', 'Trees': n})
    under = int((dbh < 36).sum())
    if under:
        log.info('%d trees under 36 inches counted in the first class', under)
        out[0]['Trees'] += under
    write_json(OUT / 'large-trees' / 'trees-by-diameter.json', out)

    grid = gpd.GeoDataFrame(geometry=hexagons(trees.total_bounds, HEX_ACRES), crs=ALBERS)
    joined = gpd.sjoin(trees[['geometry']], grid, predicate='within', how='inner')
    counts = joined.groupby('index_right').size()
    cells = grid.loc[counts.index].copy()
    cells['Trees'] = counts.values
    cells = cells.reset_index(drop=True)
    cells.insert(0, 'Cell', [f'Hexagon {i + 1}' for i in range(len(cells))])
    log.info('%d hexagons with trees; most in one: %d', len(cells), cells['Trees'].max())
    write_geojson(OUT / 'large-trees' / 'large-tree-hexagons.geojson', cells, 0)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format='%(message)s', stream=sys.stdout)
    sys.stdout.reconfigure(encoding='utf-8')
    fire_history(basin())
    large_trees()


if __name__ == '__main__':
    main()
