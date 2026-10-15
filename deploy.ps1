#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Script de despliegue de CloneForge en IIS (Windows).
.DESCRIPTION
    Instala dependencias npm, compila el frontend y lo copia a una carpeta
    dedicada bajo C:\inetpub (igual que el patron usado en QA Monitor), en vez
    de apuntar IIS directo a la carpeta del proyecto. Esto evita el 401 que
    da IIS cuando el proyecto vive bajo un perfil de usuario (p.ej.
    ...\Documents\...): esas carpetas excluyen por diseno a las identidades
    de IIS (IIS_IUSRS / IIS AppPool\*) en cada carpeta intermedia del camino,
    y dar permisos solo en la carpeta final (dist\) no alcanza porque IIS
    necesita permiso de transito en TODAS las carpetas del camino. C:\inetpub
    ya viene con permisos IIS-friendly de fabrica.

    El sitio se crea con un Host Header dedicado (ver -SiteHost) y una entrada
    en el archivo hosts apuntando a 127.0.0.1, tambien igual que QA Monitor.
    El backend Node.js se gestiona con PM2.
.PARAMETER SiteName
    Nombre del sitio y del Application Pool en IIS. Por defecto: CloneForge
.PARAMETER SiteHost
    Host Header del sitio (se agrega a el archivo hosts). Por defecto: cloneforge.local
.PARAMETER Port
    Puerto HTTP del sitio IIS. Por defecto: 80
.PARAMETER BackendPort
    Puerto del backend Node.js. Por defecto: 3001
.PARAMETER DeployPath
    Carpeta donde se copian los archivos compilados del frontend.
    Por defecto: C:\inetpub\<SiteName>
.PARAMETER AppPath
    Ruta raiz del proyecto (donde esta este script). Por defecto: directorio del script.
.EXAMPLE
    .\deploy.ps1
    .\deploy.ps1 -Port 8080 -SiteHost "cloneforge-test.local"
#>

param(
    [string] $SiteName    = "CloneForge",
    [string] $SiteHost    = "cloneforge.local",
    [int]    $Port        = 80,
    [int]    $BackendPort = 3001,
    [string] $DeployPath  = "",
    [string] $AppPath     = $PSScriptRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $DeployPath) { $DeployPath = "C:\inetpub\$SiteName" }

function Write-Step { param($msg) Write-Host "`n[>] $msg" -ForegroundColor Cyan    }
function Write-Ok   { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green  }
function Write-Warn { param($msg) Write-Host "    [!]  $msg" -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "    [X]  $msg" -ForegroundColor Red    }

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   CloneForge  -  Deploy a IIS            " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# --- 1. Verificar Node.js --------------------------------------------------
Write-Step "Verificando Node.js..."
try {
    $nodeVer = node --version 2>&1
    Write-Ok "Node.js $nodeVer encontrado."
} catch {
    Write-Err "Node.js no esta instalado. Descargalo desde https://nodejs.org"
    exit 1
}

# --- 2. Verificar IIS -------------------------------------------------------
Write-Step "Verificando IIS..."
try {
    $svc = Get-Service -Name W3SVC -ErrorAction Stop
    if ($svc.Status -ne "Running") { Start-Service W3SVC }
    Write-Ok "IIS activo."
} catch {
    Write-Warn "El servicio W3SVC no se encontro. Habilitando IIS..."
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, IIS-StaticContent, IIS-DefaultDocument -NoRestart | Out-Null
    Start-Service W3SVC
    Write-Ok "IIS habilitado."
}

Import-Module WebAdministration -ErrorAction Stop

# --- 3. Verificar URL Rewrite Module ----------------------------------------
Write-Step "Verificando URL Rewrite Module..."
$rewriteModule = Get-WebGlobalModule -Name "RewriteModule" -ErrorAction SilentlyContinue
if (-not $rewriteModule) {
    Write-Warn "URL Rewrite Module NO esta instalado."
    Write-Warn "Descargalo desde: https://www.iis.net/downloads/microsoft/url-rewrite"
    Write-Warn "El script continuara pero el sitio NO funcionara sin este modulo."
} else {
    Write-Ok "URL Rewrite Module encontrado."
}

# --- 4. Verificar Application Request Routing (ARR) -------------------------
Write-Step "Verificando Application Request Routing (ARR)..."
$arrPath = "C:\Program Files\IIS\Application Request Routing"
if (-not (Test-Path $arrPath)) {
    Write-Warn "ARR NO esta instalado. Sin ARR el proxy /api -> backend no funcionara."
    Write-Warn "Descargalo desde: https://www.iis.net/downloads/microsoft/application-request-routing"
} else {
    Write-Ok "ARR encontrado."
    try {
        Set-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" `
            -filter "system.webServer/proxy" -name "enabled" -value "True" | Out-Null
        Write-Ok "Proxy ARR habilitado a nivel servidor."
    } catch {
        Write-Warn "No se pudo habilitar el proxy ARR automaticamente. Hazlo en IIS Manager."
    }
}

# --- 5. Instalar dependencias npm -------------------------------------------
Write-Step "Instalando dependencias del backend..."
Push-Location "$AppPath\backend"
npm install --omit=dev
if ($LASTEXITCODE -ne 0) { Write-Err "npm install backend fallo."; exit 1 }
Write-Ok "Dependencias backend instaladas."
Pop-Location

Write-Step "Instalando dependencias del frontend..."
Push-Location "$AppPath\frontend"
npm install
if ($LASTEXITCODE -ne 0) { Write-Err "npm install frontend fallo."; exit 1 }
Write-Ok "Dependencias frontend instaladas."
Pop-Location

# --- 6. Compilar frontend ---------------------------------------------------
Write-Step "Compilando frontend (Vite build)..."
Push-Location "$AppPath\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Err "npm run build fallo."; exit 1 }
Write-Ok "Frontend compilado en frontend\dist\"
Pop-Location

$frontendDist = "$AppPath\frontend\dist"
if (-not (Test-Path $frontendDist)) {
    Write-Err "No se encontro: $frontendDist"
    exit 1
}

# --- 7. Crear / actualizar .env del backend ---------------------------------
Write-Step "Configurando .env del backend..."
$envFile = "$AppPath\backend\.env"
$frontendOrigin = if ($Port -eq 80) { "http://$SiteHost" } else { "http://${SiteHost}:$Port" }
if (-not (Test-Path $envFile)) {
    @"
PORT=$BackendPort
CORS_ORIGIN=$frontendOrigin
"@ | Set-Content $envFile -Encoding UTF8
    Write-Ok ".env creado en backend\.env"
} else {
    Write-Ok ".env ya existe, no se sobreescribio."
    Write-Warn "  Verifica que CORS_ORIGIN sea: $frontendOrigin"
}

# --- 8. Copiar el frontend compilado a $DeployPath ---------------------------
# Se copia a una carpeta dedicada bajo C:\inetpub en vez de apuntar IIS
# directo a frontend\dist dentro del proyecto -- ver explicacion al inicio
# del archivo (seccion .DESCRIPTION) sobre por que esto evita el 401.
Write-Step "Copiando frontend a $DeployPath ..."
if (Test-Path $DeployPath) {
    Write-Warn "Limpiando directorio existente..."
    Remove-Item -Recurse -Force $DeployPath
}
New-Item -ItemType Directory -Force -Path $DeployPath | Out-Null
Copy-Item -Recurse -Force "$frontendDist\*" $DeployPath
Write-Ok "Archivos copiados a $DeployPath"

# --- 9. Application Pool ------------------------------------------------------
Write-Step "Configurando Application Pool '$SiteName'..."
$poolPath = "IIS:\AppPools\$SiteName"
if (-not (Test-Path $poolPath)) {
    New-WebAppPool -Name $SiteName | Out-Null
    Write-Ok "Application Pool '$SiteName' creado."
} else {
    Write-Ok "Application Pool '$SiteName' ya existe."
}
Set-ItemProperty $poolPath managedRuntimeVersion ""
Set-ItemProperty $poolPath enable32BitAppOnWin64 $false

# --- 10. Sitio en IIS ---------------------------------------------------------
# Se elimina y recrea siempre (en vez de solo parchar physicalPath) para
# partir de un estado limpio y conocido en cada despliegue -- evita que
# configuraciones viejas (bindings, auth, etc.) queden pegadas entre corridas.
Write-Step "Creando sitio IIS '$SiteName'..."
$existingSite = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($existingSite) {
    Write-Warn "El sitio '$SiteName' ya existe. Eliminando para recrear..."
    Remove-Website -Name $SiteName
}
New-Website -Name $SiteName `
            -PhysicalPath $DeployPath `
            -ApplicationPool $SiteName `
            -Port $Port `
            -HostHeader $SiteHost | Out-Null
Start-Website -Name $SiteName
Write-Ok "Sitio '$SiteName' activo -> $DeployPath  (puerto $Port, host: $SiteHost)"

# --- 11. Permisos NTFS --------------------------------------------------------
Write-Step "Asignando permisos NTFS sobre $DeployPath ..."
$acl      = Get-Acl $DeployPath
$iusrRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "IIS_IUSRS", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow"
)
$poolRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "IIS AppPool\$SiteName", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow"
)
$acl.SetAccessRule($iusrRule)
$acl.SetAccessRule($poolRule)
Set-Acl -Path $DeployPath -AclObject $acl
Write-Ok "Permisos asignados a 'IIS_IUSRS' e 'IIS AppPool\$SiteName'."

# --- 12. Forzar autenticacion anonima en el sitio -----------------------------
# Un sitio nuevo hereda la configuracion de autenticacion del servidor. En
# servidores unidos a dominio con politicas corporativas, anonima suele venir
# deshabilitada o se exige Windows Authentication -> 401 al cargar la pagina,
# antes de llegar siquiera al proxy /api. Se fuerza aqui a nivel de sitio (no
# de servidor) para no afectar otros sitios en el mismo IIS.
Write-Step "Forzando autenticacion anonima en el sitio..."
try {
    Set-WebConfigurationProperty -pspath "IIS:\Sites\$SiteName" `
        -filter "system.webServer/security/authentication/anonymousAuthentication" `
        -name "enabled" -value "True"
    Write-Ok "Autenticacion anonima habilitada para '$SiteName'."
} catch {
    Write-Warn "No se pudo habilitar autenticacion anonima automaticamente: $_"
    Write-Warn "Hazlo manualmente en IIS Manager -> sitio -> Authentication -> Anonymous Authentication -> Enable."
}
try {
    Set-WebConfigurationProperty -pspath "IIS:\Sites\$SiteName" `
        -filter "system.webServer/security/authentication/windowsAuthentication" `
        -name "enabled" -value "False" -ErrorAction Stop | Out-Null
} catch {
    # El modulo de Windows Authentication puede no estar instalado en este
    # servidor; si la seccion no existe no hay nada que deshabilitar.
}

# --- 13. Archivo hosts ---------------------------------------------------------
Write-Step "Verificando entrada en hosts ($SiteHost)..."
$hostsFile    = "$env:SystemRoot\System32\drivers\etc\hosts"
$hostsContent = Get-Content $hostsFile -Raw
$hostEntry    = "127.0.0.1`t$SiteHost"
if ($hostsContent -notmatch [regex]::Escape($SiteHost)) {
    Add-Content -Path $hostsFile -Value "`r`n$hostEntry"
    Write-Ok "Entrada agregada: $hostEntry"
} else {
    Write-Ok "Entrada ya existe en hosts."
}

# --- 14. Configurar PM2 para el backend ---------------------------------------
Write-Step "Configurando PM2 para el backend..."
$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if ($null -eq $pm2) {
    Write-Warn "PM2 no esta instalado. Instalando globalmente..."
    npm install -g pm2
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "No se pudo instalar PM2. Usa start-backend.bat para iniciar el backend."
    } else {
        Write-Ok "PM2 instalado."
    }
}

$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2) {
    Push-Location "$AppPath\backend"
    # Eliminar proceso previo si existe (sin error si no existe) y arrancar limpio.
    # 2>&1 | Out-Null suprime stdout+stderr del ejecutable nativo (no nos importa el exit code aqui).
    pm2 delete cloneforge-backend 2>&1 | Out-Null
    pm2 start src/index.js --name cloneforge-backend
    if ($LASTEXITCODE -ne 0) { Write-Err "PM2 no pudo iniciar el backend."; Pop-Location; exit 1 }
    Write-Ok "Backend iniciado con PM2 (nombre: cloneforge-backend)"
    pm2 save
    Write-Ok "Lista PM2 guardada."
    Pop-Location
} else {
    Write-Warn "PM2 no disponible. Usa start-backend.bat para iniciar el backend manualmente."
}

# --- Resumen ----------------------------------------------------------------
$frontendUrl = if ($Port -eq 80) { "http://$SiteHost" } else { "http://${SiteHost}:$Port" }
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Despliegue completado                   " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Frontend (IIS) : $frontendUrl"                               -ForegroundColor Green
Write-Host "  Backend (PM2)  : http://localhost:$BackendPort/api/health"   -ForegroundColor Green
Write-Host "  Sitio IIS      : $SiteName  (puerto $Port, host: $SiteHost)" -ForegroundColor Green
Write-Host "  Carpeta        : $DeployPath"                                -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Proximos pasos:"                                                         -ForegroundColor Yellow
Write-Host "  1. Abre IIS Manager y verifica que [Enable proxy] este activo en ARR."  -ForegroundColor Yellow
Write-Host "  2. Navega a $frontendUrl para comprobar la aplicacion."                 -ForegroundColor Yellow
Write-Host "  3. Si el backend no arranco, ejecuta start-backend.bat"                 -ForegroundColor Yellow
Write-Host ""
