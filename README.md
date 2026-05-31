# Today Planner

This project runs behind a small Node.js server instead of opening `index.html` directly.

## Local Preview

Recommended:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-preview.ps1
```

Optional `.env` support:

```text
AMAP_API_KEY=your_key_here
PLACE_PROVIDERS=amap,overpass
```

Or run the server directly:

```powershell
node .\server.js
```

Default local URL:

```text
http://127.0.0.1:4173
```

## Why This Changed

The browser page needs to call weather and nearby-places APIs. Opening the page with `file:///.../index.html` often causes `Failed to fetch` because browsers block or limit cross-origin network requests from local files.

The Node server fixes that by:

- serving the frontend over `http://`
- exposing same-origin API routes:
- `/api/weather`
- `/api/geocode`
- `/api/places`
- proxying requests to third-party services on the server side

## Deploy To The Internet

This app can be deployed to any Node host that supports a `start` command, for example:

- Render
- Railway
- Fly.io
- a VPS running Node.js

The server reads `PORT` automatically in hosted environments.

## Public Deployment Checklist

1. Push this folder to a Git repository.
2. Create a new web service on your hosting platform.
3. Use:

```text
Build command: none
Start command: node server.js
```

4. After deployment, open the provided `https://...` URL.

## Render-Ready Setup

This repo now includes:

- `render.yaml`
- `npm start`
- `/health` health check

Recommended Render flow:

1. Push the project to GitHub.
2. In Render, choose `New +` -> `Blueprint`.
3. Select the repository that contains this project.
4. Render will detect `render.yaml` and create the web service.
5. In the service dashboard, set:

```text
AMAP_API_KEY=your_amap_web_service_key
```

6. Deploy, then open the generated `https://<service>.onrender.com` URL.

Notes:

- `AMAP_API_KEY` is marked with `sync: false` in `render.yaml`, so you should provide it in the Render dashboard instead of committing it.
- Render provides the `PORT` environment variable automatically for web services, and this server already reads it.

## Notes

- Nearby places depend on OpenStreetMap / Overpass data, so results vary by city.
- If nearby-place lookup fails, weather and meal recommendations still work.

## Robust Nearby-Places Mode

The server supports a provider chain and short-term cache for nearby-place lookup.

Default provider order:

```text
amap,overpass
```

Configuration:

```text
AMAP_API_KEY=your_amap_web_service_key
PLACE_PROVIDERS=amap,overpass
OVERPASS_ENDPOINTS=https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter,https://lz4.overpass-api.de/api/interpreter
```

Behavior:

- If `AMAP_API_KEY` is set, the server tries AMap first.
- If AMap is unavailable or not configured, it falls back to public Overpass instances.
- Nearby-place responses are cached in memory for 10 minutes.
- If providers fail after a successful cached lookup, the server can return stale cached places as a fallback.

Reference docs:

- AMap place around search: [高德地图 Web 服务 API](https://lbs.amap.com/api/webservice/guide/api/search/)
- Overpass public instances and usage notes: [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
