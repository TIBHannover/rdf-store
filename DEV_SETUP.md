# RDF Store — Local Dev Setup & Data Import Guide

This document describes every step required to run the RDF Store locally and import the NFDI4ING example data. Follow the steps in order.

---

## Prerequisites

- Docker Desktop (running)
- Go 1.21+
- Node.js 18+
- PowerShell (Windows)

---

## 1. Environment Configuration

Copy `.env.example` to `.env` and set the following values:

```env
FUSEKI_PASSWORD="fuseki"           # or any password you choose
DISABLE_OAUTH=disable-oauth        # disables OAuth for local dev
LOCAL_PROFILES_ENABLED=true
MPS_ENABLED=true
CRON=0 0 * * *
RDF_NAMESPACE=https://w3id.org/nfdi4ing/resources/
```

### Important: RDF_NAMESPACE

The default value in `.env.example` is `http://example.org/`. This **must** be changed to match the namespace used by the resources you intend to import. For NFDI4ING resources the correct value is:

```
RDF_NAMESPACE=https://w3id.org/nfdi4ing/resources/
```

**Why this matters:** The frontend strips `RDF_NAMESPACE` from resource IRIs to build URL paths, then re-adds it when loading a resource. If the namespace does not match the resource IRIs, the frontend constructs wrong API URLs (e.g. `http://example.org/https://w3id.org/...`) causing 404 errors.

---

## 2. Start Docker Services

From the project root:

```bash
docker compose up -d
```

This starts: `fuseki` (port 3030), `solr` (search), `validator` (SHACL), `nginx`, `redis`.

Verify Fuseki is up before proceeding:

```bash
curl http://localhost:3030/$/ping
```

---

## 3. Stop the App Container

The `app` container runs the Go backend. Stop it so you can run the backend locally instead:

```bash
docker compose stop app
```

---

## 4. Start the Backend

Open a PowerShell terminal in the `backend/` directory and load all env vars before starting:

```powershell
Get-Content ..\.env | Where-Object { $_ -notmatch '^#' -and $_ -match '=' } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim().Trim('"'), 'Process')
}
go run .
```

The backend starts on port 3000. Watch the logs for:

```
syncing profiles finished  profiles=X  #new=X  ...
[GIN-debug] Listening and serving HTTP on :3000
```

Wait for the profile sync to complete before uploading any resources.

### Health check

```
GET http://127.0.0.1:3000/api/v1/healthz  → returns "ok"
GET http://127.0.0.1:3000/api/v1/config   → returns JSON config
```

---

## 5. Start the Frontend

Open a second PowerShell terminal in `frontend/`:

```powershell
npm install
npm run dev
```

Frontend is available at `http://localhost:5173`.

---

## 6. Load Missing SHACL Profiles (first-time setup)

The backend loads SHACL profiles from two sources:

- **Remote:** NFDI4ING Metadata Profile Service (MPS) — loaded automatically on startup
- **Local:** `backend/local/profiles/*.ttl` — loaded and synced on startup

Some profiles referenced by the example data are no longer published in MPS. These must be downloaded manually and placed in `backend/local/profiles/`.

### Download the missing profiles

Run the following in PowerShell (from any directory):

```powershell
$profiles = @(
    "c383ab31-35e7-4a5d-9aa3-3183e5e8dd15",
    "989aec4b-c1b8-4ded-ab73-62422ab04d9b",
    "21ed873c-44cd-4260-b94e-609202fc89c4",
    "0b36ec88-affd-4b8b-b7f9-5f4af1efdad1",
    "517c3f72-c8eb-4743-87bd-6f4c4f5f484c",
    "79f90fbf-654a-4231-8e9d-536888ae0334"
)
$outDir = "<absolute-path-to-project>\backend\local\profiles"

foreach ($id in $profiles) {
    $url = "https://w3id.org/nfdi4ing/profiles/$id/"
    try {
        $response = Invoke-WebRequest -Uri $url -Headers @{ Accept = "text/turtle" } -MaximumRedirection 5 -UseBasicParsing
        [System.IO.File]::WriteAllText("$outDir\$id.ttl", $response.Content)
        Write-Host "$id - OK"
    } catch {
        Write-Host "$id - FAIL: $($_.Exception.Message)"
    }
}
```

### Force profile sync on first run

By default the backend only syncs profiles automatically at midnight (`CRON=0 0 * * *`) when profiles already exist in Fuseki. On first run (empty Fuseki) it syncs immediately. On subsequent restarts with new local profile files, you must force a sync by temporarily clearing CRON:

```powershell
# In the backend terminal, stop go run . (Ctrl+C), then:
$env:CRON=""
go run .
```

Wait for:
```
syncing profiles finished  profiles=151  #new=112  ...
```

Then restore CRON for future runs by using the full env load command from step 4.

---

## 7. Upload Example Resources

Once profiles are loaded, upload the example `.ttl` resource files via the API.

The API endpoint is `POST /api/v1/resource` and expects the Turtle data as a **form field** named `ttl`.

```powershell
$endpoint = "http://127.0.0.1:3000/api/v1/resource"
$dir = "<path-to-ttl-files>"

Get-ChildItem "$dir\*.ttl" | ForEach-Object {
    $ttl = Get-Content $_.FullName -Raw
    try {
        $response = Invoke-WebRequest -Uri $endpoint -Method POST -Body @{ ttl = $ttl } -ContentType "application/x-www-form-urlencoded" -UseBasicParsing
        Write-Host "$($_.Name) - OK"
    } catch {
        Write-Host "$($_.Name) - FAIL ($($_.Exception.Response.StatusCode.value__))"
    }
}
```

**Common upload errors:**

| Error | Cause | Fix |
|---|---|---|
| 401 | Wrong `FUSEKI_PASSWORD` | Match password in `.env` with what Fuseki started with |
| 400 | Missing `ttl` form field | Send as form field, not raw body |
| 500 `no relation to an existing SHACL shape` | Profile not loaded yet | Wait for sync to finish or add missing local profile |
| 500 `graph already exists` | Resource was already uploaded | Use `PUT /api/v1/resource/<encoded-id>` to update instead |

---

## 8. File Changes Made

| File | Change |
|---|---|
| `.env` | `RDF_NAMESPACE` changed from `http://example.org/` to `https://w3id.org/nfdi4ing/resources/` |
| `backend/local/profiles/*.ttl` | 6 profile TTL files added (downloaded from `w3id.org`) |

---

## API Reference (key endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/healthz` | Liveness check |
| GET | `/api/v1/config` | Runtime config + auth info |
| POST | `/api/v1/resource` | Create resource (form field `ttl`) |
| GET | `/api/v1/resource/<encoded-iri>` | Get resource as Turtle |
| PUT | `/api/v1/resource/<encoded-iri>` | Update resource (form field `ttl`) |
| DELETE | `/api/v1/resource/<encoded-iri>` | Delete resource |
| POST | `/api/v1/sparql/query` | SPARQL query against resource dataset |
