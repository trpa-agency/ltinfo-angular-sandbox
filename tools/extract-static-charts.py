"""Writes static chart data as JSON for the program pages: the 2023 Threshold Evaluation charts
and the Tahoe Open Data demographics figures.

The Threshold Dashboard's charts are static: Plotly pages on GitHub Pages
(trpa-agency.github.io/ThresholdEvaluation/2023/...) with their numbers embedded, or plain images
on LT Info. This reads the numbers out of the Plotly pages, adds the few charts that exist only as
images (values read from the image, marked approximate except where the points sit on gridlines),
and writes one JSON file per chart to Sandbox.Web/public/data/threshold-evaluation/. Program
pages chart them with a measure's json key.

The demographics figures are the Plotly pages behind https://www.tahoeopendata.org/pages/demographics
(trpa-agency.github.io/Demographics/Open_Data_Figures/), written to
Sandbox.Web/public/data/demographics/. Their underlying table, Demographic Summaries
(maps.trpa.org Demographics/MapServer/18), is charted live where its rows are labeled plainly.

    python -I tools/extract-static-charts.py
"""
import io, json, os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "Sandbox.Web", "public", "data")
OUT = os.path.join(DATA, "threshold-evaluation")
DEMOGRAPHICS = os.path.join(DATA, "demographics")
CLIMATE = os.path.join(DATA, "climate")
CRD = "https://trpa-agency.github.io/ClimateResilienceDashboard/html/"
FIGURES = "https://trpa-agency.github.io/Demographics/Open_Data_Figures/"
TE = "https://trpa-agency.github.io/ThresholdEvaluation/2023/"
LTINFO = "https://thresholds.laketahoeinfo.org/ThresholdIndicator/Detail/"


def page(url):
    req = urllib.request.Request(url, headers={"user-agent": "ltinfo-angular-sandbox"})
    return urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace")


def traces(url):
    """The data traces of a Plotly page written by Python. The page inlines the Plotly bundle,
    which has its own Plotly.newPlot text, so the call that draws the chart is the last one."""
    html = page(url)
    i = html.rfind("Plotly.newPlot(")
    s = html[html.index(",", i) + 1:].lstrip()
    data, _ = json.JSONDecoder().raw_decode(s)
    return data


def write(name, title, source, rows, note=None, folder=None):
    body = {"title": title, "source": source, **({"note": note} if note else {}), "rows": rows}
    path = os.path.join(folder or OUT, f"{name}.json")
    io.open(path, "w", encoding="utf-8", newline="\n").write(json.dumps(body, indent=1, ensure_ascii=False) + "\n")
    print(f"  {name}.json: {len(rows)} rows")


def r(v, n=2):
    return None if v is None else round(v, n)


def subpopulations(name, file, title):
    url = TE + "Vegetation/Chart/Final/" + file
    bars, threshold = traces(url)[:2]
    rows = [{"Year": x, "Subpopulations": y, "Threshold": t} for x, y, t in zip(bars["x"], bars["y"], threshold["y"])]
    write(name, title, url, rows)


def bar_classes(file):
    """One bar trace per class (x is a one-item list): the class name and its value."""
    return [(t["x"][0], t["y"][0]) for t in traces(TE + file)]


def main():
    os.makedirs(OUT, exist_ok=True)

    subpopulations("tahoe-draba-subpopulations", "Vegetation_TahoeDraba.html", "Tahoe draba subpopulations")
    subpopulations("long-petaled-lewisia-subpopulations", "Vegetation_Lewisia.html", "Long-petaled lewisia subpopulations")
    subpopulations("cup-lake-draba-subpopulations", "Vegetation_CupDraba.html", "Cup Lake draba subpopulations")

    zones = [("All forest", "Vegetation_SeralStage.html"), ("Montane", "Vegetation_Seral_Montane.html"),
             ("Upper montane", "Vegetation_Seral_UpperMontane.html"), ("Subalpine", "Vegetation_Seral_Subalpine.html")]
    rows = [{"Zone": zone, "Seral stage": stage, "Percent": r(value)}
            for zone, file in zones for stage, value in bar_classes("Vegetation/Chart/Final/" + file)]
    write("seral-stage-by-zone", "Seral stage by elevation zone, percent of undisturbed vegetation",
          TE + "Vegetation/Chart/Final/Vegetation_SeralStage.html", rows)

    rows = []
    for cls, value in bar_classes("Vegetation/Chart/Final/Vegetation_Composition.html"):
        parts = cls.rsplit(" ", 1)
        stage, canopy = (cls, None) if cls == "N/A" else (parts[0], parts[1])
        rows.append({"Class": cls, "Seral stage": "Not classified" if cls == "N/A" else stage, "Canopy": canopy, "Percent": r(value)})
    write("stand-composition", "Seral stage by canopy class, percent of undisturbed vegetation",
          TE + "Vegetation/Chart/Final/Vegetation_Composition.html", rows)

    url = TE + "Vegetation/Chart/Final/ForestFuelTreatment.html"
    rows = sorted(({"Year": int(x), "Zone": t["name"], "Acres": r(y, 1)} for t in traces(url) for x, y in zip(t["x"], t["y"])),
                  key=lambda row: (row["Year"], row["Zone"]))
    write("forest-fuel-treatment", "Forest fuel treatment acres by zone", url, rows)

    url = TE + "SoilConservation/Chart/Final/SoilConservation_1A.html"
    allowed, coverage = traces(url)[:2]
    rows = [{"District": d, "Coverage 2023": r(c, 1), "Allowed": r(a, 1)}
            for d, a, c in zip(allowed["x"], allowed["y"], coverage["y"]) if d]
    write("land-coverage-by-district", "Impervious coverage and coverage allowed by land capability district, 2023", url, rows)

    # Charts published only as images on LT Info.
    write("freel-peak-species-richness", "Species richness on the Freel Peak summits (GLORIA plots)", LTINFO + "97",
          [{"Summit": s, "Year": y, "Species": n} for s, values in
           (("Freel East Summit", (26, 26, 28)), ("Freel Peak", (26, 29, 29)), ("Freel Southwest", (23, 20, 19)))
           for y, n in zip((2006, 2011, 2022), values)],
          note="Read from the published chart image; the points sit on whole-number gridlines.")

    depths = ["11-20", "21-30", "31-40", "41-50", "51-60", "61-70", "71-80", "81-90", "91-100", "101-110", "121-130", "131-140", "151-160", "251-300"]
    early = [3, 17, 25, 33, 100, 42, 78, 72, 80, 63, 6, 4, 50, 20]
    late = [5, 10, 0, 5, 5, 8, 13, 20, 0, 0, 0, 0, 0, 0]
    write("deep-water-plants", "Macrophyte occurrence in deepwater samples by depth (percent)", LTINFO + "94",
          [{"Depth (m)": d, "Period": p, "Percent": v} for d, a, b in zip(depths, early, late) for p, v in (("1962-1963", a), ("2008-2009", b))],
          note="Approximate: read from the published chart image.")

    classes = ["Meesia, 5 to 50 percent", "Meesia, 50 to 100 percent", "Sphagnum, 5 to 50 percent", "Sphagnum, 50 to 100 percent"]
    by_year = {2004: [13.5, 2.7, 9.6, 0.0], 2009: [5.8, 0.0, 20.9, 0.6], 2010: [12.3, 0.2, 16.5, 1.3]}
    write("grass-lake-fen-cover", "Grass Lake moss cover classes (hectares)", LTINFO + "95",
          [{"Cover class": c, "Year": str(y), "Hectares": v} for y, values in by_year.items() for c, v in zip(classes, values)],
          note="Approximate: read from the published chart image (USFS sphagnum fen monitoring).")

    write("aircraft-noise-exceedances", "Single noise event exceedances at Lake Tahoe Airport", LTINFO + "100",
          [{"Year": y, "Exceedances": n} for y, n in zip(range(2008, 2015), (1540, 1110, 1875, 1460, 1480, 1700, 1035))],
          note="Approximate: read from the published chart image (City of South Lake Tahoe airport noise monitoring).")

    # Load reductions credited to TMDL implementors through the Lake Clarity Crediting Program.
    for name, file, title in (("phosphorus-load-reduction", "Phosphorous_Load_Reduction.html", "Phosphorus load reduction achieved"),
                              ("nitrogen-load-reduction", "Nitrogen_Load_Reduction.html", "Nitrogen load reduction achieved"),
                              ("fine-sediment-load-reduction", "Fine_Sediment_Load_Reduction.html", "Fine sediment load reduction achieved")):
        url = TE + "WaterQuality/Chart/Final/" + file
        bars = traces(url)[0]
        write(name, title + " (pounds per year)", url, [{"Year": int(x), "Pounds per year": round(y)} for x, y in zip(bars["x"], bars["y"])])

    # Aquatic invasive species standards.
    url = TE + "WaterQuality/Chart/Final/AIS_Infestation.html"
    rows = [{"Year": int(x), "Status": t["name"], "Percent": r(y)} for t in traces(url) for x, y in zip(t["x"], t["y"])]
    write("ais-site-status", "Aquatic invasive plant sites by management status, percent", url, rows)
    url = TE + "WaterQuality/Chart/Final/Tahoe_Keys_Infestation.html"
    rows = [{"Year": int(x), "Species": t["name"], "Cubic yards": round(y)} for t in traces(url) for x, y in zip(t["x"], t["y"])]
    write("tahoe-keys-aquatic-plants", "Aquatic invasive plant volume in the Tahoe Keys lagoons, cubic yards", url, rows)


def demographics():
    """The Open Data demographics figures. The age profile has four unlabeled panels in census order
    (1990, 2000, 2010, 2020; the page's text dates the peaks), each a share of men and of women."""
    os.makedirs(DEMOGRAPHICS, exist_ok=True)
    put = lambda name, title, file, rows, note=None: write(name, title, FIGURES + file, rows, note, DEMOGRAPHICS)

    for name, file, area in (("age-profile", "Demographics_Tahoe_AgeProfile.html", "the Tahoe Basin"),
                             ("age-profile-counties", "Demographics_County_AgeProfile.html", "the five surrounding counties")):
        data = traces(FIGURES + file)
        rows = []
        for year, (men, women) in zip((1990, 2000, 2010, 2020), zip(data[0::2], data[1::2])):
            for sex, trace in (("Men", men), ("Women", women)):
                rows += [{"Age": age, "Year": str(year), "Sex": sex, "Percent": r(abs(v) * 100)} for age, v in zip(trace["y"], trace["x"])]
        put(name, f"Age profile of {area} by census year, percent of men and of women", file, rows,
            "Panels in census order, 1990 to 2020.")

    rows = [{"Year": str(int(x)), "Area": t["name"], "Percent": r(y * 100)}
            for t in traces(FIGURES + "Demographics_Tahoe_Senior_Population.html") for x, y in zip(t["x"], t["y"])]
    put("population-over-65", "Share of the population 65 and older", "Demographics_Tahoe_Senior_Population.html", rows)

    rows = [{"Year": x, "Group": t["name"], "Percent": r(y)} for t in traces(FIGURES + "Demographics_Tahoe_RaceDistribution.html") for x, y in zip(t["x"], t["y"])]
    put("race-and-ethnicity", "Race and Hispanic origin in the Tahoe Basin, percent", "Demographics_Tahoe_RaceDistribution.html", rows)

    rows = [{"Year": x, "Occupancy": t["name"], "Percent": r(y)} for t in traces(FIGURES + "Demographics_Tahoe_HousingUnits.html") for x, y in zip(t["x"], t["y"])]
    put("housing-occupancy", "Housing units by occupancy, percent", "Demographics_Tahoe_HousingUnits.html", rows)

    rows = [{"Year": x, "Area": t["name"], "Income": round(y)} for t in traces(FIGURES + "Demographics_Tahoe_County_Median_Income_Line.html") for x, y in zip(t["x"], t["y"])]
    put("median-income-by-county", "Median household income within the Basin by county, 2021 dollars", "Demographics_Tahoe_County_Median_Income_Line.html", rows)


def climate():
    """The Climate Resilience Dashboard charts whose numbers no map service table publishes: lake
    level, mid-lake surface temperature, the PurpleAir air quality index, and snow and rain shares."""
    os.makedirs(CLIMATE, exist_ok=True)
    put = lambda name, title, file, rows, note=None: write(name, title, CRD + file, rows, note, CLIMATE)
    day = lambda x: str(x)[:10]

    level, high, rim = traces(CRD + "1.3.a_Lake_Level.html")[:3]
    rows = [{"Date": day(x), "Water level": r(y), "Legal high water": h, "Natural rim": n}
            for x, y, h, n in zip(level["x"], level["y"], high["y"], rim["y"]) if y is not None]
    put("lake-level", "Lake Tahoe water level, weekly mean, feet above sea level", "1.3.a_Lake_Level.html", rows)

    temp = traces(CRD + "1.3.b_Lake_Temp.html")[0]
    rows = [{"Date": day(x), "Temperature": r(y, 1)} for x, y in zip(temp["x"], temp["y"]) if y is not None]
    put("lake-temperature", "Lake Tahoe mid-lake surface temperature, daily, degrees Fahrenheit", "1.3.b_Lake_Temp.html", rows)

    aqi = traces(CRD + "1.2.a_Purple_Air_v2.html")[0]
    rows = [{"Date": day(x), "Air quality index": r(y, 1)} for x, y in zip(aqi["x"], aqi["y"]) if y is not None]
    put("air-quality-index", "Daily air quality index from PurpleAir sensors in the Basin", "1.2.a_Purple_Air_v2.html", rows)

    rows = [{"Year": int(x), "Form": t["name"].replace("% ", ""), "Percent": r(y, 1)}
            for t in traces(CRD + "1.3.d_Precip.html") for x, y in zip(t["x"], t["y"])]
    put("snow-and-rain", "Share of precipitation falling as snow and as rain, percent", "1.3.d_Precip.html", rows)


if __name__ == "__main__":
    main()
    demographics()
    climate()
