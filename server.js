const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const rootDir = __dirname;
const defaultPort = 4173;
const portFlagIndex = process.argv.indexOf("--port");
const cliPort = portFlagIndex >= 0 ? Number(process.argv[portFlagIndex + 1]) : NaN;
const port = Number(process.env.PORT) || (Number.isFinite(cliPort) ? cliPort : defaultPort);

loadEnvFile(path.join(rootDir, ".env"));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const placeConfigs = {
  shopping: {
    amapKeywords: "购物中心|商场|步行街|百货",
    overpassTags: [
      { key: "shop", value: "mall" },
      { key: "shop", value: "department_store" },
      { key: "amenity", value: "marketplace" },
      { key: "tourism", value: "attraction" }
    ]
  },
  relax: {
    amapKeywords: "公园|咖啡厅|花园|观景点",
    overpassTags: [
      { key: "leisure", value: "park" },
      { key: "amenity", value: "cafe" },
      { key: "leisure", value: "garden" },
      { key: "tourism", value: "viewpoint" }
    ]
  },
  nature: {
    amapKeywords: "公园|植物园|湖|湿地|森林公园",
    overpassTags: [
      { key: "leisure", value: "park" },
      { key: "tourism", value: "viewpoint" },
      { key: "natural", value: "water" },
      { key: "leisure", value: "garden" }
    ]
  },
  culture: {
    amapKeywords: "博物馆|美术馆|图书馆|古迹|展览馆",
    overpassTags: [
      { key: "tourism", value: "museum" },
      { key: "amenity", value: "library" },
      { key: "historic", value: "monument" },
      { key: "tourism", value: "gallery" }
    ]
  },
  food: {
    amapKeywords: "餐厅|咖啡厅|美食广场|酒吧|夜市",
    overpassTags: [
      { key: "amenity", value: "restaurant" },
      { key: "amenity", value: "cafe" },
      { key: "amenity", value: "fast_food" },
      { key: "amenity", value: "bar" }
    ]
  }
};

const transportConfigs = {
  walk: { radius: 1200 },
  transit: { radius: 5000 },
  bike: { radius: 3500 },
  drive: { radius: 8000 }
};

const providerOrder = (process.env.PLACE_PROVIDERS || "amap,overpass")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

const overpassEndpoints = (
  process.env.OVERPASS_ENDPOINTS ||
  [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
  ].join(",")
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const amapApiKey = process.env.AMAP_API_KEY || "";

const cacheTtls = {
  weather: 15 * 60 * 1000,
  geocode: 24 * 60 * 60 * 1000,
  places: 10 * 60 * 1000
};

const caches = {
  weather: new Map(),
  geocode: new Map(),
  places: new Map()
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function now() {
  return Date.now();
}

function getCacheEntry(cacheName, key) {
  const entry = caches[cacheName].get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt > now()) {
    return { state: "fresh", value: entry.value };
  }

  return { state: "stale", value: entry.value };
}

function setCacheEntry(cacheName, key, value, ttlMs) {
  caches[cacheName].set(key, {
    value,
    expiresAt: now() + ttlMs
  });
}

function makeCacheKey(parts) {
  return JSON.stringify(parts);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message, details) {
  sendJson(response, statusCode, {
    error: message,
    details
  });
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "today-planner/1.0 (+self-hosted proxy)",
      Accept: "application/json",
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`Upstream request failed: ${response.status}`);
  }

  return response.json();
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

async function withCache(cacheName, key, resolver, ttlMs) {
  const hit = getCacheEntry(cacheName, key);
  if (hit?.state === "fresh") {
    return { data: hit.value, cache: "hit", staleFallback: false };
  }

  try {
    const value = await resolver();
    setCacheEntry(cacheName, key, value, ttlMs);
    return { data: value, cache: hit ? "refresh" : "miss", staleFallback: false };
  } catch (error) {
    if (hit?.state === "stale") {
      return { data: hit.value, cache: "stale", staleFallback: true, error };
    }
    throw error;
  }
}

async function handleWeather(requestUrl, response) {
  const lat = toFiniteNumber(requestUrl.searchParams.get("lat"));
  const lon = toFiniteNumber(requestUrl.searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    sendError(response, 400, "Missing or invalid lat/lon.");
    return;
  }

  const cacheKey = makeCacheKey([lat, lon]);

  try {
    const result = await withCache(
      "weather",
      cacheKey,
      async () => {
        const upstream = new URL("https://api.open-meteo.com/v1/forecast");
        upstream.search = new URLSearchParams({
          latitude: lat,
          longitude: lon,
          current: [
            "temperature_2m",
            "apparent_temperature",
            "is_day",
            "weather_code",
            "wind_speed_10m"
          ].join(","),
          daily: [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_probability_max"
          ].join(","),
          forecast_days: "1",
          timezone: "auto"
        }).toString();

        return fetchJson(upstream);
      },
      cacheTtls.weather
    );

    sendJson(response, 200, result.data);
  } catch {
    sendError(response, 502, "Weather service is temporarily unavailable.");
  }
}

async function handleGeocode(requestUrl, response) {
  const city = requestUrl.searchParams.get("city")?.trim();

  if (!city) {
    sendError(response, 400, "Missing city.");
    return;
  }

  const cacheKey = city.toLowerCase();

  try {
    const result = await withCache(
      "geocode",
      cacheKey,
      async () => {
        const upstream = new URL("https://geocoding-api.open-meteo.com/v1/search");
        upstream.search = new URLSearchParams({
          name: city,
          count: "1",
          language: "zh",
          format: "json"
        }).toString();

        const data = await fetchJson(upstream);
        if (!data.results || data.results.length === 0) {
          const notFound = new Error("CITY_NOT_FOUND");
          notFound.code = "CITY_NOT_FOUND";
          throw notFound;
        }

        const match = data.results[0];
        return {
          label: [match.name, match.admin1, match.country].filter(Boolean).join(" · "),
          latitude: match.latitude,
          longitude: match.longitude
        };
      },
      cacheTtls.geocode
    );

    sendJson(response, 200, result.data);
  } catch (error) {
    if (error?.code === "CITY_NOT_FOUND") {
      sendError(response, 404, "City was not found.");
      return;
    }
    sendError(response, 502, "City lookup service is temporarily unavailable.");
  }
}

function normalizeOverpassPlace(element, origin) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  const name =
    tags.name ||
    tags["name:zh"] ||
    tags.brand ||
    tags.operator ||
    "附近地点";
  const category =
    tags.shop ||
    tags.amenity ||
    tags.leisure ||
    tags.tourism ||
    tags.historic ||
    tags.natural ||
    "综合地点";

  return {
    id: `overpass-${element.id}`,
    name,
    lat,
    lon,
    distance:
      Number.isFinite(lat) && Number.isFinite(lon)
        ? haversineDistance(origin.lat, origin.lon, lat, lon)
        : NaN,
    category,
    area: [tags.addr_street, tags.addr_suburb, tags.addr_city, tags.addr_district]
      .filter(Boolean)
      .join(" "),
    tags,
    provider: "overpass"
  };
}

function normalizeAmapPlace(place, origin) {
  const [lonText = "", latText = ""] = String(place.location || "").split(",");
  const lat = toFiniteNumber(latText);
  const lon = toFiniteNumber(lonText);

  return {
    id: `amap-${place.id || place.name}`,
    name: place.name || "附近地点",
    lat,
    lon,
    distance:
      Number.isFinite(lat) && Number.isFinite(lon)
        ? haversineDistance(origin.lat, origin.lon, lat, lon)
        : toFiniteNumber(place.distance),
    category: place.type || place.typecode || "综合地点",
    area: [place.address, place.adname, place.cityname].filter(Boolean).join(" "),
    tags: {
      type: place.type,
      business_area: place.business_area
    },
    provider: "amap"
  };
}

function dedupePlaces(places) {
  const seen = new Set();
  return places.filter((place) => {
    const key = `${place.name}-${place.lat}-${place.lon}`;
    if (!place.name || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function fetchOverpassPlaces(lat, lon, purpose, radius) {
  const config = placeConfigs[purpose];
  const clauses = config.overpassTags
    .map(
      (tag) => `
        node(around:${radius},${lat},${lon})["${tag.key}"="${tag.value}"];
        way(around:${radius},${lat},${lon})["${tag.key}"="${tag.value}"];
        relation(around:${radius},${lat},${lon})["${tag.key}"="${tag.value}"];
      `
    )
    .join("\n");

  const query = `
    [out:json][timeout:20];
    (
      ${clauses}
    );
    out center tags;
  `.trim();

  const failures = [];

  for (const endpoint of overpassEndpoints) {
    try {
      const data = await fetchJson(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8"
        },
        body: query
      });

      const places = dedupePlaces(
        (data.elements || [])
          .map((element) => normalizeOverpassPlace(element, { lat, lon }))
          .filter((place) => Number.isFinite(place.distance))
          .sort((left, right) => left.distance - right.distance)
      ).slice(0, 6);

      return {
        provider: `overpass:${endpoint}`,
        places
      };
    } catch (error) {
      failures.push(`${endpoint}: ${error.message}`);
    }
  }

  const upstreamError = new Error("OVERPASS_ALL_FAILED");
  upstreamError.details = failures;
  throw upstreamError;
}

async function fetchAmapPlaces(lat, lon, purpose, radius) {
  if (!amapApiKey) {
    const missingKeyError = new Error("AMAP_KEY_MISSING");
    missingKeyError.details = ["AMAP_API_KEY is not configured."];
    throw missingKeyError;
  }

  const config = placeConfigs[purpose];
  const upstream = new URL("https://restapi.amap.com/v3/place/around");
  upstream.search = new URLSearchParams({
    key: amapApiKey,
    location: `${lon},${lat}`,
    keywords: config.amapKeywords,
    radius: String(Math.min(radius, 50000)),
    sortrule: "distance",
    offset: "10",
    page: "1",
    extensions: "base"
  }).toString();

  const data = await fetchJson(upstream);
  if (data.status !== "1") {
    const providerError = new Error("AMAP_REJECTED");
    providerError.details = [data.info || "AMap rejected the request."];
    throw providerError;
  }

  const places = dedupePlaces(
    (data.pois || [])
      .map((place) => normalizeAmapPlace(place, { lat, lon }))
      .filter((place) => Number.isFinite(place.distance))
      .sort((left, right) => left.distance - right.distance)
  ).slice(0, 6);

  return {
    provider: "amap",
    places
  };
}

async function fetchPlacesViaProvider(providerName, lat, lon, purpose, radius) {
  if (providerName === "amap") {
    return fetchAmapPlaces(lat, lon, purpose, radius);
  }

  if (providerName === "overpass") {
    return fetchOverpassPlaces(lat, lon, purpose, radius);
  }

  const unsupported = new Error("PROVIDER_UNSUPPORTED");
  unsupported.details = [`Unsupported provider: ${providerName}`];
  throw unsupported;
}

async function fetchPlacesWithFallback(lat, lon, purpose, transport) {
  const radius = transportConfigs[transport].radius;
  const failures = [];

  for (const providerName of providerOrder) {
    try {
      const result = await fetchPlacesViaProvider(providerName, lat, lon, purpose, radius);
      return {
        ...result,
        failures
      };
    } catch (error) {
      failures.push({
        provider: providerName,
        details: error?.details || [error?.message || "Unknown provider error."]
      });
    }
  }

  const chainError = new Error("PLACE_CHAIN_FAILED");
  chainError.details = failures;
  throw chainError;
}

async function handlePlaces(requestUrl, response) {
  const lat = toFiniteNumber(requestUrl.searchParams.get("lat"));
  const lon = toFiniteNumber(requestUrl.searchParams.get("lon"));
  const purpose = requestUrl.searchParams.get("purpose") || "relax";
  const transport = requestUrl.searchParams.get("transport") || "walk";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    sendError(response, 400, "Missing or invalid lat/lon.");
    return;
  }

  if (!placeConfigs[purpose] || !transportConfigs[transport]) {
    sendError(response, 400, "Invalid purpose or transport.");
    return;
  }

  const cacheKey = makeCacheKey([lat, lon, purpose, transport]);

  try {
    const result = await withCache(
      "places",
      cacheKey,
      async () => fetchPlacesWithFallback(lat, lon, purpose, transport),
      cacheTtls.places
    );

    sendJson(response, 200, {
      places: result.data.places,
      meta: {
        provider: result.data.provider,
        cache: result.cache,
        staleFallback: result.staleFallback,
        providerFailures: result.data.failures || []
      }
    });
  } catch (error) {
    sendError(
      response,
      502,
      "Nearby places lookup failed on all configured providers.",
      error?.details || []
    );
  }
}

async function serveStatic(requestUrl, response) {
  const relativePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(rootDir, normalized);

  if (!filePath.startsWith(rootDir)) {
    sendError(response, 403, "Forbidden.");
    return;
  }

  try {
    const stats = await fsp.stat(filePath);
    const finalPath = stats.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const extension = path.extname(finalPath).toLowerCase();

    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=300"
    });

    fs.createReadStream(finalPath).pipe(response);
  } catch {
    sendError(response, 404, "Not found.");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/api/weather") {
      await handleWeather(requestUrl, response);
      return;
    }

    if (requestUrl.pathname === "/api/geocode") {
      await handleGeocode(requestUrl, response);
      return;
    }

    if (requestUrl.pathname === "/api/places") {
      await handlePlaces(requestUrl, response);
      return;
    }

    if (requestUrl.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        providers: providerOrder,
        amapConfigured: Boolean(amapApiKey),
        overpassEndpoints
      });
      return;
    }

    await serveStatic(requestUrl, response);
  } catch (error) {
    sendError(response, 500, error?.message || "Internal server error.");
  }
});

server.listen(port, () => {
  console.log(`Server listening on http://127.0.0.1:${port}`);
});
