$destDir = "f:\NhanDev_Entigravyti\QL_TKB_Nhan\public\models"
if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir
}

$files = @(
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "ssd_mobilenetv1_model-shard2",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

foreach ($f in $files) {
    $url = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/$f"
    $outPath = Join-Path $destDir $f
    Write-Host "Downloading $f from $url..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $outPath
        Write-Host "Success: $f"
    } catch {
        Write-Warning "Failed to download $f : $_"
    }
}
