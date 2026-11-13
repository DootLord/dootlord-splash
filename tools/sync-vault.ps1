# Publishes blog posts from an Obsidian vault into posts/.
#
#   powershell -ExecutionPolicy Bypass -File tools/sync-vault.ps1          # sync once
#   powershell -ExecutionPolicy Bypass -File tools/sync-vault.ps1 -Watch   # keep syncing as you write
#
# Setup: put the full path of the vault folder you write posts in into
# tools/vault-posts-path.txt (git-ignored), e.g.  C:\Users\me\Documents\My Vault\Blog Posts
#
# What it does:
#   - Notes named YYYY-MM-DD-title.md in that folder are posts. Anything else is a draft and is left alone.
#   - Each post is copied to posts/, with its images (![[x.png]] or ![](x.png), found anywhere
#     in the vault) saved to posts/img/<post-name>/ and the links rewritten to normal Markdown.
#   - PNG/BMP/TIFF images become JPGs. JPG, GIF, WebP and SVG are copied as they are.
#   - ![[x.png|Caption]] sets the caption, ![[x.png|400]] a max width in px.
#   - Obsidian's list-style properties (tags: on separate "- tag" lines) become "tags: a, b".
#   - The vault is the source of truth: a dated post deleted or renamed in the vault is removed
#     from posts/, and so are images a post no longer uses. Don't hand-edit dated posts in posts/.

param(
  [switch]$Watch,
  [int]$Quality = 85
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$posts = Join-Path $repo 'posts'
$imgRoot = Join-Path $posts 'img'
$configFile = Join-Path $PSScriptRoot 'vault-posts-path.txt'

if (-not (Test-Path -LiteralPath $configFile)) {
  throw "Put the full path of your vault's blog folder in $configFile"
}
$source = (Get-Content -LiteralPath $configFile -TotalCount 1).Trim().Trim('"')
if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "Blog folder not found: $source" }
$source = (Resolve-Path -LiteralPath $source).Path

# the vault root is the nearest folder holding .obsidian; images can live anywhere under it
$vault = $source
while ($vault -and -not (Test-Path -LiteralPath (Join-Path $vault '.obsidian'))) { $vault = Split-Path $vault -Parent }
if (-not $vault) { $vault = $source }

$utf8 = New-Object System.Text.UTF8Encoding $false
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$jpegParams = New-Object System.Drawing.Imaging.EncoderParameters 1
$jpegParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$Quality)

$CONVERT = '.png', '.bmp', '.tif', '.tiff'
$IMAGES = $CONVERT + '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg'
$POST_NAME = '^\d{4}-\d{2}-\d{2}-.+\.md$'
$POST_DIR = '^\d{4}-\d{2}-\d{2}-'
$CODE = '(?m)(^(?:```|~~~)[\s\S]*?^(?:```|~~~)|`[^`\n]*`)'

function Log([string]$msg) { Write-Host ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $msg) }
# warnings print once, not on every sync while watching
$warned = @{}
function Warn([string]$msg) { if (-not $script:warned.ContainsKey($msg)) { $script:warned[$msg] = $true; Log $msg } }
function Rel([string]$path) { $path.Substring($repo.Length + 1) }
function Esc([string]$s) { $s.Replace('&', '&amp;').Replace('"', '&quot;').Replace('<', '&lt;').Replace('>', '&gt;') }

function Get-VaultImages {
  $index = @{}
  Get-ChildItem -LiteralPath $vault -Recurse -File |
    Where-Object { $IMAGES -contains $_.Extension.ToLower() -and $_.FullName -notmatch '\\\.(obsidian|trash)\\' } |
    ForEach-Object {
      $key = $_.Name.ToLower()
      if (-not $index.ContainsKey($key)) { $index[$key] = @() }
      $index[$key] += $_.FullName
    }
  $index
}

# Obsidian finds an embed by path relative to the note, the vault root, or just by file name
function Resolve-Image([string]$ref) {
  $ref = $ref.Trim()
  if ($ref -match '^[a-z][a-z0-9+.-]*:' -or $ref.StartsWith('/')) { return $null }
  try { $ref = [Uri]::UnescapeDataString($ref) } catch { }
  $ref = $ref.Replace('/', '\')
  foreach ($base in $script:ctx.Dir, $vault) {
    $p = [IO.Path]::Combine($base, $ref)
    if (Test-Path -LiteralPath $p -PathType Leaf) { return (Resolve-Path -LiteralPath $p).Path }
  }
  $hits = $script:ctx.Index[[IO.Path]::GetFileName($ref).ToLower()]
  if ($hits) { return $hits[0] }
  $null
}

function Get-SafeName([string]$file) {
  $base = ([IO.Path]::GetFileNameWithoutExtension($file).ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
  if (-not $base) { $base = 'image' }
  $ext = [IO.Path]::GetExtension($file).ToLower()
  if ($CONVERT -contains $ext -or $ext -eq '.jpeg') { $ext = '.jpg' }
  $base + $ext
}

function Export-Image([string]$src, [string]$dest) {
  if ((Test-Path -LiteralPath $dest) -and
      (Get-Item -LiteralPath $dest).LastWriteTimeUtc -ge (Get-Item -LiteralPath $src).LastWriteTimeUtc) { return }
  if ($CONVERT -contains [IO.Path]::GetExtension($src).ToLower()) {
    $img = [System.Drawing.Image]::FromFile($src)
    try {
      $bmp = New-Object System.Drawing.Bitmap $img.Width, $img.Height
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#11151a'))   # transparent areas -> site panel colour
      $g.DrawImage($img, 0, 0, $img.Width, $img.Height)
      $g.Dispose()
      $bmp.Save($dest, $jpegCodec, $jpegParams)
      $bmp.Dispose()
    } finally { $img.Dispose() }
    Log ("  image  {0}  ({1:N0} KB -> {2:N0} KB)" -f (Rel $dest), ((Get-Item -LiteralPath $src).Length / 1KB), ((Get-Item -LiteralPath $dest).Length / 1KB))
  } else {
    Copy-Item -LiteralPath $src -Destination $dest -Force
    Log "  image  $(Rel $dest)"
  }
}

# copies one image into the post's folder (once) and returns its link
function Add-PostImage([string]$src) {
  $c = $script:ctx
  if ($c.Map.ContainsKey($src)) { return $c.Map[$src] }
  $name = Get-SafeName $src
  $base = [IO.Path]::GetFileNameWithoutExtension($name)
  $ext = [IO.Path]::GetExtension($name)
  $n = 1
  while ($c.Taken.Contains($name)) { $n++; $name = "$base-$n$ext" }
  [void]$c.Taken.Add($name)
  $dir = Join-Path $imgRoot $c.Slug
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  Export-Image $src (Join-Path $dir $name)
  $url = "img/$($c.SlugUrl)/$name"
  $c.Map[$src] = $url
  $url
}

function Format-Image([string]$url, [string]$alt, [string]$width, [string]$title) {
  if ($width) { return "<img src=`"$url`" alt=`"$(Esc $alt)`" style=`"width:${width}px`">" }
  "![$alt]($url$title)"
}

# ![[name.png#anchor|Caption|400]]  or  ![Caption|400](path "title"), in one pass
$IMAGE_LINK = '!\[\[(?<wname>[^\]|#]+)(?:#[^\]|]*)?(?<wopts>(?:\|[^\]|]*)*)\]\]' +
              '|!\[(?<alt>[^\]\n]*)\]\(\s*(?<ref><[^>\n]+>|[^)\s]+)(?<title>\s+"[^"\n]*")?\s*\)'
$imageLink = [System.Text.RegularExpressions.MatchEvaluator] {
  param($m)
  if ($m.Groups['wname'].Success) { Convert-WikiImage $m } else { Convert-MdImage $m }
}

function Convert-WikiImage($m) {
  $name = $m.Groups['wname'].Value.Trim()
  if ($IMAGES -notcontains [IO.Path]::GetExtension($name).ToLower()) {
    Warn "  note   $($script:ctx.Slug): embed ![[$name]] isn't an image, left as is"
    return $m.Value
  }
  $src = Resolve-Image $name
  if (-not $src) { Warn "  WARN   $($script:ctx.Slug): can't find $name in the vault"; return $m.Value }
  $alt = ''; $width = ''
  foreach ($o in ($m.Groups['wopts'].Value -split '\|' | Select-Object -Skip 1)) {
    $o = $o.Trim()
    if ($o -match '^(\d+)(x\d+)?$') { $width = $Matches[1] } elseif ($o) { $alt = $o }
  }
  Format-Image (Add-PostImage $src) $alt $width ''
}

function Convert-MdImage($m) {
  $alt = $m.Groups['alt'].Value
  $ref = $m.Groups['ref'].Value.Trim('<', '>')
  $title = $m.Groups['title'].Value
  if ($ref -match '^([a-z][a-z0-9+.-]*:|/|#)') { return $m.Value }
  $src = Resolve-Image $ref
  if (-not $src) { Warn "  WARN   $($script:ctx.Slug): can't find $ref in the vault"; return $m.Value }
  $width = ''
  if ($alt -match '^(.*?)\|(\d+)(x\d+)?$') { $alt = $Matches[1]; $width = $Matches[2] }
  Format-Image (Add-PostImage $src) $alt $width $title
}

# Obsidian writes list properties as "tags:\n  - a\n  - b"; the blog reads "tags: a, b"
function Convert-FrontMatter([string]$text) {
  $m = [regex]::Match($text, '^\uFEFF?---\n([\s\S]*?)\n---(\n|$)')
  if (-not $m.Success) { return $text }
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($line in ($m.Groups[1].Value -split '\n')) {
    $item = [regex]::Match($line, '^\s+-\s*(.*)$')
    if ($item.Success -and $lines.Count) {
      $v = $item.Groups[1].Value.Trim().Trim('"', "'")
      $last = $lines[$lines.Count - 1]
      if ($last -match ':\s*$') { $lines[$lines.Count - 1] = $last.TrimEnd() + ' ' + $v }
      else { $lines[$lines.Count - 1] = $last + ', ' + $v }
    } else { $lines.Add($line) }
  }
  "---`n" + ($lines -join "`n") + "`n---`n" + $text.Substring($m.Length)
}

function Convert-Post($note, $index) {
  $slug = $note.BaseName
  $script:ctx = @{
    Slug    = $slug
    SlugUrl = [Uri]::EscapeDataString($slug)
    Dir     = $note.DirectoryName
    Index   = $index
    Map     = @{}
    Taken   = New-Object 'System.Collections.Generic.HashSet[string]'
  }
  $text = [IO.File]::ReadAllText($note.FullName, $utf8).Replace("`r`n", "`n")
  $text = Convert-FrontMatter $text

  # leave code alone; rewrite images everywhere else
  $parts = [regex]::Split($text, $CODE)
  for ($i = 0; $i -lt $parts.Count; $i += 2) {
    $p = [regex]::Replace($parts[$i], $IMAGE_LINK, $imageLink)
    # an image alone on its line is its own block, so the site frames it
    $p = [regex]::Replace($p, '(?m)^[ \t]*(!\[[^\]\n]*\]\(img/[^\n]*\)|<img src="img/[^\n]*>)[ \t]*$', "`n`$1`n")
    $parts[$i] = [regex]::Replace($p, '\n{3,}', "`n`n")
  }
  $out = $parts -join ''

  $dest = Join-Path $posts $note.Name
  $old = $null
  if (Test-Path -LiteralPath $dest) { $old = [IO.File]::ReadAllText($dest, $utf8) }
  if ($out -cne $old) {
    [IO.File]::WriteAllText($dest, $out, $utf8)
    Log "  post   $(Rel $dest)"
  }

  $dir = Join-Path $imgRoot $slug
  if (Test-Path -LiteralPath $dir) {
    Get-ChildItem -LiteralPath $dir -File | Where-Object { -not $script:ctx.Taken.Contains($_.Name) } | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName
      Log "  gone   $(Rel $_.FullName)"
    }
    if (-not (Get-ChildItem -LiteralPath $dir)) { Remove-Item -LiteralPath $dir }
  }
}

function Sync {
  $index = Get-VaultImages
  $notes = @(Get-ChildItem -LiteralPath $source -Filter *.md -File | Where-Object { $_.Name -match $POST_NAME })
  $slugs = @{}
  foreach ($note in $notes) {
    $slugs[$note.BaseName] = $true
    try { Convert-Post $note $index }
    catch { Log "  WARN   $($note.Name): $($_.Exception.Message) (will retry on the next change)" }
  }

  # an empty folder more likely means a wrong path than "delete every post"
  if (-not $notes.Count) { Log "No dated posts found in $source, nothing removed."; return }
  Get-ChildItem -LiteralPath $posts -Filter *.md -File |
    Where-Object { $_.Name -match $POST_NAME -and -not $slugs.ContainsKey($_.BaseName) } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName; Log "  gone   $(Rel $_.FullName)" }
  if (Test-Path -LiteralPath $imgRoot) {
    Get-ChildItem -LiteralPath $imgRoot -Directory |
      Where-Object { $_.Name -match $POST_DIR -and -not $slugs.ContainsKey($_.Name) } |
      ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse; Log "  gone   $(Rel $_.FullName)" }
  }
}

Log "Syncing $source -> $(Rel $posts)"
Sync
Log 'Done.'
if (-not $Watch) { return }

$watcher = New-Object System.IO.FileSystemWatcher $vault
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
foreach ($e in 'Changed', 'Created', 'Deleted', 'Renamed') {
  Register-ObjectEvent -InputObject $watcher -EventName $e -SourceIdentifier "vault-$e" | Out-Null
}
Log 'Watching the vault. Ctrl+C to stop.'
try {
  while ($true) {
    if (-not (Wait-Event -Timeout 5)) { continue }
    # Obsidian saves every couple of seconds while typing: wait for a quiet second, then sync once
    $relevant = $false
    do {
      Get-Event | ForEach-Object {
        if ($_.SourceEventArgs.FullPath -notmatch '\\\.(obsidian|trash)(\\|$)') { $relevant = $true }
        Remove-Event -EventIdentifier $_.EventIdentifier
      }
    } while (Wait-Event -Timeout 1)
    if ($relevant) { Sync }
  }
} finally {
  Get-EventSubscriber | Where-Object { $_.SourceIdentifier -like 'vault-*' } | Unregister-Event
  $watcher.Dispose()
}
