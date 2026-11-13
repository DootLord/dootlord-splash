# Converts every PNG under posts/img/ to JPG and updates the posts that link to it.
# Pasted screenshots come in as large PNGs; as JPGs they're a fraction of the size.
#
#   powershell -ExecutionPolicy Bypass -File tools/jpg-images.ps1
#
# Transparent areas become the site's background colour. Keep images that need
# real transparency (logos etc.) outside posts/img/.

param([int]$Quality = 85)

Add-Type -AssemblyName System.Drawing
$posts = (Resolve-Path (Join-Path $PSScriptRoot '..\posts')).Path
$imgDir = Join-Path $posts 'img'
$utf8 = New-Object System.Text.UTF8Encoding $false
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$Quality)

$pngs = @(Get-ChildItem $imgDir -Recurse -Filter *.png -ErrorAction SilentlyContinue)
if (-not $pngs.Count) { Write-Host 'No PNGs to convert.'; return }

$renames = @()
foreach ($png in $pngs) {
  $jpgPath = [IO.Path]::ChangeExtension($png.FullName, '.jpg')
  if (Test-Path $jpgPath) { Write-Warning "Skipped $($png.Name): a .jpg with that name already exists."; continue }

  $src = [System.Drawing.Image]::FromFile($png.FullName)
  try {
    $bmp = New-Object System.Drawing.Bitmap $src.Width, $src.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#11151a'))
    $g.DrawImage($src, 0, 0, $src.Width, $src.Height)
    $g.Dispose()
    $bmp.Save($jpgPath, $jpeg, $params)
    $bmp.Dispose()
  } finally { $src.Dispose() }

  $before = $png.Length
  Remove-Item $png.FullName
  $after = (Get-Item $jpgPath).Length
  Write-Host ("{0}: {1:N0} KB -> {2:N0} KB" -f $png.Name, ($before / 1KB), ($after / 1KB))

  # path as a post would link it, e.g. img/my-post/image.png
  $rel = $png.FullName.Substring($posts.Length + 1).Replace('\', '/')
  $renames += ,@($rel, ($rel -replace '\.png$', '.jpg'))
}

# fix the links: plain, %20-encoded and <angle bracket> forms all contain the path
foreach ($md in Get-ChildItem $posts -Filter *.md) {
  $text = [IO.File]::ReadAllText($md.FullName, $utf8)
  $new = $text
  foreach ($r in $renames) {
    $new = $new.Replace($r[0], $r[1]).Replace($r[0].Replace(' ', '%20'), $r[1].Replace(' ', '%20'))
  }
  if ($new -ne $text) {
    [IO.File]::WriteAllText($md.FullName, $new, $utf8)
    Write-Host "Updated links in $($md.Name)"
  }
}
