import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useOperational } from '../../context/OperationalContext';
import { Flight } from '../../types';
import {
  Layers,
  MapPin,
  Plane,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const y = Math.sin((lon2 - lon1) * toRad) * Math.cos(lat2 * toRad);
  const x =
    Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
    Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos((lon2 - lon1) * toRad);
  return ((Math.atan2(y, x) * toDeg) + 360) % 360;
}

function interpolatePosition(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  progress: number
): [number, number] {
  const t = Math.max(0, Math.min(1, progress));
  // Quadratic curve towards east/north for realistic airway arc
  const midLat = (lat1 + lat2) / 2 + (lon2 - lon1) * 0.05;
  const midLng = (lon1 + lon2) / 2 - (lat2 - lat1) * 0.05;
  const curLat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * midLat + t * t * lat2;
  const curLng = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * midLng + t * t * lon2;
  return [curLat, curLng];
}

interface FlightRadarProps {
  isFullView?: boolean;
}

export const FlightRadar: React.FC<FlightRadarProps> = ({ isFullView = false }) => {
  const {
    simState,
    airports,
    selectedFlightId,
    selectedAirportId,
    selectFlight,
    selectAirport,
    closures,
  } = useOperational();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    routesGroup: L.LayerGroup;
    airportsGroup: L.LayerGroup;
    aircraftGroup: L.LayerGroup;
    closureGroup: L.LayerGroup;
  } | null>(null);

  // Radar display toggles
  const [showAirportLabels, setShowAirportLabels] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [showDisruptionOverlay, setShowDisruptionOverlay] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ON_TIME' | 'DELAYED' | 'SEVERELY_DELAYED' | 'RECOVERED'>('ALL');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center of India: Lat 21.0, Lng 78.5
    const map = L.map(mapContainerRef.current, {
      center: [21.5, 79.5],
      zoom: 5,
      minZoom: 4,
      maxZoom: 9,
      zoomControl: false,
      attributionControl: false,
    });

    // Dark high-contrast basemap (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false, debounceMoveend: true });
    });
    resizeObserver.observe(mapContainerRef.current);

    const routesGroup = L.layerGroup().addTo(map);
    const closureGroup = L.layerGroup().addTo(map);
    const airportsGroup = L.layerGroup().addTo(map);
    const aircraftGroup = L.layerGroup().addTo(map);

    layersRef.current = { routesGroup, airportsGroup, aircraftGroup, closureGroup };
    mapInstanceRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Keep the selected operation in view when a flight or airport is chosen elsewhere.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedFlightId) {
      const flight = simState.flights[selectedFlightId];
      const origin = flight ? airports[flight.origin] : undefined;
      const destination = flight ? airports[flight.destination] : undefined;
      if (origin && destination) {
        map.fitBounds(
          [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          ],
          { padding: [72, 72], maxZoom: 6, animate: true }
        );
      }
      return;
    }

    if (selectedAirportId) {
      const airport = airports[selectedAirportId];
      if (airport) {
        map.flyTo([airport.lat, airport.lng], 7, { duration: 0.6 });
      }
    }
  }, [airports, selectedAirportId, selectedFlightId]);

  // Update Airport Markers & Closure Overlays
  useEffect(() => {
    if (!layersRef.current || !mapInstanceRef.current) return;
    const { airportsGroup, closureGroup } = layersRef.current;
    airportsGroup.clearLayers();
    closureGroup.clearLayers();

    const closureAirportIds = new Set(closures.map((c) => c.airport_id));

    Object.values(airports).forEach((apt) => {
      const isClosed = closureAirportIds.has(apt.id);
      const isSelected = selectedAirportId === apt.id;

      // Count delayed departures originating at this airport
      const depFlights = Object.values(simState.flights).filter((f) => f.origin === apt.id);
      const delayedDepCount = depFlights.filter((f) => f.dep_delay > 15).length;

      // 1. If closed, draw pulsing closure zone radius
      if (isClosed && showDisruptionOverlay) {
        const closureRadius = L.circle([apt.lat, apt.lng], {
          radius: 95000,
          color: '#ef4444',
          weight: 2,
          fillColor: '#dc2626',
          fillOpacity: 0.18,
          dashArray: '6, 6',
        });
        closureGroup.addLayer(closureRadius);
      }

      // 2. Airport Custom DivIcon
      const tierColor =
        apt.tier === 'mega_hub' ? '#00f0ff' : apt.tier === 'regional_hub' ? '#38bdf8' : '#94a3b8';
      const markerColor = isClosed ? '#ef4444' : isSelected ? '#00f0ff' : tierColor;
      const statusBorder = isClosed
        ? 'animate-pulse'
        : isSelected
        ? 'ring-2 ring-occ-cyan'
        : '';

      const iconHtml = `
        <div class="relative flex flex-col items-center cursor-pointer group select-none">
          ${
            isClosed
              ? `<div class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></div>`
              : ''
          }
          <div class="w-8 h-8 rounded-lg bg-navy-900/95 border-2 ${statusBorder} flex items-center justify-center transition-transform hover:scale-110"
            style="border-color:${markerColor};box-shadow:0 0 12px ${markerColor}55;">
            <span class="text-[10px] font-mono font-extrabold ${isClosed ? 'text-occ-red' : isSelected ? 'text-occ-cyan' : 'text-white'}">
              ${apt.id}
            </span>
          </div>
          ${
            showAirportLabels
              ? `<div class="mt-0.5 px-1 py-0.2 rounded bg-navy-950/90 border border-slate-800 text-[9px] font-medium text-slate-300 whitespace-nowrap shadow">
                  ${apt.city} ${delayedDepCount > 0 ? `<span class="text-occ-amber font-mono font-bold">+${delayedDepCount}</span>` : ''}
                </div>`
              : ''
          }
        </div>
      `;

      const airportMarker = L.marker([apt.lat, apt.lng], {
        icon: L.divIcon({
          html: iconHtml,
          className: 'custom-airport-pin',
          iconSize: [40, 40],
          iconAnchor: [20, 15],
        }),
      });

      airportMarker.on('click', () => {
        selectAirport(apt.id);
      });

      airportsGroup.addLayer(airportMarker);
    });
  }, [airports, closures, selectedAirportId, showAirportLabels, showDisruptionOverlay, simState.flights, selectAirport]);

  // Update Flight Routes
  useEffect(() => {
    if (!layersRef.current || !mapInstanceRef.current) return;
    const { routesGroup } = layersRef.current;
    routesGroup.clearLayers();

    if (!showRoutes) return;

    Object.values(simState.flights).forEach((flight) => {
      const origApt = airports[flight.origin];
      const destApt = airports[flight.destination];
      if (!origApt || !destApt) return;

      const isSelected = selectedFlightId === flight.flight_id;
      const isAirportConnected = selectedAirportId === flight.origin || selectedAirportId === flight.destination;
      const isDiverted = flight.status === 'DIVERTED' || flight.current_phase === 'DIVERTED';
      const isDisrupted = flight.status === 'DELAYED' || flight.status === 'SEVERELY_DELAYED' || isDiverted;

      // Generate curved route points
      const points: [number, number][] = [];
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        points.push(interpolatePosition(origApt.lat, origApt.lng, destApt.lat, destApt.lng, i / steps));
      }

      let routeColor = '#52749f';
      let routeWeight = 1.4;
      let routeOpacity = 0.52;

      if (isSelected) {
        routeColor = isDiverted ? '#d8b4fe' : '#00f0ff';
        routeWeight = 3;
        routeOpacity = 0.95;
      } else if (isDiverted) {
        routeColor = '#c084fc';
        routeWeight = 2.2;
        routeOpacity = 0.85;
      } else if (isAirportConnected) {
        routeColor = isDisrupted ? '#f59e0b' : '#38bdf8';
        routeWeight = 2;
        routeOpacity = 0.75;
      } else if (isDisrupted && showDisruptionOverlay) {
        routeColor = flight.status === 'SEVERELY_DELAYED' ? '#ef4444' : '#f59e0b';
        routeWeight = 1.5;
        routeOpacity = 0.55;
      }

      routesGroup.addLayer(L.polyline(points, {
        color: '#06101e',
        weight: routeWeight + 2.5,
        opacity: 0.9,
        interactive: false,
      }));

      const polyline = L.polyline(points, {
        color: routeColor,
        weight: routeWeight,
        opacity: routeOpacity,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: isSelected ? undefined : isDiverted ? '6, 6' : flight.status === 'SEVERELY_DELAYED' ? '4, 4' : undefined,
      });

      polyline.on('click', () => {
        selectFlight(flight.flight_id);
      });

      routesGroup.addLayer(polyline);
    });
  }, [simState.flights, airports, selectedFlightId, selectedAirportId, showRoutes, showDisruptionOverlay, selectFlight]);

  // Update Animated Aircraft Markers along Routes
  useEffect(() => {
    if (!layersRef.current || !mapInstanceRef.current) return;
    const { aircraftGroup } = layersRef.current;
    aircraftGroup.clearLayers();

    const activeFlights = Object.values(simState.flights).filter(
      (f) =>
        f.current_phase === 'AIRBORNE' ||
        f.current_phase === 'HOLDING' ||
        f.current_phase === 'DIVERTED' ||
        f.status === 'DIVERTED'
    );

    activeFlights.forEach((flight) => {
      // Apply status filter
      if (statusFilter !== 'ALL' && flight.status !== statusFilter) return;

      const origApt = airports[flight.origin];
      const destApt = airports[flight.destination];
      if (!origApt || !destApt) return;

      const isSelected = selectedFlightId === flight.flight_id;
      const [curLat, curLng] = interpolatePosition(
        origApt.lat,
        origApt.lng,
        destApt.lat,
        destApt.lng,
        flight.progress
      );

      // Calculate bearing heading
      const bearing = calculateBearing(origApt.lat, origApt.lng, destApt.lat, destApt.lng);

      // Determine aircraft color by status
      let planeColor = '#00f0ff'; // Cyan on-time
      let pulseClass = '';
      if (flight.status === 'DIVERTED' || flight.current_phase === 'DIVERTED') {
        planeColor = '#c084fc'; // Purple diverted
        pulseClass = 'animate-pulse';
      } else if (flight.status === 'SEVERELY_DELAYED' || flight.is_holding) {
        planeColor = '#ef4444'; // Red severe
        pulseClass = 'animate-pulse';
      } else if (flight.status === 'DELAYED') {
        planeColor = '#f59e0b'; // Amber delayed
      } else if (flight.status === 'RECOVERED') {
        planeColor = '#10b981'; // Green recovered
      }

      // Draw trail behind aircraft if enabled
      if (showTrails && flight.progress > 0.05) {
        const trailPoints: [number, number][] = [];
        const trailSteps = 10;
        for (let i = 0; i <= trailSteps; i++) {
          const trailT = (i / trailSteps) * flight.progress;
          trailPoints.push(interpolatePosition(origApt.lat, origApt.lng, destApt.lat, destApt.lng, trailT));
        }
        const trailLine = L.polyline(trailPoints, {
          color: planeColor,
          weight: isSelected ? 2.5 : 1.5,
          opacity: 0.6,
        });
        aircraftGroup.addLayer(trailLine);
      }

      // Aircraft Marker HTML with SVG plane icon rotated to bearing
      const planeHtml = `
        <div class="relative flex items-center justify-center cursor-pointer select-none group">
          ${
            flight.is_holding
              ? `<div class="absolute w-8 h-8 rounded-full border border-red-500 animate-spin opacity-75"></div>`
              : ''
          }
          <div
            class="w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:scale-125 ${pulseClass}"
            style="background: rgba(13, 21, 39, 0.9); border: 1.5px solid ${planeColor}; box-shadow: 0 0 8px ${planeColor}55;"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="${planeColor}"
              class="w-3.5 h-3.5"
              style="transform: rotate(${bearing - 45}deg); transform-origin: center;"
            >
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
            </svg>
          </div>
          ${
            isSelected || flight.is_holding || flight.status === 'SEVERELY_DELAYED' || flight.status === 'DIVERTED'
              ? `<div class="absolute -bottom-4 px-1.5 py-0.2 rounded bg-navy-950/90 border border-slate-800 text-[9px] font-mono font-bold text-white whitespace-nowrap shadow pointer-events-none">
                  ${flight.flight_id} ${
                    flight.status === 'DIVERTED'
                      ? `<span class="text-purple-300">DIV &rarr; ${flight.destination}</span>`
                      : flight.delay_minutes > 0
                      ? `<span class="text-occ-amber">+${flight.delay_minutes}m</span>`
                      : ''
                  }
                </div>`
              : ''
          }
        </div>
      `;

      const planeMarker = L.marker([curLat, curLng], {
        icon: L.divIcon({
          html: planeHtml,
          className: 'custom-plane-pin',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        zIndexOffset: isSelected ? 1000 : 500,
      });

      planeMarker.on('click', () => {
        selectFlight(flight.flight_id);
      });

      aircraftGroup.addLayer(planeMarker);
    });
  }, [
    simState.flights,
    airports,
    selectedFlightId,
    statusFilter,
    showTrails,
    selectFlight,
  ]);

  // Fit the complete airport network back into view.
  const handleResetZoom = () => {
    const map = mapInstanceRef.current;
    const airportLocations = Object.values(airports).map((airport) =>
      L.latLng(airport.lat, airport.lng)
    );
    if (map && airportLocations.length > 0) {
      map.fitBounds(L.latLngBounds(airportLocations), {
        padding: [56, 56],
        maxZoom: 5,
        animate: true,
      });
    }
  };

  const activeAirborneCount = Object.values(simState.flights).filter(
    (f) => f.current_phase === 'AIRBORNE' || f.current_phase === 'HOLDING'
  ).length;

  return (
    <div
      className={`relative w-full bg-navy-950 overflow-hidden flex flex-col ${
        isFullView ? 'h-full flex-1' : 'h-full min-h-[500px]'
      }`}
    >
      {/* Top Map Control Bar */}
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2">
        {/* Radar Identity & Active Count Pill */}
        <div className="flex items-center gap-2 bg-navy-900/90 backdrop-blur-md border border-occ-border px-3 py-1.5 rounded-lg shadow-lg">
          <span className="w-2 h-2 rounded-full bg-occ-cyan radar-ping"></span>
          <span className="text-xs font-mono font-bold text-white tracking-wide">
            INDIA AIRSPACE RADAR
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-navy-800 text-occ-cyan rounded border border-occ-border">
            {activeAirborneCount} AIRBORNE
          </span>
        </div>

        {/* Status Filter Pill Dropdown */}
        <div className="flex items-center bg-navy-900/90 backdrop-blur-md border border-occ-border rounded-lg p-0.5 text-xs font-mono">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2 py-1 rounded transition-colors ${
              statusFilter === 'ALL' ? 'bg-navy-750 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('ON_TIME')}
            className={`px-2 py-1 rounded transition-colors ${
              statusFilter === 'ON_TIME' ? 'bg-cyan-950 text-occ-cyan font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            On-Time
          </button>
          <button
            onClick={() => setStatusFilter('DELAYED')}
            className={`px-2 py-1 rounded transition-colors ${
              statusFilter === 'DELAYED' ? 'bg-amber-950 text-occ-amber font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Delayed
          </button>
          <button
            onClick={() => setStatusFilter('SEVERELY_DELAYED')}
            className={`px-2 py-1 rounded transition-colors ${
              statusFilter === 'SEVERELY_DELAYED' ? 'bg-red-950 text-occ-red font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Severe
          </button>
          <button
            onClick={() => setStatusFilter('RECOVERED')}
            className={`px-2 py-1 rounded transition-colors ${
              statusFilter === 'RECOVERED' ? 'bg-emerald-950 text-occ-green font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Recovered
          </button>
        </div>
      </div>

      {/* Top Right Map Toggles */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5 bg-navy-900/90 backdrop-blur-md border border-occ-border p-1 rounded-lg shadow-lg">
        <button
          onClick={() => setShowAirportLabels(!showAirportLabels)}
          aria-label="Toggle airport labels"
          aria-pressed={showAirportLabels}
          className={`p-1.5 rounded text-xs transition-colors ${
            showAirportLabels ? 'bg-navy-750 text-occ-cyan' : 'text-slate-400 hover:text-white'
          }`}
          title="Toggle Airport Labels"
        >
          <MapPin className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setShowRoutes(!showRoutes)}
          aria-label="Toggle flight routes"
          aria-pressed={showRoutes}
          className={`p-1.5 rounded text-xs transition-colors ${
            showRoutes ? 'bg-navy-750 text-occ-cyan' : 'text-slate-400 hover:text-white'
          }`}
          title="Toggle Flight Routes"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setShowTrails(!showTrails)}
          aria-label="Toggle aircraft trails"
          aria-pressed={showTrails}
          className={`p-1.5 rounded text-xs transition-colors ${
            showTrails ? 'bg-navy-750 text-occ-cyan' : 'text-slate-400 hover:text-white'
          }`}
          title="Toggle Aircraft Trails"
        >
          <Plane className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setShowDisruptionOverlay(!showDisruptionOverlay)}
          aria-label="Toggle disruption zones"
          aria-pressed={showDisruptionOverlay}
          className={`p-1.5 rounded text-xs transition-colors ${
            showDisruptionOverlay ? 'bg-red-950/60 text-occ-red border border-occ-red/40' : 'text-slate-400 hover:text-white'
          }`}
          title="Toggle Disruption Zones & Holding"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleResetZoom}
          aria-label="Fit the airport network in view"
          className="p-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
          title="Fit Airport Network"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status Legend at Bottom Left of Map */}
      <div className="absolute bottom-3 left-3 z-[400] bg-navy-900/90 backdrop-blur-md border border-occ-border px-3 py-2 rounded-lg shadow-lg flex items-center gap-4 text-[10px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-occ-cyan"></span>
          <span className="text-slate-300">On Time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-occ-amber"></span>
          <span className="text-slate-300">Delayed (15-60m)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-occ-red"></span>
          <span className="text-slate-300">Severe / Holding</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
          <span className="text-slate-300">Diverted (Alternate)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-occ-green"></span>
          <span className="text-slate-300">Spare Recovered</span>
        </div>
      </div>

      {/* Screen-reader descriptive summary */}
      <div className="sr-only" role="status" aria-live="polite">
        Interactive India Airspace Radar Map displaying {Object.keys(simState.flights).length} flights across 16 airports.
        Current active airborne: {Object.values(simState.flights).filter((f) => f.current_phase === 'AIRBORNE' || f.current_phase === 'HOLDING').length} flights.
        Active airport closures: {closures.length > 0 ? closures.map((c) => c.airport_id).join(', ') : 'None'}.
      </div>

      {/* The Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 z-0" aria-label="Interactive airspace map of India" />
    </div>
  );
};
