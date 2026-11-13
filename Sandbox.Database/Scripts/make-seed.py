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
    indicators that have no monitoring program (from the Threshold Dashboard record). A page
    written there with a sitesLayer gets its mapped sites from that layer

    python Sandbox.Database/Scripts/make-seed.py [path to programs.json]

The default path assumes the dashboard repo is cloned beside this one.
"""
import csv, html, io, json, os, re, sys, urllib.parse, urllib.request

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
    return tidy(s) or None


# A threshold standard's code at the start of a paragraph, such as "VP15:" or "F2)".
STANDARD_CODE = re.compile(r"^[A-Z]{1,3}\d{1,2}[a-z]?\s*[:)]\s*")


def tidy(s):
    """House style on CMS text: standard codes off the front of paragraphs, a percent sign and an
    ampersand in prose written out, a last paragraph cut off mid-word in the source trimmed back to
    its last whole sentence, and repeated paragraphs dropped."""
    out = []
    for p in s.split("\n\n"):
        p = STANDARD_CODE.sub("", p.strip())
        p = re.sub(r"(\d)\s?%", r"\1 percent", p).replace(" & ", " and ")
        if p and p not in out:
            out.append(p)
    if out and len(out[-1]) > 200 and out[-1][-1].islower():
        # A sentence ends at a period before a capital, but not after "al." or "e.g." in a citation.
        ends = [m.end() for m in re.finditer(r"(?<!\bal)(?<!\be\.g)\.(?=\s+[A-Z“\"])", out[-1])]
        if ends:
            out[-1] = out[-1][: ends[-1]]
    return "\n\n".join(out)


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
        desc.append("Threshold standard: " + STANDARD_CODE.sub("", standard))
    if not rec.get("IsActive", True):
        desc.insert(0, text(rec.get("InactivationDetailedExplanation")) or "This indicator is no longer evaluated on the Threshold Dashboard.")
    guid = (rec.get("OverviewImageFileResourceGUID") or "").lower()
    return {
        "id": entry["id"], "name": entry.get("name") or rec.get("IndicatorDisplayName"), "ltinfo": False,
        "template": entry.get("template", "context"), "featured": False,
        "description": paragraphs([d for d in desc if d]), "approach": text(rec.get("TRPAIndicator")),
        "partners": entry.get("partners", ["Tahoe Regional Planning Agency"]),
        "images": [(guid, text(rec.get("OverviewImageCaption")), None)] if re.fullmatch(r"[0-9a-f-]{36}", guid) else [],
        "relatedIndicators": ([rec["IndicatorID"]] if rec.get("IndicatorID") else []) + entry.get("relatedIndicators", []),
        **{k: entry[k] for k in CONFIG_KEYS if k in entry},
    }


DASHBOARDS = {
    "thresholds": "Threshold Dashboard",
    "climate": "Climate Resilience Dashboard",
    "clarity": "Lake Clarity Tracker",
    "transportation": "Transportation Tracker",
}
_indicators, _outcomes = {}, {}


def related_links(indicator_ids):
    """Links from a monitoring page to the pages of the other LT Info dashboards that report the same
    indicators: its Threshold Dashboard indicators, Climate Resilience Dashboard outcomes, and the Lake
    Clarity and Transportation tracker pages. Built from each LT Info indicator's reporting flags."""
    if not _outcomes:
        _outcomes.update({o["ClimateResilienceOutcomeID"]: o for o in get("/climate-resilience-outcomes") or []})
    out, seen = [], set()

    def add(dashboard, label, url):
        if url not in seen:
            seen.add(url)
            out.append({"Dashboard": DASHBOARDS[dashboard], "Label": label, "Url": url})

    for i in dict.fromkeys(indicator_ids):
        if i not in _indicators:
            _indicators[i] = get(f"/indicators/{i}") or {}
        ind = _indicators[i]
        if not ind.get("IsActive"):
            continue
        name = (ind.get("IndicatorDisplayName") or "").strip()
        if ind.get("IsReportedInThresholdDashboard") and ind.get("ThresholdIndicatorID"):
            add("thresholds", name, f"https://thresholds.laketahoeinfo.org/threshold/indicators/{ind['ThresholdIndicatorID']}")
        outcome = _outcomes.get(ind.get("ClimateResilienceOutcomeID"))
        if ind.get("IsReportedInClimateResilienceDashboard") and outcome:
            add("climate", outcome["ShortName"], f"https://climate.laketahoeinfo.org/{outcome['OutcomeSlug']}")
        if ind.get("IsReportedInLakeClarity"):
            if re.search(r"clarity|secchi", name, re.I):
                add("clarity", "Water Clarity", "https://clarity.laketahoeinfo.org/results/water-clarity")
            else:
                add("clarity", "Results Overview", "https://clarity.laketahoeinfo.org/results/overview")
        if ind.get("IsReportedInTransportationDashboard") or ind.get("IsReportedInTransportationTracker"):
            add("transportation", "Data Trends", "https://transportation.laketahoeinfo.org/transportation/data-trends")
    order = list(DASHBOARDS.values())
    return sorted(out, key=lambda l: order.index(l["Dashboard"]))


def merged_categories(data):
    """The categories of programs.json with extra-categories.json applied: removed categories dropped,
    programs added to kept ones, and the new ones appended, each program entry resolved to the shape
    programs.json uses."""
    if not os.path.exists(EXTRA_CATEGORIES):
        return data["categories"], {}
    extra = json.load(io.open(EXTRA_CATEGORIES, encoding="utf-8"))
    removed = set(extra.get("remove", []))
    # Programs left out everywhere, wherever programs.json or a category list puts them.
    drop = set(extra.get("drop", []))
    pool = {p["id"]: p for c in data["categories"] if c["folder"] in removed for p in c["programs"]}
    # Every programs.json program by id, so a new category can also take one from a kept category
    # (it then leaves that category).
    everything = {p["id"]: p for c in data["categories"] for p in c["programs"]}
    moved = {e["id"] for c in extra.get("categories", []) for e in c.get("programs", [])
             if e["id"] in everything and e["id"] not in pool}
    placed = set()

    def resolve(e):
        placed.add(e["id"])
        if e.get("indicator"):
            return indicator_page(e)
        if e.get("ltinfo") is False:
            # ownSites: the snapshot never saw this page, so its mapped sites come from its sites layer.
            return dict(e, description=paragraphs(e.get("description")), approach=paragraphs(e.get("approach")), ownSites=True)
        if e["id"] in everything:
            return dict(everything[e["id"]], **{k: v for k, v in e.items() if k != "id"})
        return {"template": "context", "featured": False, "describeFromIndicators": True, **e}

    additions = extra.get("add", {})
    categories = [dict(c, programs=[p for p in c["programs"] if p["id"] not in moved | drop] + [resolve(e) for e in additions.get(c["folder"], []) if e["id"] not in drop])
                  for c in data["categories"] if c["folder"] not in removed]
    for c in extra.get("categories", []):
        categories.append({"thresholdCategoryId": c["id"], "name": c["name"], "folder": c["folder"],
                           "themeColor": c.get("themeColor") or "#7c7c7c", "blurb": c.get("blurb"),
                           "goal": c.get("goal"), "icon": c.get("icon"),
                           "programs": [resolve(e) for e in c.get("programs", []) if e["id"] not in drop]})
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


def site_points(cfg):
    """One point per feature of a sites layer on a map service, for a page written in
    extra-categories.json whose sites the dashboard repo's snapshot never captured."""
    params = {"where": cfg.get("where") or "1=1", "outFields": cfg["name"], "returnGeometry": "true", "outSR": 4326, "f": "geojson"}
    url = f"{cfg.get('service') or MAP_SERVICE}/{cfg['layer']}/query?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"user-agent": "ltinfo-angular-sandbox-seed"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)
    points = []
    for f in data.get("features", []):
        g = f.get("geometry") or {}
        if g.get("type") != "Point":
            continue
        x, y = g["coordinates"][:2]
        name = (f.get("properties") or {}).get(cfg["name"])
        points.append((round(y, 6), round(x, 6), str(name).strip() if name not in (None, "") else None))
    return sorted(points, key=lambda pt: pt[2] or "")


def q(s):
    return "NULL" if s is None else "N'" + str(s).replace("'", "''") + "'"


def write_crosslinks(rows):
    """The other direction, for ESA: each page on the other dashboards and the monitoring pages that
    report its indicators, so those pages can link back. LT Info programs have a monitoring page
    address now; the rest are pages the redesign adds."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cross-links.csv")
    out = io.StringIO()
    w = csv.writer(out, lineterminator=chr(10))
    w.writerow(["Dashboard", "Dashboard page", "Dashboard page address", "Monitoring page", "Monitoring program ID", "Monitoring page address now"])
    order = list(DASHBOARDS.values())
    for dash, label, url, pid, name in sorted(rows, key=lambda r: (order.index(r[0]), r[1], r[4])):
        now = f"https://monitoring.laketahoeinfo.org/monitoring-programs/{pid}" if pid < 9000 else "new page"
        w.writerow([dash, label, url, name, pid, now])
    io.open(path, "w", encoding="utf-8", newline="").write(out.getvalue())
    print(f"cross-links.csv: {len(rows)} links from {len({r[3] for r in rows})} monitoring pages")


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
    related_ids = json.load(io.open(EXTRA_CATEGORIES, encoding="utf-8")).get("related", {}) if os.path.exists(EXTRA_CATEGORIES) else {}
    orgs, links, programs, images, crosslinks = {}, [], [], [], []
    # Sites layers of the pages written in extra-categories.json, by program id.
    own_sites = {}

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
            if p.get("ownSites") and p.get("sitesLayer"):
                own_sites[p["id"]] = p["sitesLayer"]
            if p["id"] in profiles:
                config["siteProfile"] = profiles[p["id"]]
            indicator_ids = list(p.get("relatedIndicators", [])) + related_ids.get(str(p["id"]), [])
            if p.get("ltinfo", True):
                indicator_ids += [i["IndicatorID"] for i in (get(f"/monitoring-programs/{p['id']}/indicators") or []) if i.get("IndicatorID")]
            related = related_links(indicator_ids)
            for link in related:
                crosslinks.append((link["Dashboard"], link["Label"], link["Url"], p["id"], name))
            programs.append((p["id"], name, c["thresholdCategoryId"], desc, appr, 1 if p.get("featured") else 0,
                             p.get("template", "charts"), json.dumps(config, separators=(",", ":")) if config else None,
                             json.dumps(related, separators=(",", ":")) if related else None))
            print(f"  {p['id']:>5} {name[:38]:38} {p.get('template', 'charts'):8} partners={n_partners} photos={n_images} config={'y' if config else '-'}")
    lines.append("")
    for pid, name, cid, desc, appr, feat, template, config, related in programs:
        lines.append(
            "INSERT INTO dbo.MonitoringProgram (MonitoringProgramID, MonitoringProgramName, MonitoringProgramCategoryID, MonitoringProgramDescription, MonitoringApproach, IsFeatured, Template, DashboardConfig, RelatedLinks) "
            f"VALUES ({pid}, {q(name)}, {cid}, {q(desc)}, {q(appr)}, {feat}, {q(template)}, {q(config)}, {q(related)});"
        )
    write_crosslinks(crosslinks)
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
        if pid in own_sites:
            pts = site_points(own_sites[pid])
            print(f"  {pid:>5} sites from {own_sites[pid].get('service', MAP_SERVICE).split('/services/')[-1]} layer {own_sites[pid]['layer']}: {len(pts)} points")
            for lat, lng, name in pts:
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
