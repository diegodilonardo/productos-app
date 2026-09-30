param(
    [string]$RutaScriptBackup = 'C:\productos-app\scripts\backup-productos-app.ps1',
    [string]$Usuario = "$env:USERDOMAIN\$env:USERNAME"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$rutaCompleta = [System.IO.Path]::GetFullPath($RutaScriptBackup)
if (-not (Test-Path -LiteralPath $rutaCompleta -PathType Leaf)) {
    throw "No se encontró el script de backup: $rutaCompleta"
}

$credencial = Get-Credential `
    -UserName $Usuario `
    -Message 'Ingrese la contraseña de la cuenta que ejecutará los backups de PRODUCTOS_APP.'

if (-not $credencial) {
    throw 'No se ingresaron credenciales. No se modificaron las tareas programadas.'
}

$usuarioTarea = $credencial.UserName
$passwordTarea = $credencial.GetNetworkCredential().Password
$rutaPowerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$directorioTrabajo = Split-Path -Parent $rutaCompleta
$configuracion = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$tareas = @(
    @{ Nombre = 'Backup SQL FULL'; Tipo = 'FULL'; Hora = '02:00' },
    @{ Nombre = 'Backup SQL DIFF 08'; Tipo = 'DIFF'; Hora = '08:00' },
    @{ Nombre = 'Backup SQL DIFF 14'; Tipo = 'DIFF'; Hora = '14:00' },
    @{ Nombre = 'Backup SQL DIFF 20'; Tipo = 'DIFF'; Hora = '20:00' }
)

foreach ($tarea in $tareas) {
    $argumentos = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -Tipo {1}' -f `
        $rutaCompleta, $tarea.Tipo
    $accion = New-ScheduledTaskAction `
        -Execute $rutaPowerShell `
        -Argument $argumentos `
        -WorkingDirectory $directorioTrabajo
    $disparador = New-ScheduledTaskTrigger -Daily -At $tarea.Hora

    Register-ScheduledTask `
        -TaskPath '\ProductosApp\' `
        -TaskName $tarea.Nombre `
        -Description "Backup $($tarea.Tipo) verificado de la base PRODUCTOS_APP." `
        -Action $accion `
        -Trigger $disparador `
        -Settings $configuracion `
        -User $usuarioTarea `
        -Password $passwordTarea `
        -RunLevel Highest `
        -Force | Out-Null
}

$passwordTarea = $null

Write-Host 'Tareas de backup instaladas correctamente:' -ForegroundColor Green
Get-ScheduledTask -TaskPath '\ProductosApp\' |
    Where-Object { $_.TaskName -like 'Backup SQL *' } |
    Sort-Object TaskName |
    Select-Object TaskName, State

Write-Host ''
Write-Host 'Próximo paso: ejecutar manualmente una tarea diferencial y revisar el log.'
