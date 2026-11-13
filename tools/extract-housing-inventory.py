"""Writes the affordable and workforce housing inventory as chart data for its program page.

The inventory is a parcel list TRPA Long Range Planning keeps as a spreadsheet. No map service
publishes it; the Planning repository's Housing Progress page
(https://trpa-agency.github.io/Planning/LongRange/html/multifamily-housing.html) reads a copy
compiled to LongRange/data/multifamily_parcels.js. This reads that copy and writes three small
JSON files to Sandbox.Web/public/data/housing/, which the page charts with a measure's json key.
When the inventory is published as a table on maps.trpa.org, point the measures at it and
delete this script.

Each record is one parcel with a unit count, a jurisdiction, a year built, a timing (built
before or since 2012, permitted, or bonus units reserved), and a housing type. The type field
mixes building form with deed restriction, and some values name two things. The grouping rule
here, applied in this order, matches the Housing Progress page:

  1. Any type naming an accessory dwelling unit is an accessory dwelling unit.
  2. Any other type naming a deed restriction is deed-restricted, at the level it names. The one
     record naming two levels with a unit count for each is split between them.
  3. Everything else keeps its recorded type.

    python -I tools/extract-housing-inventory.py
"""
import collections, io, json, os, re, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "Sandbox.Web", "public", "data", "housing")
SOURCE = "https://trpa-agency.github.io/Planning/LongRange/data/multifamily_parcels.js"
PAGE = "https://trpa-agency.github.io/Planning/LongRange/html/multifamily-housing.html"

JURISDICTIONS = {
    "CSLT": "City of South Lake Tahoe",
    "PL": "Placer County",
    "WA": "Washoe County",
    "DG": "Douglas County",
    "EL": "El Dorado County",
    "CC": "Carson City",
}
TIMINGS = {
    "Existing - Built Pre-2012": "Built before 2012",
    "Existing - Built Post-2012": "Built 2012 or later",
    "Permitted Not Constructed": "Permitted, not built",
    "Bonus Units Reserved, Application not submitted": "Bonus units reserved",
}
TYPES = {
    "Multi-Family Dwellings": "Multifamily dwellings",
    "Apartment": "Apartments",
    "Mobile Home Units": "Mobile homes",
    "Single Room Occupancy": "Single room occupancy",
    "Senior/Retirement Housing": "Senior housing",
    "College Dormitory": "College dormitories",
    "Condominium Units": "Condominiums",
    "Hotel Manager Units": "Hotel manager units",
    "Townhomes": "Townhomes",
}
ADU = "Accessory dwelling units"
LEVEL = re.compile(r"Deed-Restricted (Affordable|Moderate|Achievable)(?: \((\d+)\))?")


def records():
    """The inventory rows as dictionaries, and the date the copy was compiled."""
    req = urllib.request.Request(SOURCE, headers={"user-agent": "ltinfo-angular-sandbox"})
    text = urllib.request.urlopen(req, timeout=90).read().decode("utf-8")
    # The file assigns one JSON object to a global; read the object, run nothing.
    data, _ = json.JSONDecoder().raw_decode(text[text.index("{", text.index("window.MF_DATA")):])
    return [dict(zip(data["columns"], row)) for row in data["rows"]], data["generated"]


def groups(record):
    """(group, units) pairs for one record, by the rule in the module docstring."""
    kind, units = record["type"] or "", record["units"] or 0
    if "Accessory Dwelling" in kind:
        return [(ADU, units)]
    levels = LEVEL.findall(kind)
    if levels:
        counted = [(level, int(n)) for level, n in levels if n]
        if len(levels) > 1 and len(counted) == len(levels) and sum(n for _, n in counted) == units:
            return [(f"Deed-restricted, {level.lower()}", n) for level, n in counted]
        return [(f"Deed-restricted, {levels[0][0].lower()}", units)]
    return [(TYPES.get(kind, kind or "Not stated"), units)]


def write(name, title, rows, generated, note=None):
    body = {"title": title, "source": PAGE, "generated": generated, **({"note": note} if note else {}), "rows": rows}
    path = os.path.join(OUT, f"{name}.json")
    io.open(path, "w", encoding="utf-8", newline="\n").write(json.dumps(body, indent=1, ensure_ascii=False) + "\n")
    print(f"  {name}.json: {len(rows)} rows")


def main():
    os.makedirs(OUT, exist_ok=True)
    rows, generated = records()
    existing = [r for r in rows if (r["timing"] or "").startswith("Existing")]
    total = sum(r["units"] or 0 for r in rows)
    print(f"inventory compiled {generated}: {len(rows)} parcels, {total} units, {sum(r['units'] or 0 for r in existing)} existing")

    # Checks on the source, printed so a run shows what the charts rest on.
    unknown = sorted({r["juris"] for r in rows} - set(JURISDICTIONS)) + sorted({r["timing"] for r in rows} - set(TIMINGS))
    if unknown:
        raise SystemExit(f"values this script has no label for: {unknown}")
    repeats = [apn for apn, n in collections.Counter(r["apn"] for r in rows).items() if n > 1]
    print(f"  parcel numbers listed more than once: {len(repeats)}")
    print(f"  existing parcels with no year built: {sum(1 for r in existing if not r['yearBuilt'])}")
    since = sum(r["units"] or 0 for r in existing if (r["yearBuilt"] or 0) >= 2012)
    timed = sum(r["units"] or 0 for r in rows if r["timing"] == "Existing - Built Post-2012")
    print(f"  units with a year built of 2012 or later: {since}; units timed as built 2012 or later: {timed}")

    # 1. Units by jurisdiction and timing.
    by = collections.Counter((r["juris"], r["timing"]) for r in rows for _ in range(r["units"] or 0))
    order = sorted(JURISDICTIONS, key=lambda j: -sum(n for (jj, _), n in by.items() if jj == j))
    write("units-by-jurisdiction", "Affordable and workforce housing units by jurisdiction and status",
          [{"Jurisdiction": JURISDICTIONS[j], "Status": TIMINGS[t], "Units": by[(j, t)]} for j in order for t in TIMINGS if by[(j, t)]],
          generated)

    # 2. Existing units by year built, 2012 on, in three groups. Every year and group has a row,
    # so a year with nothing built reads as zero rather than missing.
    def three(group):
        return group if group == ADU else "Deed-restricted" if group.startswith("Deed-restricted") else "Other affordable and workforce"

    built = collections.Counter()
    for r in existing:
        if (r["yearBuilt"] or 0) >= 2012:
            for group, units in groups(r):
                built[(r["yearBuilt"], three(group))] += units
    last = max(year for year, _ in built)
    write("units-built-by-year", "Affordable and workforce housing units built each year since 2012",
          [{"Year": year, "Group": g, "Units": built[(year, g)]}
           for year in range(2012, last + 1) for g in ("Deed-restricted", ADU, "Other affordable and workforce")],
          generated, note=f"{last} is a partial year: the inventory was compiled {generated}.")

    # 3. Existing units by housing type.
    kinds = collections.Counter()
    for r in existing:
        for group, units in groups(r):
            kinds[group] += units
    write("existing-units-by-type", "Existing affordable and workforce housing units by type",
          [{"Type": k, "Units": n} for k, n in kinds.most_common()], generated)
    deed = {k: n for k, n in kinds.items() if k.startswith("Deed-restricted")}
    print(f"  existing deed-restricted units outside accessory dwelling units: {sum(deed.values())} {deed}")


if __name__ == "__main__":
    main()
