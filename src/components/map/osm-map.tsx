import { useEffect, useRef } from "react";

export type MapMarker = {
	id: string;
	lat: number;
	lng: number;
	label: string;
	kind?: "courier" | "restaurant" | "self";
};

const OSM_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const ICON = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const ICON_2X = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const SHADOW = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

export function OsmMap({
	center,
	markers,
	zoom = 13,
}: {
	center: { lat: number; lng: number };
	markers: MapMarker[];
	zoom?: number;
}) {
	const el = useRef<HTMLDivElement>(null);
	const mapRef = useRef<import("leaflet").Map | null>(null);
	const layerRef = useRef<import("leaflet").LayerGroup | null>(null);

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
			L.Icon.Default.mergeOptions({
				iconUrl: ICON,
				iconRetinaUrl: ICON_2X,
				shadowUrl: SHADOW,
			});
			const map = L.map(el.current).setView([center.lat, center.lng], zoom);
			L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
				attribution: "&copy; OpenStreetMap",
				maxZoom: 19,
			}).addTo(map);
			layerRef.current = L.layerGroup().addTo(map);
			mapRef.current = map;
		});
		return () => {
			cancelled = true;
			mapRef.current?.remove();
			mapRef.current = null;
			layerRef.current = null;
		};
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		const layer = layerRef.current;
		if (!map || !layer) {
			return;
		}
		void import("leaflet").then((leaflet) => {
			const L = leaflet.default;
			layer.clearLayers();
			for (const marker of markers) {
				L.marker([marker.lat, marker.lng])
					.bindPopup(marker.label)
					.addTo(layer);
			}
			if (markers.length > 1) {
				map.fitBounds(
					L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng])),
					{ padding: [32, 32], maxZoom: 15 },
				);
			} else {
				map.setView([center.lat, center.lng], zoom);
			}
		});
	}, [center.lat, center.lng, markers, zoom]);

	return (
		<div
			ref={el}
			className="h-[min(52dvh,22rem)] w-full overflow-hidden rounded-lg border theme-border"
		/>
	);
}
