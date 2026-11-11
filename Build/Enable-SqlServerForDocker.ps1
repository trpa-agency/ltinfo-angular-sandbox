# One-time setup so Docker containers can reach the SQL Server installed on this machine.
#
# Containers cannot use Windows authentication and cannot use shared memory, so the
# instance needs two settings that are off after a default install. ESA's developer
# handoff asks for the same two (SQL Server Configuration Manager and SSMS do the
# same thing by hand):
#   1. TCP/IP enabled, listening on port 1433
#   2. Mixed-mode authentication (SQL logins as well as Windows logins)
# Then the service restarts. Nothing else changes: no firewall rule is added, so the
# port stays closed to other computers, and no login is created here
# (Build\DatabaseBuild.ps1 creates the sandbox's own least-privilege login).
#
# Run from any PowerShell window. It asks for administrator approval once.
#   powershell -File Build\Enable-SqlServerForDocker.ps1
# Undo with:   powershell -File Build\Enable-SqlServerForDocker.ps1 -Undo

param(
    [string] $InstanceName = 'MSSQLSERVER',
    [switch] $Undo
)

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    $arguments = @('-NoProfile', '-File', "`"$PSCommandPath`"", '-InstanceName', $InstanceName)
    if ($Undo) { $arguments += '-Undo' }
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments
    'Opened an administrator window. Approve the prompt and read the result there.'
    return
}

try {
    $instanceId = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL').$InstanceName
    if (-not $instanceId) { throw "No SQL Server instance named $InstanceName on this machine." }
    $key = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer"
    $tcp = "$key\SuperSocketNetLib\Tcp"
    $serviceName = if ($InstanceName -eq 'MSSQLSERVER') { 'MSSQLSERVER' } else { "MSSQL`$$InstanceName" }

    if ($Undo) {
        Set-ItemProperty -Path $tcp -Name Enabled -Value 0
        Set-ItemProperty -Path $key -Name LoginMode -Value 1
        "TCP/IP disabled and authentication set back to Windows only."
    }
    else {
        Set-ItemProperty -Path $tcp -Name Enabled -Value 1
        Set-ItemProperty -Path "$tcp\IPAll" -Name TcpPort -Value '1433'
        Set-ItemProperty -Path "$tcp\IPAll" -Name TcpDynamicPorts -Value ''
        Set-ItemProperty -Path $key -Name LoginMode -Value 2
        "TCP/IP enabled on port 1433 and authentication set to mixed mode."
    }

    "Restarting $serviceName ..."
    Restart-Service -Name $serviceName -Force
    Start-Sleep -Seconds 3
    "Service: " + (Get-Service -Name $serviceName).Status
    "Listening on 1433: " + [bool](Get-NetTCPConnection -LocalPort 1433 -State Listen -ErrorAction SilentlyContinue)
    'Done.'
}
catch {
    "Failed: $($_.Exception.Message)"
}
Read-Host 'Press Enter to close'
