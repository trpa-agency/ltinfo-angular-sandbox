"""Regenerates seed.sql beside this file.

Sources, all public:
  - programs.json from the LT Info Monitoring Dashboard repo (categories, programs, each
    program's page template, and its chart and map settings for the TRPA map service)
  - the LT Info API (program description, monitoring approach, partners, and photos)
  - the home page of the same repo (index.html and templates/index.html): each
    category's card text, goal, and icon name, and the mapped sites captured from
    LT Info, with the area and line layers it names
  - the TRPA LTInfo_Monitoring map service, for one point per area or line
  - site-profiles.json beside this file: each program's site profile settings, merged into
    its DashboardConfig as siteProfile (keys are program ids; keys starting with _ are notes)
  - extra-categories.json beside this file: categories removed and added on top of
    programs.json, the programs placed under the new ones, and pages built from threshold
    indicators that have no monitoring program (from the Threshold Dashboard record)

    python Sandbox.Database/Scripts/make-seed.py [path to programs.json]

The default path assumes the dashboard repo is cloned beside this one.
"""
import html, io, json, os, re, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PROGRAMS = os.path.join(HERE, "..", "..", "..", "ltinfo-monitoring-dashboard", "programs.json")
API = "https://internalapi.laketahoeinfo.org"
MAP_SERVICE = "https://maps.trpa.org/server/rest/services/LTInfo_Monitoring/MapServer"
CONFIG_KEYS = ("measures", "sitesLayer", "sitesPerYear", "mapLayer", "overlays")
SITE_PROFILES = os.path.join(HERE, "site-profiles.json")
EXTRA_CATEGORIES = os.path.join(HERE, "extra-categories.json")


def site_profiles():
    """Program id to its siteProfile, from site-profiles.json. Keys starting with _ are notes."""
    if not os.path.exists(SITE_PROFILES):
        return {}
    data = json.load(io.open(SITE_PROFILES, encoding="utf-8"))
    return {int(k): v for k, v in data.items() if not k.startswith("_")}


def get(path):
    try:
        req = urllib.request.Request(API + path, headers={"accept": "application/json", "user-agent": "ltinfo-angular-sandbox-seed"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except Exception as e:  # a missing record seeds as empty, it does not stop the run
        print("  fetch failed", path, type(e).__name__)
        return None


def text(s):
    """CMS rich text to plain paragraphs."""
    if not s:
        return None
    s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", "", s)
    s = re.sub(r"(?i)</p>|<br\s*/?>|</li>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\xa0", " ").replace("�", "").replace("‐", "-")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\s*\n\s*", "\n\n", s).strip()
    return s or None


def paragraphs(value):
    """A list of paragraphs, or one string, as the seed's plain text."""
    if isinstance(value, list):
        value = "\n\n".join(v for v in value if v)
    return value or None


def indicator_page(entry):
    """A page for a threshold indicator with no monitoring program, from its Threshold Dashboard record.

    The story is what the indicator measures, why it matters, and its standard; the approach is
    how TRPA evaluates it. A retired indicator opens with why it is no longer reported alone."""
    rec = get(f"/threshold-indicators/{entry['indicator']}") or {}
    ind = get(f"/indicators/{rec['IndicatorID']}") if rec.get("IndicatorID") else None
    desc = [text(rec.get("ThresholdIndicatorPublicDescription")) or text((ind or {}).get("IndicatorDefinition")),
            text(rec.get("Relevance"))]
    standard = text(rec.get("ApplicableStandard"))
    if standard:
        desc.append("Threshold standard: " + standard)
    if not rec.get("IsActive", True):
        desc.insert(0, text(rec.get("InactivationDetailedExplanation")) or "This indicator is no longer evaluated on the Threshold Dashboard.")
    guid = (rec.get("OverviewImageFileResourceGUID") or "").lower()
    return {
        "id": entry["id"], "name": entry.get("name") or rec.get("IndicatorDisplayName"), "ltinfo": False,
        "template": entry.get("template", "context"), "featured": False,
        "description": paragraphs([d for d in desc if d]), "approach": text(rec.get("TRPAIndicator")),
        "partners": entry.get("partners", ["Tahoe Regional Planning Agency"]),
        "images": [(guid, text(rec.get("OverviewImageCaption")), None)] if re.fullmatch(r"[0-9a-f-]{36}", guid) else [],
        **{k: entry[k] for k in CONFIG_KEYS if k in entry},
    }


def merged_categories(data):
    """The categories of programs.json with extra-categories.json applied: removed categories dropped,
    programs added to kept ones, and the new ones appended, each program entry resolved to the shape
    programs.json uses."""
    if not os.path.exists(EXTRA_CATEGORIES):
        return data["categories"], {}
    extra = json.load(io.open(EXTRA_CATEGORIES, encoding="utf-8"))
    removed = set(extra.get("remove", []))
    pool = {p["id"]: p for c in data["categories"] if c["folder"] in removed for p in c["programs"]}
    placed = set()

    def resolve(e):
        placed.add(e["id"])
        if e.get("indicator"):
            return indicator_page(e)
        if e.get("ltinfo") is False:
            return dict(e, description=paragraphs(e.get("description")), approach=paragraphs(e.get("approach")))
        if e["id"] in pool:
            return dict(pool[e["id"]], **{k: v for k, v in e.items() if k != "id"})
        return {"template": "context", "featured": False, "describeFromIndicators": True, **e}

    additions = extra.get("add", {})
    categories = [dict(c, programs=c["programs"] + [resolve(e) for e in additions.get(c["folder"], [])])
                  for c in data["categories"] if c["folder"] not in removed]
    for c in extra.get("categories", []):
        categories.append({"thresholdCategoryId": c["id"], "name": c["name"], "folder": c["folder"],
                           "themeColor": c.get("themeColor") or "#7c7c7c", "blurb": c.get("blurb"),
                           "goal": c.get("goal"), "icon": c.get("icon"),
                           "programs": [resolve(e) for e in c.get("programs", [])]})
    dropped = sorted(set(pool) - placed)
    if dropped:
        print("  programs of removed categories that extra-categories.json does not place:", dropped)
    return categories, extra.get("organizations", {})


def home_page_data(repo):
    """Category copy and the site snapshot that the dashboard repo's home page embeds."""
    page = io.open(os.path.join(repo, "index.html"), encoding="utf-8").read()
    start = re.search(r"\bSNAPSHOT\s*=\s*", page).end()
    snapshot, _ = json.JSONDecoder().raw_decode(page, start)
    template = io.open(os.path.join(repo, "templates", "index.html"), encoding="utf-8").read()
    blurbs = dict(re.findall(r"'([a-z-]+)':\s*\{\s*blurb:\s*'([^']*)'", template))
    return snapshot, blurbs


def representative_points(area):
    """One point on each feature of a map service layer: the vertex nearest the mean of its vertices."""
    points, offset = [], 0
    while True:
        params = {"where": area.get("where") or "1=1", "outFields": area.get("name") or "OBJECTID", "returnGeometry": "true",
                  "outSR": 4326, "geometryPrecision": 5, "maxAllowableOffset": 0.0005, "f": "geojson",
                  "resultOffset": offset, "resultRecordCount": 1000}
        url = f"{MAP_SERVICE}/{area['layer']}/query?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"user-agent": "ltinfo-angular-sandbox-seed"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.load(r)
        for f in data.get("features", []):
            g = f.get("geometry") or {}
            coords = g.get("coordinates") or []
            kind = g.get("type")
            if kind == "Polygon":
                verts = coords[0] if coords else []
            elif kind == "MultiPolygon":
                verts = max((poly[0] for poly in coords if poly), key=len, default=[])
            elif kind == "LineString":
                verts = coords
            elif kind == "MultiLineString":
                verts = [v for line in coords for v in line]
            else:
                verts = []
            if not verts:
                continue
            mx = sum(v[0] for v in verts) / len(verts)
            my = sum(v[1] for v in verts) / len(verts)
            x, y = min(verts, key=lambda v: (v[0] - mx) ** 2 + (v[1] - my) ** 2)
            name = (f.get("properties") or {}).get(area["name"]) if area.get("name") else None
            points.append((round(y, 6), round(x, 6), str(name).strip() if name not in (None, "") else None))
        more = data.get("exceededTransferLimit") or (data.get("properties") or {}).get("exceededTransferLimit")
        if not more:
            break
        offset += 1000
    return points


def q(s):
    return "NULL" if s is None else "N'" + str(s).replace("'", "''") + "'"


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PROGRAMS
    data = json.load(io.open(path, encoding="utf-8"))
    snapshot, blurbs = home_page_data(os.path.dirname(os.path.abspath(path)))
    snap_categories = {c["folder"]: c for c in snapshot["categories"]}
    snap_programs = {p["id"]: p for p in snapshot["programs"]}
    lines = [
        "-- Generated by make-seed.py from the LT Info Monitoring Dashboard's programs.json and the",
        "-- public LT Info API. Rerun the generator to refresh; do not hand-edit.",
        "SET NOCOUNT ON;",
        "",
    ]
    profiles = site_profiles()
    categories, short_names = merged_categories(data)
    orgs, links, programs, images = {}, [], [], []

    def link_partner(pid, name, short, sort):
        if name not in orgs:
            orgs[name] = (len(orgs) + 1, short)
        if (pid, orgs[name][0]) in {(a, b) for a, b, _ in links}:
            return False
        links.append((pid, orgs[name][0], sort))
        return True

    for ci, c in enumerate(categories, 1):
        sc = snap_categories.get(c["folder"], {})
        lines.append(
            "INSERT INTO dbo.MonitoringProgramCategory (MonitoringProgramCategoryID, MonitoringProgramCategoryName, Folder, ThemeColor, SortOrder, Blurb, CategoryDescription, IconName) "
            f"VALUES ({c['thresholdCategoryId']}, {q(c['name'])}, {q(c['folder'])}, {q(c['themeColor'])}, {ci * 10}, "
            f"{q(blurbs.get(c['folder']) or c.get('blurb'))}, {q(sc.get('description') or c.get('goal'))}, {q(sc.get('apiName') or c.get('icon'))});"
        )
        for p in c["programs"]:
            desc, appr = text(p.get("description")), text(p.get("approach"))
            name = p.get("name")
            n_partners = n_images = 0
            if p.get("ltinfo", True):
                rec = get(f"/monitoring-programs/{p['id']}")
                if rec:
                    desc = text(rec.get("MonitoringProgramDescription")) or desc
                    appr = text(rec.get("MonitoringApproach")) or appr
                    name = name or rec.get("MonitoringProgramName")
                if not desc and p.get("describeFromIndicators"):
                    # Many uncategorized LT Info programs added here have no description: say what their
                    # threshold indicators measure instead.
                    defs = [text((get(f"/indicators/{i['IndicatorID']}") or {}).get("IndicatorDefinition"))
                            for i in (get(f"/monitoring-programs/{p['id']}/indicators") or [])]
                    desc = paragraphs([d for d in defs if d])
                for si, o in enumerate(sorted(get(f"/monitoring-programs/{p['id']}/partners") or [], key=lambda o: o.get("SortOrder") or 0), 1):
                    org = (o.get("OrganizationName") or "").strip()
                    if org and link_partner(p["id"], org, o.get("OrganizationShortName") or None, si * 10):
                        n_partners += 1
                for im in sorted(get(f"/monitoring-programs/{p['id']}/images") or [], key=lambda i: (not i.get("IsKeyPhoto"), i.get("SortOrder") or 0)):
                    guid = (im.get("FileResourceGUID") or "").lower()
                    if not re.fullmatch(r"[0-9a-f-]{36}", guid):
                        continue
                    n_images += 1
                    images.append((p["id"], guid, text(im.get("Caption")), text(im.get("PhotoCredit")), 1 if im.get("IsKeyPhoto") else 0, n_images * 10))
            else:
                for si, org in enumerate(p.get("partners", []), 1):
                    if link_partner(p["id"], org, short_names.get(org), si * 10):
                        n_partners += 1
                for guid, caption, credit in p.get("images", []):
                    n_images += 1
                    images.append((p["id"], guid, caption, credit, 1 if n_images == 1 else 0, n_images * 10))
            if not name:
                raise SystemExit(f"program {p['id']} has no name")
            config = {k: p[k] for k in CONFIG_KEYS if p.get(k)}
            if p["id"] in profiles:
                config["siteProfile"] = profiles[p["id"]]
            programs.append((p["id"], name, c["thresholdCategoryId"], desc, appr, 1 if p.get("featured") else 0,
                             p.get("template", "charts"), json.dumps(config, separators=(",", ":")) if config else None))
            print(f"  {p['id']:>5} {name[:38]:38} {p.get('template', 'charts'):8} partners={n_partners} photos={n_images} config={'y' if config else '-'}")
    lines.append("")
    for pid, name, cid, desc, appr, feat, template, config in programs:
        lines.append(
            "INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured, Template, DashboardConfig) "
            f"VALUES ({pid}, {q(name)}, {cid}, {q(desc)}, {q(appr)}, {feat}, {q(template)}, {q(config)});"
        )
    lines += ["", "SET IDENTITY_INSERT dbo.Organization ON;"]
    for name, (oid, short) in orgs.items():
        lines.append(f"INSERT INTO dbo.Organization (OrganizationID, OrganizationName, OrganizationShortName) VALUES ({oid}, {q(name)}, {q(short)});")
    lines += ["SET IDENTITY_INSERT dbo.Organization OFF;", ""]
    for pid, oid, sort in links:
        lines.append(f"INSERT INTO dbo.MonitoringProgramOrganization (MonitoringProgramID, OrganizationID, SortOrder) VALUES ({pid}, {oid}, {sort});")
    lines.append("")
    for pid, guid, caption, credit, key, sort in images:
        lines.append(
            "INSERT INTO dbo.MonitoringProgramImage (MonitoringProgramID, FileResourceGUID, Caption, PhotoCredit, IsKeyPhoto, SortOrder) "
            f"VALUES ({pid}, '{guid}', {q(caption)}, {q(credit)}, {key}, {sort});"
        )
    lines.append("")
    kinds = {"site": 0, "area": 0, "line": 0}
    for pid, *_ in programs:
        sp = snap_programs.get(pid) or {}
        for lat, lng, name in sp.get("sites") or []:
            lines.append(f"INSERT INTO dbo.MonitoringSite (MonitoringProgramID, SiteName, SiteKind, Latitude, Longitude) VALUES ({pid}, {q(name)}, 'site', {lat}, {lng});")
            kinds["site"] += 1
        area = sp.get("areas")
        if area and area.get("count"):
            kind = "line" if area.get("geometry") == "line" else "area"
            pts = representative_points(area)
            print(f"  {pid:>5} {kind}s from layer {area['layer']}: {len(pts)} points (snapshot counted {area['count']})")
            for lat, lng, name in pts:
                lines.append(f"INSERT INTO dbo.MonitoringSite (MonitoringProgramID, SiteName, SiteKind, Latitude, Longitude) VALUES ({pid}, {q(name)}, '{kind}', {lat}, {lng});")
                kinds[kind] += 1
    unused = sorted(set(profiles) - {pid for pid, *_ in programs})
    if unused:
        print("  site-profiles.json names programs that are not in programs.json:", unused)
    out = os.path.join(HERE, "seed.sql")
    io.open(out, "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")
    with_photos = len({i[0] for i in images})
    print(f"seed.sql: {len(categories)} categories, {len(programs)} programs, {len(orgs)} organizations, {len(links)} partner links, "
          f"{len(images)} photos across {with_photos} programs, {len(profiles)} site profiles, mapped locations {kinds} (snapshot captured {snapshot.get('captured')}), {os.path.getsize(out)} bytes")


if __name__ == "__main__":
    main()
