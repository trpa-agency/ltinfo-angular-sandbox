"""Writes the forest plot network design as chart data for its program page.

TRPA is designing a network of permanent field plots for the forest structure standards. No
plot is installed and no site list is final, so there is nothing on maps.trpa.org to read: the
design lives in the plot-network-design folder of TRPA's ForestHealth repository on GitHub.
This reads the numbers the design is run from (config.yaml on the main branch) and writes
three small JSON files to Sandbox.Web/public/data/forest-plots/, which the page charts with a
measure's json key. It writes counts only. Plot coordinates are not published until the site
list is final, and this script never reads them.

When plots are installed and their measurements are published as a service, point the page at
the service and delete this script.

The margin of error is arithmetic on the plot counts, as in the design record
(docs/SAMPLE-DESIGN-2026-10-19.md): the 95 percent confidence interval half width for a
proportion of 0.5, the worst case, which is 1.96 * sqrt(0.25 / n). A model-assisted estimate
with relative efficiency e divides that by sqrt(e); the design plans on 1.5 to 2.0.

    python -I tools/extract-plot-network-design.py
"""
import datetime, io, json, math, os, re, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "Sandbox.Web", "public", "data", "forest-plots")
CONFIG = "https://raw.githubusercontent.com/trpa-agency/ForestHealth/main/plot-network-design/config.yaml"
RECORD = "https://github.com/trpa-agency/ForestHealth/blob/main/plot-network-design/docs/SAMPLE-DESIGN-2026-10-19.md"
DESIGN_DATE = "2026-10-19"

# The three forest types of the threshold report, in the order the page lists them.
TYPES = [("SMC", "Sierran mixed conifer"), ("JP", "Jeffrey pine"), ("RF", "Red fir")]
ESTIMATES = [("Plots alone", 1.0), ("Plots with the lidar model, lower efficiency", 1.5), ("Plots with the lidar model, higher efficiency", 2.0)]


def inline_map(text, key):
    """The {SMC: 40, JP: 40, RF: 40} written after key in the config, as a dict of numbers."""
    found = re.search(r"^\s*%s:\s*\{([^}]*)\}" % re.escape(key), text, re.M)
    if not found:
        raise SystemExit("config.yaml has no inline map for '%s'; the design config changed shape" % key)
    pairs = [part.split(":") for part in found.group(1).split(",")]
    return {name.strip(): float(value) for name, value in pairs}


def write(name, title, note, rows):
    body = {"title": title, "source": RECORD, "generated": DESIGN_DATE, "note": note, "rows": rows}
    path = os.path.join(OUT, name)
    io.open(path, "w", encoding="utf-8", newline="\n").write(json.dumps(body, indent=1) + "\n")
    print("wrote", os.path.relpath(path, os.path.join(HERE, "..")), len(rows), "rows")


def main():
    request = urllib.request.Request(CONFIG, headers={"User-Agent": "Mozilla/5.0"})
    text = urllib.request.urlopen(request, timeout=60).read().decode("utf-8")
    minimum, full, acres = inline_map(text, "min"), inline_map(text, "full"), inline_map(text, "population_acres")
    backups = re.search(r"^\s*backup_multiple:\s*(\d+)", text, re.M)
    if not backups:
        raise SystemExit("config.yaml has no backup_multiple")
    multiple = int(backups.group(1))
    os.makedirs(OUT, exist_ok=True)

    plots = []
    for code, label in TYPES:
        plots.append({"ForestType": label, "Level": "Minimum design", "Plots": int(minimum[code])})
        plots.append({"ForestType": label, "Level": "Added in the full design", "Plots": int(full[code] - minimum[code])})
    write("planned-plots.json", "Planned forest plots by forest type",
          "A design, not a count of installed plots. The full design adds plots to the minimum.", plots)

    write("frame-acres.json", "Conifer forest the plot network represents, by forest type",
          "The forest the stand density and seral stage standards report on, outside the urban area and designated wilderness.",
          [{"ForestType": label, "Acres": int(acres[code])} for code, label in TYPES])

    sizes = sorted({int(n) for n in list(minimum.values()) + list(full.values())})
    margins = []
    for n in sizes:
        for label, efficiency in ESTIMATES:
            margins.append({"Plots": n, "Estimate": label, "Points": round(196 * math.sqrt(0.25 / n) / math.sqrt(efficiency), 1)})
    write("margin-of-error.json", "Expected margin of error for one forest type",
          "95 percent confidence interval half width, in percentage points, for a share of 50 percent (the worst case).", margins)

    print("checks: minimum %d plots, full %d plots, backups ranked %d, forest %s acres"
          % (sum(minimum.values()), sum(full.values()), multiple * sum(full.values()), format(int(sum(acres.values())), ",")))
    print("generated date is the design date", DESIGN_DATE, "; run", datetime.date.today().isoformat())


if __name__ == "__main__":
    main()
