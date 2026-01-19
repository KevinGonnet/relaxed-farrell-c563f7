import React, { useState, useEffect, useRef } from "react";

import {
  MapPin,
  Navigation,
  Euro,
  Info,
  Calculator,
  Truck,
  ExternalLink,
} from "lucide-react";

const App = () => {
  // Configuration

  const HOME_COORDS = [45.8992, 6.1294]; // Annecy

  const PRICE_PER_KM = 0.636;

  // State

  const [destination, setDestination] = useState("");

  const [distance, setDistance] = useState(null);

  const [duration, setDuration] = useState(null);

  const [tolls, setTolls] = useState(0);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [routeCoords, setRouteCoords] = useState([]);

  const [mapInstance, setMapInstance] = useState(null);

  const [markers, setMarkers] = useState({ start: null, end: null });

  const [routeLayer, setRouteLayer] = useState(null);

  // Refs

  const mapRef = useRef(null);

  // Initialize Map

  useEffect(() => {
    if (!mapRef.current) return;

    // Load Leaflet CSS

    const link = document.createElement("link");

    link.rel = "stylesheet";

    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

    document.head.appendChild(link);

    // Load Leaflet JS

    const script = document.createElement("script");

    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

    script.async = true;

    script.onload = initMap;

    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, []);

  const initMap = () => {
    if (mapInstance) return;

    const L = window.L;

    const map = L.map(mapRef.current).setView(HOME_COORDS, 9);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // Custom Icons

    const homeIcon = L.divIcon({
      className: "custom-div-icon",

      html: `<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px black;"></div>`,

      iconSize: [12, 12],

      iconAnchor: [6, 6],
    });

    // Add Home Marker

    const startMarker = L.marker(HOME_COORDS, { icon: homeIcon })
      .addTo(map)

      .bindPopup("<b>Départ : Annecy</b>")
      .openPopup();

    setMarkers((prev) => ({ ...prev, start: startMarker }));

    setMapInstance(map);
  };

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!destination) return;

    setLoading(true);

    setError("");

    setDistance(null);

    try {
      // 1. Geocoding (Nominatim)

      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          destination
        )}`
      );

      const geoData = await geoRes.json();

      if (!geoData || geoData.length === 0) {
        throw new Error("Ville non trouvée");
      }

      const destCoords = [
        parseFloat(geoData[0].lat),
        parseFloat(geoData[0].lon),
      ];

      // 2. Routing (OSRM)

      const routerUrl = `https://router.project-osrm.org/route/v1/driving/${HOME_COORDS[1]},${HOME_COORDS[0]};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson`;

      const routeRes = await fetch(routerUrl);

      const routeData = await routeRes.json();

      if (routeData.code !== "Ok") {
        throw new Error("Impossible de calculer l'itinéraire");
      }

      const route = routeData.routes[0];

      const distKm = route.distance / 1000; // meters to km

      const durMin = Math.round(route.duration / 60);

      setDistance(distKm);

      setDuration(durMin);

      // Update Map Visuals

      updateMapRoute(destCoords, route.geometry.coordinates);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateMapRoute = (destCoords, geojsonCoords) => {
    if (!mapInstance) return;

    const L = window.L;

    // Flip coords for Leaflet [lat, lon] because OSRM returns [lon, lat]

    const latLngs = geojsonCoords.map((coord) => [coord[1], coord[0]]);

    // Remove old layer

    if (routeLayer) mapInstance.removeLayer(routeLayer);

    if (markers.end) mapInstance.removeLayer(markers.end);

    // Add new route

    const polyline = L.polyline(latLngs, {
      color: "blue",
      weight: 4,
      opacity: 0.7,
    }).addTo(mapInstance);

    setRouteLayer(polyline);

    // Add dest marker

    const endMarker = L.marker(destCoords)
      .addTo(mapInstance)

      .bindPopup(`<b>Destination</b><br/>${destination}`)
      .openPopup();

    setMarkers((prev) => ({ ...prev, end: endMarker }));

    // Fit bounds

    mapInstance.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  };

  // Calcul du prix final

  // Formule: (nb km aller * 0.636 + péages) * 2

  const calculateTotal = () => {
    if (distance === null) return 0;

    const baseKmCost = distance * PRICE_PER_KM;

    const oneWayTotal = baseKmCost + parseFloat(tolls || 0);

    return (oneWayTotal * 2).toFixed(2);
  };

  // Calcul du prix détaillé pour affichage

  const kmCost = distance ? (distance * PRICE_PER_KM).toFixed(2) : 0;

  const totalCost = calculateTotal();

  // Détermination de la couleur du prix

  const getPriceColor = (price) => {
    if (price < 50) return "text-green-600";

    if (price < 100) return "text-yellow-600";

    if (price < 150) return "text-orange-600";

    return "text-red-600";
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      {/* Header Mobile Only */}

      <div className="md:hidden bg-blue-900 text-white p-4 shadow-md z-20">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Truck size={20} /> Estimation frais aller-retour
        </h1>
      </div>

      <div className="flex flex-col-reverse md:flex-row h-full">
        {/* Sidebar / Control Panel */}

        <div className="w-full md:w-96 bg-white shadow-xl z-10 flex flex-col h-[50vh] md:h-full overflow-y-auto">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 hidden md:block">
              Estimation frais aller-retour
            </h2>

            <div className="mb-6">
              <p className="text-gray-500 text-sm">Départ depuis Annecy (74)</p>

              <p className="text-orange-600 text-xs font-semibold mt-1">
                *Note : les tarifs des péages sont à ajouter manuellement, après
                avoir effectué le calcul grâce au module dédié.
              </p>
            </div>

            {/* Input Form */}

            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destination
                </label>

                <div className="relative">
                  <MapPin
                    className="absolute left-3 top-3 text-gray-400"
                    size={18}
                  />

                  <input
                    type="text"
                    placeholder="Ex: Albertville, Lyon..."
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="pl-10 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  "Calcul en cours..."
                ) : (
                  <>
                    <Navigation size={18} /> Calculer l'itinéraire
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            {/* Results Section */}

            {distance !== null && (
              <div className="mt-8 space-y-6 animate-fade-in">
                {/* Stats Route */}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                    <span className="block text-gray-500 text-xs uppercase tracking-wide">
                      Distance (Aller)
                    </span>

                    <span className="text-lg font-bold text-gray-800">
                      {distance.toFixed(1)} km
                    </span>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                    <span className="block text-gray-500 text-xs uppercase tracking-wide">
                      Durée est.
                    </span>

                    <span className="text-lg font-bold text-gray-800">
                      {duration} min
                    </span>
                  </div>
                </div>

                {/* Toll Input */}

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 relative">
                  <label className="block text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                    <Euro size={16} /> Péages (Aller simple)
                  </label>

                  <div className="flex items-center">
                    <input
                      type="number"
                      min="0"
                      step="0.10"
                      value={tolls}
                      onChange={(e) => setTolls(e.target.value)}
                      className="w-full p-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-right font-mono"
                    />

                    <span className="ml-2 text-gray-600 font-bold">€</span>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <a
                      href="https://www.vinci-autoroutes.com/fr/conseils/autoroute-mode-demploi/tarifs-peage-vinci-autoroutes/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <ExternalLink size={12} />
                      Vérifier les tarifs officiels
                    </a>
                  </div>
                </div>

                {/* Final Cost Calculation */}

                <div className="border-t-2 border-dashed border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                    Détail du calcul
                  </h3>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>
                        Km ({distance.toFixed(1)} x {PRICE_PER_KM}€)
                      </span>

                      <span>{kmCost} €</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Péages</span>

                      <span>{parseFloat(tolls).toFixed(2)} €</span>
                    </div>

                    <div className="flex justify-between font-semibold text-gray-800 pt-2">
                      <span>Sous-total (Aller)</span>

                      <span>
                        {(parseFloat(kmCost) + parseFloat(tolls || 0)).toFixed(
                          2
                        )}{" "}
                        €
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-gray-400 italic">
                      <span>Multiplicateur (Aller-Retour)</span>

                      <span>x 2</span>
                    </div>
                  </div>

                  <div
                    className={`mt-4 p-4 rounded-xl text-center border-2 ${
                      Number(totalCost) > 150
                        ? "bg-red-50 border-red-100"
                        : "bg-green-50 border-green-100"
                    }`}
                  >
                    <span className="block text-gray-500 text-sm mb-1">
                      Total à facturer
                    </span>

                    <span
                      className={`text-4xl font-extrabold ${getPriceColor(
                        totalCost
                      )}`}
                    >
                      {totalCost} €
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Sidebar */}

          <div className="mt-auto p-4 bg-gray-50 border-t text-xs text-gray-500">
            <div className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 flex-shrink-0" />

              <p>Formule : (Distance x 0.636 + Péages) x 2.</p>
            </div>
          </div>
        </div>

        {/* Map Container */}

        <div className="flex-1 relative h-[50vh] md:h-full">
          <div
            ref={mapRef}
            className="w-full h-full z-0"
            style={{ background: "#e5e7eb" }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default App;
