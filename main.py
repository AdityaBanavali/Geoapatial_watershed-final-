"""FastAPI service for Sentinel-2 watershed analysis with Google Earth Engine."""

from __future__ import annotations

import json
import logging
import math
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

try:
    import ee
except ImportError:  # Keep module importable for health checks and local tooling.
    ee = None  # type: ignore[assignment]


load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

# CORS is handled by FastAPI before the POST reaches the analysis endpoint.
ALLOWED_ORIGINS = [
    "https://geospatial-watershed-owvzvo5gw-aditya-banavalis-projects.vercel.app",
    "http://localhost:5173",
    "http://localhost:4173",
]

app = FastAPI(title="Watershed Analysis API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\\.vercel\\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

_ee_initialized = False


def _credentials_from_environment() -> Any:
    """Build Earth Engine credentials from supported .env settings."""
    if ee is None:
        raise RuntimeError("The earthengine-api package is not installed")

    service_account = os.getenv("EE_SERVICE_ACCOUNT")
    private_key = os.getenv("EE_PRIVATE_KEY")
    key_file = os.getenv("EE_SERVICE_ACCOUNT_KEY") or os.getenv(
        "GOOGLE_APPLICATION_CREDENTIALS"
    )

    if service_account and private_key:
        return ee.ServiceAccountCredentials(
            service_account,
            key_data=private_key.replace("\\n", "\n"),
        )

    if key_file:
        with open(key_file, encoding="utf-8") as credentials_file:
            key_data = json.load(credentials_file)
        account = service_account or key_data.get("client_email")
        if not account or not key_data.get("private_key"):
            raise RuntimeError("Service-account key must contain client_email and private_key")
        return ee.ServiceAccountCredentials(account, key_data=key_data["private_key"])

    return None


def initialize_earth_engine() -> None:
    """Initialize Earth Engine once, using ADC/project, user OAuth, or service-account credentials."""
    global _ee_initialized
    if _ee_initialized:
        return
    if ee is None:
        raise RuntimeError("Install earthengine-api before starting the backend")

    load_dotenv(override=True)
    project_id = os.getenv("EE_PROJECT_ID")
    credentials = _credentials_from_environment()

    try:
        if credentials is not None:
            ee.Initialize(credentials=credentials, project=project_id)
        elif project_id:
            ee.Initialize(project=project_id)
        else:
            ee.Initialize()
        _ee_initialized = True
        logger.info("Google Earth Engine initialized%s", f" for project {project_id}" if project_id else "")
    except Exception as e:
        logger.exception("Earth Engine initialization failed")
        raise RuntimeError(
            f"Google Earth Engine initialization failed ({e}). "
            "Please configure your Google Cloud Project ID in .env (e.g. EE_PROJECT_ID=your-project-id) "
            "or set up Service Account credentials."
        ) from e


@app.get("/")
def read_root():
    return {"status": "Watershed API is running"}


def _polygon_geometry(payload: dict[str, Any]) -> dict[str, Any]:
    """Accept a GeoJSON Polygon or Feature containing one."""
    geojson = payload.get("geometry") if payload.get("type") == "Feature" else payload
    if not isinstance(geojson, dict) or geojson.get("type") != "Polygon":
        raise HTTPException(status_code=422, detail="Expected a GeoJSON Polygon or Polygon Feature")

    coordinates = geojson.get("coordinates")
    if not isinstance(coordinates, list) or not coordinates:
        raise HTTPException(status_code=422, detail="Polygon coordinates are required")
    for ring in coordinates:
        if not isinstance(ring, list) or len(ring) < 4 or ring[0] != ring[-1]:
            raise HTTPException(status_code=422, detail="Each polygon ring must be closed and have at least 4 points")
        for point in ring:
            if (
                not isinstance(point, list)
                or len(point) < 2
                or not all(isinstance(value, (int, float)) and math.isfinite(value) for value in point[:2])
                or not -180 <= point[0] <= 180
                or not -90 <= point[1] <= 90
            ):
                raise HTTPException(status_code=422, detail="Polygon coordinates must be valid longitude/latitude pairs")
    return geojson


def _generate_ai_recommendations(
    mean_ndvi: float,
    mean_ndwi: float,
    mean_mndwi: float,
    mean_evi: float,
    time_series: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Generate dynamic, context-aware watershed management recommendations based on multi-index remote sensing."""
    recommendations: list[dict[str, Any]] = []

    # 1. Water Harvesting & Drainage Management
    if mean_ndwi < -0.2 and mean_mndwi < -0.2:
        recommendations.append({
            "id": "rec-check-dams",
            "category": "Water Harvesting",
            "priority": "High",
            "title": "Construct Earthen Check Dams & Gully Plugs",
            "rationale": f"Mean NDWI ({mean_ndwi:.3f}) and MNDWI ({mean_mndwi:.3f}) indicate severe surface water deficit and high unarrested runoff during rainfall events.",
            "actions": [
                "Construct loose boulder and masonry check dams along second-order drainage lines (slope 2-5%) to retard peak runoff velocity.",
                "Build percolation tanks at the base of the sub-catchment to augment shallow aquifer recharge.",
                "Install vegetative silt traps upstream of water bodies to minimize reservoir sedimentation.",
            ],
        })
    elif mean_ndwi < 0.0:
        recommendations.append({
            "id": "rec-farm-ponds",
            "category": "Water Harvesting",
            "priority": "Medium",
            "title": "Establish Farm Ponds & Recharge Shafts",
            "rationale": f"Moderate water index (NDWI: {mean_ndwi:.3f}, MNDWI: {mean_mndwi:.3f}) suggests seasonal moisture stress during non-monsoon dry spells.",
            "actions": [
                "Excavate polythene-lined farm ponds (15m x 15m x 3m) in mid-slope zones for emergency protective irrigation.",
                "Connect rooftop and agricultural surface runoff to groundwater recharge pits equipped with sand-gravel filters.",
            ],
        })
    else:
        recommendations.append({
            "id": "rec-wetland-protection",
            "category": "Water Harvesting",
            "priority": "Routine",
            "title": "Drainage Channel Desiltation & Wetland Buffer Protection",
            "rationale": f"Positive water indicators (NDWI: {mean_ndwi:.3f}, MNDWI: {mean_mndwi:.3f}) show active surface water presence and stable moisture regime.",
            "actions": [
                "Desilt primary drainage canals prior to the monsoon season to prevent localized waterlogging.",
                "Delineate and protect a 30m ecological buffer around existing water bodies from agricultural encroachment.",
            ],
        })

    # 2. Soil Conservation & Slope Stabilization
    if mean_ndvi < 0.3 or mean_evi < 0.2:
        recommendations.append({
            "id": "rec-contour-bunding",
            "category": "Soil Conservation",
            "priority": "High",
            "title": "Continuous Contour Trenching (CCT) & Bunding",
            "rationale": f"Low vegetation vigor (NDVI: {mean_ndvi:.3f}, EVI: {mean_evi:.3f}) increases topsoil erosion and nutrient runoff vulnerability.",
            "actions": [
                "Implement continuous contour trenches (0.5m x 0.5m) on slopes greater than 5% to intercept sheet wash.",
                "Plant Vetiver (Khus) grass hedgerows along contour lines to stabilize embankments and retain soil moisture.",
                "Apply organic mulching and residue retention on crop fields to reduce soil evaporation losses.",
            ],
        })
    else:
        recommendations.append({
            "id": "rec-terrace-maintenance",
            "category": "Soil Conservation",
            "priority": "Medium",
            "title": "Maintain Soil Cover & Contour Bund Integrity",
            "rationale": f"Healthy vegetation signals (NDVI: {mean_ndvi:.3f}) provide reasonable soil shielding; ongoing slope conservation will sustain soil fertility.",
            "actions": [
                "Perform annual pre-monsoon maintenance on earthen bunds and stone-pitched waste weirs.",
                "Introduce leguminous cover crops (such as Cowpea or Sunnhemp) in crop rotations to enhance soil organic carbon.",
            ],
        })

    # 3. Vegetation Restoration & Agroforestry
    if mean_ndvi < 0.25:
        recommendations.append({
            "id": "rec-afforestation",
            "category": "Vegetation Restoration",
            "priority": "High",
            "title": "Ridge-to-Valley Afforestation & Silvopasture Development",
            "rationale": "Degraded canopy coverage requires accelerated native biomass establishment across degraded ridges.",
            "actions": [
                "Plant drought-tolerant native tree species (Acacia nilotica, Azadirachta indica, Pongamia pinnata) on upper ridge lines.",
                "Establish rotational silvopastoral grazing zones with perennial grasses (Cenchrus ciliaris, Stylosanthes hamata).",
                "Construct brushwood check dams in nascent rills to foster pioneer micro-habitats.",
            ],
        })
    else:
        recommendations.append({
            "id": "rec-agroforestry",
            "category": "Vegetation Restoration",
            "priority": "Routine",
            "title": "Multi-Tier Agroforestry & Riparian Buffer Strips",
            "rationale": "Sustained canopy health enables transition to high-value agroforestry and biodiversity corridor enrichment.",
            "actions": [
                "Integrate horticultural trees (Horti-Silvi systems) like Guava, Pomegranate, and Moringa along field boundaries.",
                "Create a multi-species riparian tree corridor along stream margins to minimize bank scouring.",
            ],
        })

    # 4. Seasonal Trend Analysis (if trend exists)
    if len(time_series) >= 2:
        valid_ts = [pt for pt in time_series if pt.get("ndvi") is not None and pt.get("ndvi") > 0]
        if len(valid_ts) >= 2:
            first_val = valid_ts[0]["ndvi"]
            last_val = valid_ts[-1]["ndvi"]
            diff = last_val - first_val
            if diff < -0.05:
                recommendations.append({
                    "id": "rec-trend-stress",
                    "category": "Trend Alert",
                    "priority": "High",
                    "title": "Address Observed Downward Trend in Vegetation Vigor",
                    "rationale": f"Time-series monitoring shows a declining NDVI trajectory ({first_val:.3f} to {last_val:.3f}) over recent months.",
                    "actions": [
                        "Investigate localized soil salinity or pest infestations across vulnerable field plots.",
                        "Deploy supplemental micro-drip irrigation systems to mitigate peak seasonal dryness.",
                    ],
                })

    return recommendations


def _analyze_polygon(geojson: dict[str, Any]) -> dict[str, Any]:
    initialize_earth_engine()
    region = ee.Geometry(geojson)
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=90)

    # 1. Compute Primary 90-day Composite Indices
    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate(start_date.isoformat(), end_date.isoformat())
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", 25))
    )
    image = collection.median().clip(region)
    ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
    ndwi = image.normalizedDifference(["B3", "B8"]).rename("NDWI")
    mndwi = image.normalizedDifference(["B3", "B11"]).rename("MNDWI")
    evi = image.expression(
        "2.5 * ((b('B8') - b('B4')) / (b('B8') + 6.0 * b('B4') - 7.5 * b('B2') + 10000.0))"
    ).rename("EVI")

    combined = ndvi.addBands([ndwi, mndwi, evi])
    metrics = combined.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=region,
        scale=30,
        bestEffort=True,
        maxPixels=100_000_000,
    ).getInfo()

    if not metrics or metrics.get("NDVI") is None or metrics.get("NDWI") is None:
        raise HTTPException(status_code=404, detail="No suitable Sentinel-2 imagery found for this polygon")

    mean_ndvi = float(metrics.get("NDVI") or 0.0)
    mean_ndwi = float(metrics.get("NDWI") or 0.0)
    mean_mndwi = float(metrics.get("MNDWI") or 0.0)
    mean_evi = float(metrics.get("EVI") or 0.0)

    # 2. Compute 6-Month Monthly Historical Time Series
    base_coll = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", 40))
    )
    dummy_img = ee.Image.constant([0, 0, 0, 0, 0]).rename(["B2", "B3", "B4", "B8", "B11"]).toFloat()

    ts_features = []
    for i in range(5, -1, -1):
        t_end = end_date - timedelta(days=i * 30)
        t_start = t_end - timedelta(days=30)
        month_label = t_start.strftime("%b %Y")

        m_coll = ee.ImageCollection([dummy_img]).merge(
            base_coll.filterDate(t_start.isoformat(), t_end.isoformat()).select(["B2", "B3", "B4", "B8", "B11"])
        )
        m_img = m_coll.median()
        m_ndvi = m_img.normalizedDifference(["B8", "B4"]).rename("NDVI")
        m_ndwi = m_img.normalizedDifference(["B3", "B8"]).rename("NDWI")
        m_mndwi = m_img.normalizedDifference(["B3", "B11"]).rename("MNDWI")
        m_evi = m_img.expression(
            "2.5 * ((b('B8') - b('B4')) / (b('B8') + 6.0 * b('B4') - 7.5 * b('B2') + 10000.0))"
        ).rename("EVI")

        m_stats = m_ndvi.addBands([m_ndwi, m_mndwi, m_evi]).reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=region,
            scale=100,
            bestEffort=True,
            maxPixels=5_000_000,
        )
        ts_features.append(ee.Feature(None, m_stats).set("date", month_label))

    fc = ee.FeatureCollection(ts_features)
    ts_info = fc.getInfo()

    time_series: list[dict[str, Any]] = []
    for feat in ts_info.get("features", []):
        props = feat.get("properties", {})
        val_ndvi = props.get("NDVI")
        val_ndwi = props.get("NDWI")
        val_mndwi = props.get("MNDWI")
        val_evi = props.get("EVI")

        # Keep valid data points
        if val_ndvi is not None and abs(val_ndvi) > 1e-4:
            time_series.append({
                "date": props.get("date"),
                "ndvi": round(float(val_ndvi), 3),
                "ndwi": round(float(val_ndwi), 3) if val_ndwi is not None else None,
                "mndwi": round(float(val_mndwi), 3) if val_mndwi is not None else None,
                "evi": round(float(val_evi), 3) if val_evi is not None else None,
            })
        else:
            time_series.append({
                "date": props.get("date"),
                "ndvi": round(mean_ndvi, 3),
                "ndwi": round(mean_ndwi, 3),
                "mndwi": round(mean_mndwi, 3),
                "evi": round(mean_evi, 3),
            })

    # 3. Generate AI Watershed Recommendations
    recommendations = _generate_ai_recommendations(
        mean_ndvi, mean_ndwi, mean_mndwi, mean_evi, time_series
    )

    # 4. Generate NDVI Tile URL for Leaflet overlay
    try:
        map_id = ndvi.getMapId({
            "min": -0.2,
            "max": 0.8,
            "palette": ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
        })
        tile_url = map_id.get("url") or map_id.get("tile_fetcher", {}).get("url_format")
    except Exception:
        tile_url = None

    return {
        "mean_ndvi": mean_ndvi,
        "mean_ndwi": mean_ndwi,
        "mean_mndwi": mean_mndwi,
        "mean_evi": mean_evi,
        "time_series": time_series,
        "recommendations": recommendations,
        "tile_url": tile_url,
        "date_range": {
            "start": start_date.date().isoformat(),
            "end": end_date.date().isoformat(),
        },
    }


@app.post("/api/watershed-analysis")
@app.post("/api/watershed-analysis/")
def watershed_analysis(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    try:
        geojson = _polygon_geometry(payload)
        return _analyze_polygon(geojson)
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception("Critical backend error during watershed analysis")
        raise HTTPException(status_code=500, detail=str(e))