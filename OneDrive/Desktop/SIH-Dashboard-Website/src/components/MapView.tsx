import React, { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';

import { useData } from '../hooks/useData';
import { Driver, Bus } from '../core/types';
import { useTheme } from '../contexts/ThemeContext';
import { BusSimulationState, simulationService } from '../core/simulationService';
import { getRouteById } from '../core/gpsRoutes';
import {
  MdLocationOn,
  MdDirectionsBus,
  MdPerson,
  MdRoute,
  MdSpeed,
  MdAccessTime,
  MdClose,
  MdFullscreen,
  MdZoomIn,
  MdZoomOut
} from 'react-icons/md';

interface MapViewProps {
  className?: string;
}

const MAPTILER_KEY = 'cXEywNCr1BRH73NEwP9I';

export const MapView: React.FC<MapViewProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});

  const dataProvider = useData();
  const { theme } = useTheme();

  const [selectedMarker, setSelectedMarker] = useState<{
    bus: BusSimulationState;
    driver?: Driver;
    busInfo?: Bus;
  } | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [activeBuses, setActiveBuses] = useState<BusSimulationState[]>([]);
  const [realTimeEnabled] = useState(true);

  const styleUrl = useMemo(
    () => `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
    []
  );

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    // Ensure previous instance is cleaned
    if (mapRef.current) {
      try { mapRef.current.remove(); } catch {}
      mapRef.current = null;
    }

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [77.5946, 12.9716], // [lng, lat] - Bangalore
      zoom: 11,
      attributionControl: false,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left');

    const handleLoad = () => {
      setMapLoading(false);
    };

    mapRef.current.on('load', handleLoad);

    return () => {
      // Cleanup markers
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};

      if (mapRef.current) {
        mapRef.current.off('load', handleLoad);
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
    };
  }, [styleUrl]);

  // Subscribe to real-time bus updates
  useEffect(() => {
    const unsubscribe = simulationService.onUpdate(async (buses: BusSimulationState[]) => {
      setActiveBuses(buses);
      if (realTimeEnabled) {
        await setMarkersFromBuses(buses);
      }
    });
    return () => unsubscribe();
  }, [realTimeEnabled]);

  // Helper: clear and re-add markers from list
  const replaceMarkers = (items: { id: string; lat: number; lng: number; label: string; onClick?: () => void }[]) => {
    if (!mapRef.current) return;

    // Remove existing
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    // Add new markers
    items.forEach(item => {
      const popup = new maplibregl.Popup({ offset: 16 }).setText(item.label);

      const marker = new maplibregl.Marker({ color: '#ef4444' })
        .setLngLat([item.lng, item.lat])
        .setPopup(popup)
        .addTo(mapRef.current!);

      if (item.onClick) {
        marker.getElement().addEventListener('click', () => item.onClick && item.onClick());
      }

      markersRef.current[item.id] = marker;
    });
  };

  // Build markers from bus simulation data
  const setMarkersFromBuses = async (buses: BusSimulationState[]) => {
    if (!mapRef.current) return;

    const allBuses = await dataProvider.listBuses();
    const allDrivers = await dataProvider.listDrivers();

    const items = buses.map(bus => {
      const route = getRouteById(bus.routeId);
      const busInfo = allBuses.find(b => b.id === bus.busId);
      const driver = allDrivers.find(d => d.id === busInfo?.assignedDriverId);

      const label = `Bus ${busInfo?.busNumber || bus.busId} - ${driver?.fullName || 'Unknown Driver'} - ${route?.name || 'Unknown Route'} - ${bus.status} - ${bus.speed} km/h`;

      return {
        id: bus.busId,
        lat: bus.currentPosition.lat,
        lng: bus.currentPosition.lng,
        label,
        onClick: () => {
          setSelectedMarker({ bus, driver, busInfo });
        },
      };
    });

    replaceMarkers(items);
  };

  // Initial markers from approved drivers (mock positions) after map loads
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!mapRef.current) return;
      try {
        const drivers = await dataProvider.listDrivers('approved');
        const buses = await dataProvider.listBuses();

        if (cancelled) return;

        const baseLat = 12.9716;
        const baseLng = 77.5946;
        const items = drivers
          .filter(d => d.assignedBusId)
          .map((driver) => {
            const bus = buses.find(b => b.id === driver.assignedBusId);
            const lat = baseLat + (Math.random() - 0.5) * 0.1;
            const lng = baseLng + (Math.random() - 0.5) * 0.1;
            return {
              id: driver.id,
              lat,
              lng,
              label: `${driver.fullName} - ${bus?.busNumber || 'Unknown Bus'}`,
            };
          });

        replaceMarkers(items);
      } catch (e) {
        console.error('Failed to load initial markers', e);
      }
    };

    if (!mapLoading) {
      load();
    }

    return () => { cancelled = true; };
  }, [dataProvider, mapLoading]);

  const mapStats = [
    { label: 'Active Buses', value: activeBuses.length, icon: MdDirectionsBus, color: 'text-blue-500' },
    { label: 'Routes', value: 6, icon: MdRoute, color: 'text-green-500' },
    { label: 'Avg Speed', value: '42 km/h', icon: MdSpeed, color: 'text-purple-500' },
  ];

  // UI actions
  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };
  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };
  const handleFullscreen = () => {
    const el = containerRef.current?.parentElement; // wrapper div
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl ${
      theme === 'dark' 
        ? 'bg-gray-800/50 backdrop-blur-xl border border-gray-700/50' 
        : 'bg-white/70 backdrop-blur-xl border border-gray-200/50'
    } shadow-xl group ${className}`}>
      {/* Header */}
      <div className={`p-6 border-b ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-200/50'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${
              theme === 'dark' ? 'from-purple-500 to-cyan-500' : 'from-blue-500 to-indigo-600'
            }`}>
              <MdLocationOn className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Live Bus Tracking
              </h3>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Real-time driver locations
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleZoomIn} className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}>
              <MdZoomIn className="h-4 w-4" />
            </button>
            <button onClick={handleZoomOut} className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}>
              <MdZoomOut className="h-4 w-4" />
            </button>
            <button onClick={handleFullscreen} className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}>
              <MdFullscreen className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Map Stats */}
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {mapStats.map((stat, index) => {
            const Icon = stat.icon as any;
            return (
              <div
                key={index}
                className={`p-4 rounded-xl border transition-all ${
                  theme === 'dark'
                    ? 'bg-gray-700/30 border-gray-600/30 hover:bg-gray-700/50'
                    : 'bg-white/50 border-gray-200/50 hover:bg-white/70'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                  <div>
                    <p className={`text-sm font-medium ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {stat.value}
                    </p>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {stat.label}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Map Container */}
        <div className="relative">
          {mapLoading && (
            <div className={`absolute inset-0 flex items-center justify-center rounded-lg z-10 ${
              theme === 'dark' ? 'bg-gray-800/80' : 'bg-white/80'
            }`}>
              <div className="flex flex-col items-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Loading map...
                </p>
              </div>
            </div>
          )}

          <div
            ref={containerRef}
            className={`w-full h-96 rounded-lg transition-all ${
              theme === 'dark' 
                ? 'bg-gray-900 border border-gray-700' 
                : 'bg-gray-100 border border-gray-200'
            }`}
            aria-label="Live driver locations map"
          />

          {!mapLoading && (
            <div className="absolute top-4 right-4 z-10">
              <div className={`px-3 py-2 rounded-lg shadow-lg ${
                theme === 'dark' 
                  ? 'bg-gray-800/90 backdrop-blur-sm border border-gray-700/50' 
                  : 'bg-white/90 backdrop-blur-sm border border-gray-200/50'
              }`}>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Live
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Marker Detail Popup */}
      {selectedMarker && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20 p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl ${
            theme === 'dark' 
              ? 'bg-gray-800 border border-gray-700' 
              : 'bg-white border border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Bus Details
              </h3>
              <button
                onClick={() => setSelectedMarker(null)}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <MdClose className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <MdDirectionsBus className="h-5 w-5 text-blue-500" />
                <div>
                  <p className={`font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {selectedMarker.busInfo?.busNumber || selectedMarker.bus.busId}
                  </p>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Bus Number
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <MdPerson className="h-5 w-5 text-green-500" />
                <div>
                  <p className={`font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {selectedMarker.driver?.fullName || 'Unknown Driver'}
                  </p>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Driver
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <MdRoute className="h-5 w-5 text-purple-500" />
                <div>
                  <p className={`font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {getRouteById(selectedMarker.bus.routeId)?.name || 'Unknown Route'}
                  </p>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Route
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <MdAccessTime className="h-5 w-5 text-orange-500" />
                <div>
                  <p className={`font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    On Time
                  </p>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Status
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
