#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Script de despliegue de CloneForge en IIS (Windows).
.DESCRIPTION
    Instala dependencias, compila el frontend y crea el sitio IIS
    apuntando a la carpeta dist/. El backend Node.js se gestiona con PM2.
.PARAMETER SiteName
    Nombre del sitio en IIS. Por defecto: CloneForge
.PARAMETER Port
    Puerto HTTP del sitio IIS. Por defecto: 80
.PARAMETER BackendPort
    Puerto del backend Node.js. Por defecto: 3001
.PARAMETER AppPath
    Ruta raiz del proyecto. Por defecto: directorio donde se ejecuta el script.
.EXAMPLE
    .\deploy.ps1
    .\deploy.ps1 -Port 8080 -SiteName "CloneForge-Dev"
#>

param(
    [string] $SiteName    = "CloneForge",
    [int]    $Port        = 80,
    [int]    $BackendPort = 3001,
    [string] $AppPath     = $PSScriptRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Colores de consola ───────────────────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "`n[>] $msg" -ForegroundColor Cyan    }
function Write-Ok    { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green  }
function Write-Warn  { param($msg) Write-Host "    [!]  $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "    [X]  $msg" -ForegroundColor Red    }

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      CloneForge  –  Deploy a IIS       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan

# ─── 1. Verificar Node.js ─────────────────────────────────────────────────────
Write-Step "Verificando Node.js..."
try {
    $nodeVer = node --version 2>&1
    Write-Ok "Node.js $nodeVer encontrado."
} catch {
    Write-Err "Node.js no está instalado. Descárgalo desde https://nodejs.org"
    exit 1
}

# ─── 2. Verificar IIS ────────────────────────────────────────────────────────
Write-Step "Verificando IIS..."
try {
    $svc = Get-Service -Name W3SVC -ErrorAction Stop
    if ($svc.Status -ne "Running") { Start-Service W3SVC }
    Write-Ok "IIS activo."
} catch {
    Write-Warn "El servicio W3SVC no se encontró. Habilitando IIS..."
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, IIS-StaticContent -NoRestart | Out-Null
    Start-Service W3SVC
    Write-Ok "IIS habilitado."
}

Import-Module WebAdministration -ErrorAction Stop

# ─── 3. Verificar URL Rewrite Module ─────────────────────────────────────────
Write-Step "Verificando URL Rewrite Module..."
$rewriteDll = "C:\Windows\System32\inetsrv\rewrite.dll"
if (-not (Test-Path $rewriteDll)) {
    Write-Warn "URL Rewrite Module NO está instalado."
    Write-Warn "Descárgalo desde: https://www.iis.net/downloads/microsoft/url-rewrite"
    Write-Warn "El script continuará pero el sitio NO funcionará correctamente sin este módulo."
} else {
    Write-Ok "URL Rewrite Module encontrado."
}

# ─── 4. Verificar Application Request Routing (ARR) ──────────────────────────
Write-Step "Verificando Application Request Routing (ARR)..."
$arrPath = "C:\Program Files\IIS\Application Request Routing"
if (-not (Test-Path $arrPath)) {
    Write-Warn "ARR NO está instalado. Sin ARR el proxy /api → backend no funcionará."
    Write-Warn "Descárgalo desde: https://www.iis.net/downloads/microsoft/application-request-routing"
} else {
    Write-Ok "ARR encontrado."
    # Habilitar proxy a nivel de servidor (necesario para el rewrite hacia http://)
    try {
        Set-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" `
            -filter "system.webServer/proxy" -name "enabled" -value "True" | Out-Null
        Write-Ok "Proxy ARR habilitado a nivel servidor."
    } catch {
        Write-Warn "No se pudo habilitar el proxy ARR automáticamente. Hazlo manualmente en IIS Manager."
    }
}

# ─── 5. Instalar dependencias npm ────────────────────────────────────────────
Write-Step "Instalando dependencias del backend..."
Push-Location "$AppPath\backend"
npm install --omit=dev
if ($LASTEXITCODE -ne 0) { Write-Err "npm install backend falló."; exit 1 }
Write-Ok "Dependencias backend instaladas."
Pop-Location

Write-Step "Instalando dependencias del frontend..."
Push-Location "$AppPath\frontend"
npm install
if ($LASTEXITCODE -ne 0) { Write-Err "npm install frontend falló."; exit 1 }
Write-Ok "Dependencias frontend instaladas."
Pop-Location

# ─── 6. Compilar frontend ────────────────────────────────────────────────────
Write-Step "Compilando frontend (Vite build)..."
Push-Location "$AppPath\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Err "npm run build falló."; exit 1 }
Write-Ok "Frontend compilado en frontend\dist\"
Pop-Location

# ─── 7. Crear / actualizar .env del backend ──────────────────────────────────
Write-Step "Configurando .env del backend..."
$envFile = "$AppPath\backend\.env"
if (-not (Test-Path $envFile)) {
    $frontendOrigin = if ($Port -eq 80) { "http://localhost" } else { "http://localhost:$Port" }
    @"
PORT=$BackendPort
CORS_ORIGIN=$frontendOrigin
"@ | Set-Content $envFile -Encoding UTF8
    Write-Ok ".env creado en backend\.env"
} else {
    Write-Ok ".env ya existe — no se sobreescribió. Verifica que CORS_ORIGIN sea correcto."
    Write-Warn "  CORS_ORIGIN debe apuntar al frontend: http://localhost$(if ($Port -ne 80) {":$Port"})"
}

# ─── 8. Crear Application Pool en IIS ────────────────────────────────────────
Write-Step "Configurando Application Pool en IIS..."
$poolName = $SiteName
if (-not (Test-Path "IIS:\AppPools\$poolName")) {
    New-WebAppPool -Name $poolName | Out-Null
    Set-ItemProperty "IIS:\AppPools\$poolName" managedRuntimeVersion ""  # Sin .NET (Node es externo)
    Write-Ok "Application Pool '$poolName' creado."
} else {
    Write-Ok "Application Pool '$poolName' ya existe."
}

# ─── 9. Crear sitio en IIS ───────────────────────────────────────────────────
Write-Step "Configurando sitio IIS '$SiteName' en puerto $Port..."
$distPath = "$AppPath\frontend\dist"

if (Test-Path "IIS:\Sites\$SiteName") {
    Write-Warn "El sitio '$SiteName' ya existe. Actualizando ruta física..."
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $distPath
    Write-Ok "Ruta del sitio actualizada a: $distPath"
} else {
    New-Website -Name $SiteName `
                -Port $Port `
                -PhysicalPath $distPath `
                -ApplicationPool $poolName | Out-Null
    Write-Ok "Sitio '$SiteName' creado → $distPath  (puerto $Port)"
}

# Garantizar que el pool tenga permisos de lectura sobre dist/
$acl = Get-Acl $distPath
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "IIS AppPool\$poolName", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow"
)
$acl.SetAccessRule($rule)
Set-Acl $distPath $acl
Write-Ok "Permisos de lectura asignados al pool '$poolName' sobre dist\"

# ─── 10. Configurar PM2 para el backend ──────────────────────────────────────
Write-Step "Configurando PM2 para el backend..."
$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if ($null -eq $pm2) {
    Write-Warn "PM2 no está instalado. Instalando globalmente..."
    npm install -g pm2
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "No se pudo instalar PM2. Inicia el backend manualmente con start-backend.bat"
    } else {
        Write-Ok "PM2 instalado."
    }
}

$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2) {
    Push-Location "$AppPath\backend"
    pm2 describe cloneforge-backend 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        pm2 start src/index.js --name cloneforge-backend
        Write-Ok "Backend iniciado con PM2 (nombre: cloneforge-backend)"
    } else {
        pm2 restart cloneforge-backend
        Write-Ok "Backend reiniciado con PM2."
    }
    # Guardar lista PM2 para que sobreviva reinicios con pm2-startup
    pm2 save
    Write-Ok "Lista PM2 guardada."
    Pop-Location
} else {
    Write-Warn "PM2 no disponible. Usa start-backend.bat para iniciar el backend manualmente."
}

# ─── 11. Iniciar / reiniciar sitio IIS ───────────────────────────────────────
Write-Step "Iniciando sitio IIS..."
Start-Website -Name $SiteName -ErrorAction SilentlyContinue
Write-Ok "Sitio IIS iniciado."

# ─── Resumen ─────────────────────────────────────────────────────────────────
$frontendUrl = if ($Port -eq 80) { "http://localhost" } else { "http://localhost:$Port" }
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Despliegue completado                                     ║" -ForegroundColor Green
Write-Host "╠════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Frontend (IIS) : $frontendUrl" -ForegroundColor Green
Write-Host "║  Backend (PM2)  : http://localhost:$BackendPort/api/health" -ForegroundColor Green
Write-Host "║  Sitio IIS      : $SiteName  (puerto $Port)" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Próximos pasos:" -ForegroundColor Yellow
Write-Host "  1. Abre IIS Manager y verifica que 'Enable proxy' esté activo en ARR." -ForegroundColor Yellow
Write-Host "  2. Navega a $frontendUrl para comprobar la aplicación." -ForegroundColor Yellow
Write-Host "  3. Si el backend no arrancó automáticamente, ejecuta start-backend.bat" -ForegroundColor Yellow
Write-Host ""
