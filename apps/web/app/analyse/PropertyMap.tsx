'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface PropertyMapProps {
  lat: number;
  lng: number;
  address?: string;
  height?: number;
  id?: string;
}

const MARKER_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#1D9E75"/><circle cx="12" cy="12" r="5" fill="#fff"/></svg>`)}`;

export default function PropertyMap({ lat, lng, address, height = 200, id }: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 14);
      return;
    }

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    const icon = L.icon({
      iconUrl: MARKER_SVG,
      iconSize: [24, 36],
      iconAnchor: [12, 36],
      popupAnchor: [0, -36],
    });

    const marker = L.marker([lat, lng], { icon }).addTo(map);
    if (address) marker.bindPopup(`<b>${address}</b>`);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, address]);

  return (
    <div
      id={id}
      ref={containerRef}
      style={{
        height,
        width: '100%',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #e5e5e5',
      }}
    />
  );
}
