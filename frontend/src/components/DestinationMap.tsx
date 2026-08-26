import { useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import "leaflet/dist/leaflet.css";

interface DestinationMapProps {
  destination: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
}

interface OpenStreetMapLocation {
  lat: string;
  lon: string;
  display_name: string;
}

type MapCoordinates = [number, number];

const destinationMarker = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Cập nhật kích thước bản đồ khi modal vừa hiển thị.
function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [map]);

  return null;
}

function DestinationMap({
  destination,
  latitude,
  longitude,
  address = "",
}: DestinationMapProps) {
  const [coordinates, setCoordinates] =
    useState<MapCoordinates | null>(null);
  const [locationAddress, setLocationAddress] =
    useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const hasCoordinates =
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);

    if (hasCoordinates) {
      setCoordinates([latitude, longitude]);
      setLocationAddress(address);
      setMessage("");
      setIsLoading(false);

      return () => {
        controller.abort();
      };
    }

    const findDestination = async () => {
      try {
        setIsLoading(true);
        setCoordinates(null);
        setLocationAddress("");
        setMessage("");

        const keyword = destination.trim();

        if (!keyword) {
          setMessage("Chưa có thông tin địa điểm.");
          return;
        }

        const parameters = new URLSearchParams({
          format: "jsonv2",
          q: `${keyword}, Việt Nam`,
          countrycodes: "vn",
          addressdetails: "1",
          limit: "1",
          "accept-language": "vi",
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${parameters.toString()}`,
          {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            "Không thể tải dữ liệu vị trí."
          );
        }

        const locations =
          (await response.json()) as OpenStreetMapLocation[];

        const location = locations[0];

        if (!location) {
          setMessage(
            "Không tìm thấy vị trí địa điểm trên bản đồ."
          );
          return;
        }

        const locationLatitude = Number(location.lat);
        const locationLongitude = Number(location.lon);

        if (
          !Number.isFinite(locationLatitude) ||
          !Number.isFinite(locationLongitude)
        ) {
          setMessage("Tọa độ địa điểm không hợp lệ.");
          return;
        }

        setCoordinates([
          locationLatitude,
          locationLongitude,
        ]);
        setLocationAddress(location.display_name);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error("Lỗi tải bản đồ địa điểm:", error);
        setMessage(
          "Không thể tải bản đồ. Vui lòng thử lại sau."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void findDestination();

    return () => {
      controller.abort();
    };
  }, [address, destination, latitude, longitude]);

  const openStreetMapUrl = coordinates
    ? "https://www.openstreetmap.org/" +
      `?mlat=${coordinates[0]}` +
      `&mlon=${coordinates[1]}` +
      `#map=14/${coordinates[0]}/${coordinates[1]}`
    : "https://www.openstreetmap.org/search?query=" +
      encodeURIComponent(`${destination}, Việt Nam`);

  return (
    <section className="destination-map-section">
      <div className="destination-map-heading">
        <div>
          <span className="destination-map-label">
            VỊ TRÍ TRÊN BẢN ĐỒ
          </span>

          <h3>Khám phá {destination}</h3>
        </div>

        <a
          className="destination-map-open-link"
          href={openStreetMapUrl}
          target="_blank"
          rel="noreferrer"
        >
          Mở bản đồ ↗
        </a>
      </div>

      {isLoading ? (
        <div className="destination-map-status">
          Đang tìm vị trí trên bản đồ...
        </div>
      ) : message ? (
        <div className="destination-map-status error">
          {message}
        </div>
      ) : coordinates ? (
        <>
          <div className="destination-map-frame">
            <MapContainer
              key={`${coordinates[0]}-${coordinates[1]}`}
              center={coordinates}
              zoom={13}
              scrollWheelZoom={false}
              className="destination-leaflet-map"
              style={{ height: 360, width: "100%" }}
            >
              <ResizeMap />

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Marker
                position={coordinates}
                icon={destinationMarker}
              >
                <Popup>
                  <strong>{destination}</strong>

                  {locationAddress && (
                    <p>{locationAddress}</p>
                  )}
                </Popup>
              </Marker>
            </MapContainer>
          </div>

          {locationAddress && (
            <p className="destination-map-address">
              📍 {locationAddress}
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}

export default DestinationMap;