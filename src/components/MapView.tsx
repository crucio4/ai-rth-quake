'use client';

// ============================================================================
// DEPREM-AI — MapView v5 (Satellite + Reliable Building Selection)
// - Esri World Imagery satellite basemap
// - Map-level click handler for robust building selection in routing mode
// - Zone circles are non-interactive (don't steal clicks)
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { useQuakeStore } from '../store/quakeStore';
import type { PriorityZone } from '../store/quakeStore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DAMAGE_COLORS: Record<string, string> = {
  YIKIK: '#ef4444', AGIR: '#f97316', ORTA: '#eab308', HAFIF: '#22c55e', SAGLAM: '#94a3b8',
};

const ZONE_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308',
};

// Canvas renderer for massive performance boost with thousands of markers
const canvasRenderer = typeof window !== 'undefined' ? L.canvas({ padding: 0.5, tolerance: 10 }) : null;

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buildingLayerRef = useRef<L.LayerGroup | null>(null);
  const zoneLayerRef = useRef<L.LayerGroup | null>(null);
  const centerLayerRef = useRef<L.LayerGroup | null>(null);
  const missionLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedMarkerRef = useRef<L.CircleMarker | null>(null);
  const buildingsRenderedRef = useRef(false);
  const zonesRenderedRef = useRef(false);
  const centersRenderedRef = useRef(false);

  const buildings = useQuakeStore((s) => s.buildings);
  const emergencyCenters = useQuakeStore((s) => s.emergencyCenters);
  const missions = useQuakeStore((s) => s.missions);
  const priorityZones = useQuakeStore((s) => s.priorityZones);
  const dataReady = useQuakeStore((s) => s.dataReady);
  const showBeforeAfter = useQuakeStore((s) => s.showBeforeAfter);
  const selectBuilding = useQuakeStore((s) => s.selectBuilding);

  // Initialize map — appears IMMEDIATELY (no loading screen)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [41.043, 29.004],  // Besiktas district center
      zoom: 15,                   // Close zoom for dense building view
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,  // Global canvas preference
    });

    // ── Satellite basemap (Esri World Imagery) ──
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Esri Satellite',
      }
    ).addTo(map);

    // ── Semi-transparent dark label overlay for readability ──
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
        opacity: 0.85,
        pane: 'overlayPane',
      }
    ).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // Layer order: zones (bottom) → buildings → centers → missions (top)
    zoneLayerRef.current = L.layerGroup().addTo(map);
    buildingLayerRef.current = L.layerGroup().addTo(map);
    centerLayerRef.current = L.layerGroup().addTo(map);
    missionLayerRef.current = L.layerGroup().addTo(map);

    // ── Map-level click handler for building selection ──
    // This is much more reliable than individual marker click events
    // because canvas-rendered markers can be hard to click precisely.
    map.on('click', (e: L.LeafletMouseEvent) => {
      const state = useQuakeStore.getState();
      if (!state.routingMode) return;

      const clickLat = e.latlng.lat;
      const clickLng = e.latlng.lng;

      // Find nearest building within a reasonable radius
      const zoom = map.getZoom();
      // Adjust search radius based on zoom level
      const searchRadiusKm = zoom >= 18 ? 0.03 : zoom >= 16 ? 0.06 : zoom >= 14 ? 0.15 : 0.3;

      let nearestId: string | null = null;
      let nearestDist = Infinity;

      for (const b of state.buildings) {
        const dist = quickDist(clickLat, clickLng, b.lat, b.lng);
        if (dist < nearestDist && dist < searchRadiusKm) {
          nearestDist = dist;
          nearestId = b.id;
        }
      }

      if (nearestId) {
        selectBuilding(nearestId);

        // Visual feedback: highlight the selected building
        if (selectedMarkerRef.current) {
          map.removeLayer(selectedMarkerRef.current);
        }
        const selectedB = state.buildings.find((b) => b.id === nearestId);
        if (selectedB) {
          selectedMarkerRef.current = L.circleMarker([selectedB.lat, selectedB.lng], {
            radius: 12,
            fillColor: '#ffffff',
            fillOpacity: 0.3,
            color: '#ffffff',
            weight: 3,
            className: 'selected-building-pulse',
          }).addTo(map);
        }
      }
    });

    mapRef.current = map;

    // Force a resize after mount to fix the grey-tile issue
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Render buildings using Canvas renderer (handles 3000+ markers smoothly)
  useEffect(() => {
    if (!buildingLayerRef.current || !dataReady || buildingsRenderedRef.current) return;
    if (buildings.length === 0) return;
    buildingsRenderedRef.current = true;

    // Add all markers in a single batch using canvas renderer
    const markers: L.CircleMarker[] = [];

    for (const b of buildings) {
      const color = DAMAGE_COLORS[b.damageCategory] || '#94a3b8';
      const isDestroyed = b.damageCategory === 'YIKIK';
      const isSevere = b.damageCategory === 'AGIR';
      const radius = isDestroyed ? 5 : isSevere ? 4 : b.damageCategory === 'ORTA' ? 3 : 2;

      const marker = L.circleMarker([b.lat, b.lng], {
        radius,
        fillColor: color,
        fillOpacity: isDestroyed ? 0.95 : isSevere ? 0.85 : 0.55,
        color: isDestroyed ? '#fff' : 'transparent',
        weight: isDestroyed ? 1.5 : 0,
        renderer: canvasRenderer!,
      });

      marker.bindPopup(`
        <div style="font-family: 'Inter', system-ui; min-width: 240px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color};"></div>
            <span style="font-weight: 800; font-size: 14px; color: ${color};">${b.damageCategory}</span>
            <span style="margin-left: auto; font-size: 11px; color: #9ca3af; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 6px;">
              Skor: ${b.damageScore.toFixed(1)}/4.0
            </span>
          </div>
          <div style="display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; font-size: 11px; color: #d1d5db; line-height: 1.9;">
            <span style="color: #6b7280;">📍 İlçe</span><span>${b.district}</span>
            <span style="color: #6b7280;">🏘 Mahalle</span><span>${b.neighborhood}</span>
            <span style="color: #6b7280;">🏗 Yapı</span><span>${b.structureType.replace(/_/g, ' ')}</span>
            <span style="color: #6b7280;">📅 Yaş</span><span>${b.buildingAge} yıl</span>
            <span style="color: #6b7280;">🏢 Kat</span><span>${b.floors}</span>
            <span style="color: #6b7280;">👥 Kişi</span><span style="font-weight: 700; color: #fbbf24;">${b.residents}</span>
            <span style="color: #6b7280;">⚡ Fay</span><span>${b.distanceToFaultKm.toFixed(1)} km</span>
            <span style="color: #6b7280;">🌍 Zemin</span><span>Tip ${b.soilType} (×${b.soilAmplification.toFixed(1)})</span>
          </div>
          <div style="margin-top: 8px; padding: 8px; background: ${color}12; border: 1px solid ${color}25; border-radius: 10px; text-align: center;">
            <span style="font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Öncelik</span>
            <div style="font-size: 20px; font-weight: 900; color: ${color};">${b.priorityScore}<span style="font-size: 11px; color: #6b7280;">/100</span></div>
          </div>
        </div>
      `);

      markers.push(marker);
    }

    // Batch add to layer
    for (const m of markers) {
      buildingLayerRef.current!.addLayer(m);
    }
  }, [buildings, dataReady]);

  // Hide/show buildings based on before/after toggle
  useEffect(() => {
    if (!buildingLayerRef.current || !mapRef.current) return;
    if (showBeforeAfter) {
      mapRef.current.removeLayer(buildingLayerRef.current);
      if (zoneLayerRef.current) mapRef.current.removeLayer(zoneLayerRef.current);
    } else {
      if (!mapRef.current.hasLayer(buildingLayerRef.current)) {
        buildingLayerRef.current.addTo(mapRef.current);
      }
      if (zoneLayerRef.current && !mapRef.current.hasLayer(zoneLayerRef.current)) {
        zoneLayerRef.current.addTo(mapRef.current);
      }
    }
  }, [showBeforeAfter]);

  // Render priority zones — NON-INTERACTIVE so they don't steal clicks
  useEffect(() => {
    if (!zoneLayerRef.current || !dataReady || zonesRenderedRef.current) return;
    if (priorityZones.length === 0) return;
    zonesRenderedRef.current = true;

    for (const zone of priorityZones) {
      const color = ZONE_COLORS[zone.level] || '#eab308';
      L.circle(zone.center, {
        radius: zone.radius * 1000,
        color, weight: 1.5, opacity: 0.4,
        fillColor: color, fillOpacity: 0.06,
        dashArray: '6, 4',
        interactive: false,  // ← KEY FIX: zones don't capture mouse events
      }).addTo(zoneLayerRef.current!);
    }
  }, [priorityZones, dataReady]);

  // Render emergency centers
  useEffect(() => {
    if (!centerLayerRef.current || centersRenderedRef.current) return;
    centersRenderedRef.current = true;

    for (const center of emergencyCenters) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width: 36px; height: 36px; border-radius: 10px;
          background: ${center.color}; border: 2.5px solid white;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          box-shadow: 0 0 20px ${center.color}55, 0 4px 12px rgba(0,0,0,0.5);
        ">${center.icon}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      L.marker([center.lat, center.lng], { icon })
        .bindPopup(`
          <div style="font-family: system-ui; text-align: center;">
            <div style="font-size: 13px; font-weight: 800; color: ${center.color};">${center.name}</div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">
              Kapasite: ${center.capacity} ekip
            </div>
          </div>
        `)
        .addTo(centerLayerRef.current!);
    }
  }, [emergencyCenters]);

  // Render mission routes (OSRM real road routes)
  useEffect(() => {
    if (!missionLayerRef.current) return;
    missionLayerRef.current.clearLayers();

    for (const mission of missions) {
      if (mission.route.length < 2) continue;

      // Animated route line with dash animation
      const routeLine = L.polyline(mission.route, {
        color: mission.color,
        weight: 4,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '12, 8',
        className: 'animated-route',
      });

      routeLine.bindPopup(`
        <div style="font-family: system-ui; text-align: center; font-size: 11px;">
          <div style="font-weight: 700; color: ${mission.color};">Görev Rotası</div>
          <div style="color: #9ca3af; margin-top: 4px;">
            📏 ${mission.routeDistance} km · ⏱ ${mission.routeDuration} dk
            ${mission.safeRoute ? '<br/><span style="color: #22c55e;">✓ Safe Route (yıkıntılardan kaçınıyor)</span>' : ''}
          </div>
        </div>
      `).addTo(missionLayerRef.current!);

      // Background glow line
      L.polyline(mission.route, {
        color: mission.color,
        weight: 10,
        opacity: 0.15,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(missionLayerRef.current!);

      // Destination marker with pulse effect
      const lastPoint = mission.route[mission.route.length - 1];
      const destIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: 20px; height: 20px; border-radius: 50%;
          background: ${mission.color}; border: 2.5px solid white;
          box-shadow: 0 0 12px ${mission.color}88, 0 0 24px ${mission.color}44;
          animation: pulse 2s ease-in-out infinite;
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      L.marker(lastPoint, { icon: destIcon }).addTo(missionLayerRef.current!);

      // Origin marker
      const firstPoint = mission.route[0];
      const originIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: 14px; height: 14px; border-radius: 50%;
          background: white; border: 2px solid ${mission.color};
          box-shadow: 0 0 8px ${mission.color}66;
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker(firstPoint, { icon: originIcon }).addTo(missionLayerRef.current!);
    }
  }, [missions]);

  // Clean up selected marker when routing mode is turned off
  useEffect(() => {
    const unsub = useQuakeStore.subscribe((state, prev) => {
      if (!state.routingMode && prev.routingMode && selectedMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(selectedMarkerRef.current);
        selectedMarkerRef.current = null;
      }
    });
    return unsub;
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}

/** Quick approximate distance in km (avoids trig for performance) */
function quickDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * 111.32;
  const dLng = (lng2 - lng1) * 111.32 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
