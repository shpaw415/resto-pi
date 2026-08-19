import { useEffect, useRef, useState } from "react";

export type MapMarker = {
	id: string;
	lat: number;
	lng: number;
	label: string;
	kind?: "courier" | "restaurant" | "self";
};

const OSM_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const ICON_PATH = "https://unpkg.com/leaflet@1.9.4/dist/images/";

function samePoint(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
	return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

export function OsmMap({
	center,
	markers,
	zoom = 13,
	viewKey,
}: {
	center: { lat: number; lng: number };
	markers: MapMarker[];
	zoom?: number;
	viewKey?: string;
}) {
	const el = useRef<HTMLDivElement>(null);
	const mapRef = useRef<import("leaflet").Map | null>(null);
	const markersRef = useRef(new Map<string, import("leaflet").Marker>());
	const lastViewKey = useRef<string | undefined>(undefined);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (!document.querySelector(`link[href="${OSM_CSS}"]`)) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = OSM_CSS;
			document.head.appendChild(link);
		}
		let cancelled = false;
		void import("leaflet").then((leaflet) => {
			if (cancelled || !el.current || mapRef.current) {
				return;
			}
			const L = leaflet.default;
			L.Icon.Default.imagePath = ICON_PATH;
			delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
			L.Icon.Default.mergeOptions({
				iconUrl: `${ICON_PATH}marker-icon.png`,
				iconRetinaUrl: `${ICON_PATH}marker-icon-2x.png`,
				shadowUrl: `${ICON_PATH}marker-shadow.png`,
			});
			const map = L.map(el.current).setView([center.lat, center.lng], zoom);
			L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
				attribution: "&copy; OpenStreetMap",
				maxZoom: 19,
			}).addTo(map);
			mapRef.current = map;
			setReady(true);
		});
		return () => {
			cancelled = true;
			for (const marker of markersRef.current.values()) {
				marker.remove();
			}
			markersRef.current.clear();
			mapRef.current?.remove();
			mapRef.current = null;
			setReady(false);
		};
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		if (!ready || !map) {
			return;
		}
		void import("leaflet").then((leaflet) => {
			const L = leaflet.default;
			const existing = markersRef.current;
			const nextIds = new Set(markers.map((marker) => marker.id));
			for (const [id, marker] of existing) {
				if (!nextIds.has(id)) {
					marker.remove();
					existing.delete(id);
				}
			}
			for (const item of markers) {
				const current = existing.get(item.id);
				if (!current) {
					existing.set(
						item.id,
						L.marker([item.lat, item.lng]).bindPopup(item.label).addTo(map),
					);
					continue;
				}
				if (!samePoint(current.getLatLng(), item)) {
					current.setLatLng([item.lat, item.lng]);
				}
				const popup = current.getPopup();
				if (popup?.getContent() !== item.label) {
					current.bindPopup(item.label);
				}
			}
			const key = viewKey ?? `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
			if (lastViewKey.current === key) {
				return;
			}
			lastViewKey.current = key;
			if (markers.length > 1) {
				map.fitBounds(
					L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng])),
					{ padding: [32, 32], maxZoom: 15 },
				);
				return;
			}
			map.setView([center.lat, center.lng], zoom);
		});
	}, [ready, center.lat, center.lng, markers, zoom, viewKey]);

	return (
		<div
			ref={el}
			className="h-[min(52dvh,22rem)] w-full overflow-hidden rounded-lg border theme-border"
		/>
	);
}
