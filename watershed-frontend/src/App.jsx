import { useEffect, useState } from 'react'
import axios from 'axios'
import L from 'leaflet'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import '@geoman-io/leaflet-geoman-free'
import 'leaflet-draw/dist/leaflet.draw.css'
import {
  Compass,
  Satellite,
  Radio,
  Layers,
  Droplets,
  Leaf,
  Waves,
  Trees,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info,
  Database,
  Grid3X3,
  MousePointerClick,
  ArrowRight,
  TrendingUp,
  Download,
  FileSpreadsheet,
  FileJson,
  Sparkles,
  ShieldCheck,
  CheckCheck
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import './App.css'

// Fix default Leaflet marker icon asset paths in Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const API_URL = 'https://geospatialwatershed-final-production.up.railway.app/watershed-analysis';
const INITIAL_CENTER = [20.5937, 78.9629]

function GeomanControls({ onPolygonCreated }) {
  const map = useMap()

  useEffect(() => {
    map.pm.addControls({
      position: 'topleft',
      drawCircle: false,
      drawCircleMarker: false,
      drawMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawText: false,
      cutPolygon: false,
      rotateMode: false,
    })
    map.pm.setGlobalOptions({
      finishOn: 'dblclick',
      templineStyle: { color: '#f4b942', weight: 2 },
      hintlineStyle: { color: '#f4b942', dashArray: [5, 5] },
      pathOptions: { color: '#e05d3d', fillColor: '#e05d3d', fillOpacity: 0.16, weight: 2 },
    })

    const handleCreate = (event) => {
      if (event.shape !== 'Polygon') return
      event.layer.setStyle({ color: '#e05d3d', fillColor: '#e05d3d', fillOpacity: 0.16, weight: 2 })
      const geojsonGeometry = event.layer.toGeoJSON().geometry
      onPolygonCreated(geojsonGeometry)
    }

    map.on('pm:create', handleCreate)
    return () => {
      map.off('pm:create', handleCreate)
      map.pm.removeControls()
    }
  }, [map, onPolygonCreated])

  return null
}

function MetricCard({ label, subtitle, value, tone, icon: IconComponent }) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-card-top">
        <span className={`metric-icon-badge ${tone}`}>
          <IconComponent size={14} />
        </span>
        <div>
          <span className="metric-label">{label}</span>
          <span className="metric-sublabel">{subtitle}</span>
        </div>
      </div>
      <strong className="metric-value">{value == null ? '--' : Number(value).toFixed(3)}</strong>
    </div>
  )
}

function CustomChartTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-date">{label}</p>
        <div className="chart-tooltip-grid">
          {payload.map((entry) => (
            <div key={entry.name} className="chart-tooltip-item">
              <span className="chart-tooltip-dot" style={{ backgroundColor: entry.color }} />
              <span className="chart-tooltip-name">{entry.name}:</span>
              <strong>{typeof entry.value === 'number' ? entry.value.toFixed(3) : entry.value}</strong>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

function downloadCSV(analysis, currentGeometry) {
  if (!analysis) return
  const rows = [
    ['WATERSHED ANALYSIS REPORT'],
    ['Generated Date', new Date().toISOString()],
    ['Observation Window Start', analysis.date_range?.start || ''],
    ['Observation Window End', analysis.date_range?.end || ''],
    [],
    ['REMOTE SENSING SUMMARY INDICES'],
    ['Metric', 'Value', 'Interpretation'],
    ['Mean NDVI', analysis.mean_ndvi?.toFixed(4) || 'N/A', 'Normalized Difference Vegetation Index (Canopy vigor)'],
    ['Mean NDWI', analysis.mean_ndwi?.toFixed(4) || 'N/A', 'Normalized Difference Water Index (Moisture status)'],
    ['Mean MNDWI', analysis.mean_mndwi?.toFixed(4) || 'N/A', 'Modified NDWI (Open water & wetland sensitivity)'],
    ['Mean EVI', analysis.mean_evi?.toFixed(4) || 'N/A', 'Enhanced Vegetation Index (Dense canopy biomass)'],
    [],
    ['HISTORICAL MONTHLY TIME-SERIES'],
    ['Month', 'NDVI', 'NDWI', 'MNDWI', 'EVI'],
    ...(analysis.time_series || []).map((t) => [
      t.date,
      t.ndvi != null ? Number(t.ndvi).toFixed(4) : '',
      t.ndwi != null ? Number(t.ndwi).toFixed(4) : '',
      t.mndwi != null ? Number(t.mndwi).toFixed(4) : '',
      t.evi != null ? Number(t.evi).toFixed(4) : '',
    ]),
    [],
    ['AI-DRIVEN WATERSHED MANAGEMENT RECOMMENDATIONS'],
    ['Category', 'Priority', 'Intervention Title', 'Rationale', 'Actionable Steps'],
    ...(analysis.recommendations || []).map((r) => [
      r.category,
      r.priority,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${(r.rationale || '').replace(/"/g, '""')}"`,
      `"${(r.actions || []).join(' | ').replace(/"/g, '""')}"`,
    ]),
  ]

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n')
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `watershed_analysis_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function downloadGeoJSON(geometry) {
  if (!geometry) return
  const feature = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Watershed Analysis Boundary',
          analyzed_at: new Date().toISOString(),
          source: 'Copernicus Sentinel-2 SR',
        },
        geometry,
      },
    ],
  }
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(feature, null, 2))
  const link = document.createElement('a')
  link.setAttribute('href', dataStr)
  link.setAttribute('download', `watershed_boundary_${new Date().toISOString().slice(0, 10)}.geojson`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function App() {
  const [analysis, setAnalysis] = useState(null)
  const [geometry, setGeometry] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const handlePolygonCreated = async (geo) => {
    setGeometry(geo)
    setStatus('loading')
    setError('')
    try {
      const { data } = await axios.post(API_URL, geo, {
        headers: { 'Content-Type': 'application/json' },
      })
      setAnalysis(data)
      setStatus('success')
    } catch (requestError) {
      setStatus('error')
      setError(requestError.response?.data?.detail || 'Analysis could not be completed. Check the backend connection.')
    }
  }

  const recommendations = analysis?.recommendations || []
  const timeSeriesData = analysis?.time_series || []

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-label="Watershed Atlas Icon">
            <Compass size={20} strokeWidth={2.4} />
          </span>
          <div>
            <p className="eyebrow"><Satellite size={11} className="inline-icon" /> FIELD INTELLIGENCE / 02</p>
            <h1>Watershed Atlas Pro</h1>
          </div>
        </div>

        <div className="topbar-actions">
          {analysis && (
            <div className="export-btn-group">
              <button
                type="button"
                className="btn-export"
                onClick={() => downloadCSV(analysis, geometry)}
                title="Download Analysis Report as CSV"
              >
                <FileSpreadsheet size={13} className="inline-icon" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                className="btn-export"
                onClick={() => downloadGeoJSON(geometry)}
                title="Download Selected Boundary as GeoJSON"
              >
                <FileJson size={13} className="inline-icon" />
                <span>Export GeoJSON</span>
              </button>
            </div>
          )}

          <div className="connection-status">
            <Radio size={12} className="pulse-icon" />
            <span>Earth Engine Ready</span>
          </div>
        </div>
      </header>

      <section className="workspace">
        <div className="map-wrap">
          <MapContainer center={INITIAL_CENTER} zoom={5} scrollWheelZoom className="map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {analysis?.tile_url && <TileLayer url={analysis.tile_url} opacity={0.75} maxZoom={19} />}
            <GeomanControls onPolygonCreated={handlePolygonCreated} />
          </MapContainer>
          <div className="map-caption">
            <MousePointerClick size={14} className="inline-icon orange" />
            <span>Draw or edit a polygon boundary on the map to trigger automated spectral analysis</span>
          </div>
          <div className="map-legend">
            <div className="legend-title"><Layers size={12} className="inline-icon" /> Map Layers</div>
            <span><i className="legend-swatch base" /> Basemap</span>
            {analysis?.tile_url && <span><i className="legend-swatch ndvi" /> Sentinel-2 NDVI Composite</span>}
          </div>
        </div>

        <aside className="side-panel">
          <div className="panel-intro">
            <div className="badge-remote-sensing">
              <Satellite size={11} />
              <span>COPERNICUS SENTINEL-2 SR</span>
            </div>
            <h2>Watershed<br /><em>intelligence</em></h2>
            <p className="intro-copy">
              Multi-spectral remote sensing for watershed health, vegetative canopy vigor, moisture retention, and hydrological intervention planning.
            </p>
          </div>

          <div className="panel-divider" />
          <div className={`status-row ${status}`}>
            {status === 'loading' && <Loader2 size={13} className="spin icon-loading" />}
            {status === 'success' && <CheckCircle2 size={13} className="icon-success" />}
            {status === 'error' && <AlertCircle size={13} className="icon-error" />}
            {status === 'idle' && <Info size={13} className="icon-idle" />}
            <span>
              {status === 'loading'
                ? 'Processing multi-band satellite composites...'
                : status === 'success'
                  ? 'Multi-spectral watershed analysis complete'
                  : status === 'error'
                    ? 'Analysis unavailable'
                    : 'Awaiting boundary selection'}
            </span>
          </div>

          {status === 'loading' && (
            <div className="loading-block">
              <Loader2 size={18} className="spin loader-svg" />
              <div>
                <strong>Querying Earth Engine</strong>
                <p>Computing NDVI, NDWI, MNDWI, EVI and 6-month historical trends...</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="error-block">
              <AlertCircle size={18} className="flex-shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {/* SECTION 1: SIGNAL READINGS (4 INDICES) */}
          <section className="results-section">
            <div className="section-heading">
              <span>01</span>
              <h3>Multi-Spectral Indices</h3>
            </div>
            <div className="metrics-grid-4">
              <MetricCard
                label="NDVI"
                subtitle="Vegetation Vigor"
                value={analysis?.mean_ndvi}
                tone="green"
                icon={Leaf}
              />
              <MetricCard
                label="NDWI"
                subtitle="Surface Moisture"
                value={analysis?.mean_ndwi}
                tone="blue"
                icon={Droplets}
              />
              <MetricCard
                label="MNDWI"
                subtitle="Open Water & Wetland"
                value={analysis?.mean_mndwi}
                tone="cyan"
                icon={Waves}
              />
              <MetricCard
                label="EVI"
                subtitle="Dense Canopy Biomass"
                value={analysis?.mean_evi}
                tone="emerald"
                icon={Trees}
              />
            </div>
            {analysis?.date_range && (
              <p className="date-range">
                <Calendar size={12} className="inline-icon" />
                Observation Period: {analysis.date_range.start} to {analysis.date_range.end}
              </p>
            )}
          </section>

          {/* SECTION 2: TIME-SERIES CHART */}
          <section className="results-section">
            <div className="section-heading">
              <span>02</span>
              <h3>Historical Trend (6 Months)</h3>
            </div>
            {timeSeriesData.length > 0 ? (
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={175}>
                  <AreaChart data={timeSeriesData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorNdvi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#498a62" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#498a62" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorNdwi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3d86a1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3d86a1" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorMndwi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorEvi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d5d9d0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#71807b', fontSize: 9, fontFamily: 'DM Mono, monospace' }}
                      axisLine={{ stroke: '#d5d9d0' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#71807b', fontSize: 9, fontFamily: 'DM Mono, monospace' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[-0.6, 0.8]}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: '10px', paddingTop: '6px', fontFamily: 'DM Mono, monospace' }}
                      iconType="circle"
                      iconSize={7}
                    />
                    <Area
                      type="monotone"
                      dataKey="ndvi"
                      name="NDVI"
                      stroke="#498a62"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorNdvi)"
                    />
                    <Area
                      type="monotone"
                      dataKey="ndwi"
                      name="NDWI"
                      stroke="#3d86a1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorNdwi)"
                    />
                    <Area
                      type="monotone"
                      dataKey="mndwi"
                      name="MNDWI"
                      stroke="#0ea5e9"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#colorMndwi)"
                    />
                    <Area
                      type="monotone"
                      dataKey="evi"
                      name="EVI"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      fillOpacity={1}
                      fill="url(#colorEvi)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="empty-copy">
                <TrendingUp size={13} className="inline-icon" />
                Historical monthly trends will plot here after polygon analysis.
              </p>
            )}
          </section>

          {/* SECTION 3: AI-DRIVEN WATERSHED RECOMMENDATIONS */}
          <section className="results-section recommendations-section">
            <div className="section-heading">
              <span>03</span>
              <h3>AI-Driven Watershed Interventions</h3>
            </div>
            {recommendations.length ? (
              <div className="recommendations-list">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="rec-card">
                    <div className="rec-card-header">
                      <span className={`badge-category ${rec.category.toLowerCase().replace(/\s+/g, '-')}`}>
                        {rec.category}
                      </span>
                      <span className={`badge-priority ${rec.priority.toLowerCase()}`}>
                        {rec.priority} Priority
                      </span>
                    </div>
                    <h4 className="rec-title">{rec.title}</h4>
                    <p className="rec-rationale">{rec.rationale}</p>
                    <ul className="rec-actions">
                      {rec.actions.map((act, i) => (
                        <li key={i}>
                          <CheckCheck size={12} className="rec-action-icon" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-copy">
                <Sparkles size={13} className="inline-icon" />
                Actionable engineering recommendations (check dams, bunding, recharge) will appear after analysis.
              </p>
            )}
          </section>

          <footer className="panel-footer">
            <div className="footer-item">
              <Database size={11} className="inline-icon" />
              <span>DATA SOURCE</span>
              <strong>Copernicus Sentinel-2 SR</strong>
            </div>
            <div className="footer-item">
              <Grid3X3 size={11} className="inline-icon" />
              <span>SPATIAL RESOLUTION</span>
              <strong>10 m / 30 m</strong>
            </div>
          </footer>
        </aside>
      </section>
    </main>
  )
}

export default App