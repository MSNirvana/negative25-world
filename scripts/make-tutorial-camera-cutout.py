from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

source = Path('/tmp/nikon-z6iii.jpg')
target = Path('apps/web/public/tutorials/nikon-z6iii-cutout.png')
image = Image.open(source).convert('RGB')

# The source is a straight-on product photograph. Keep only the camera body;
# these points follow the visible silhouette in the 1920x1280 preview.
preview_width, preview_height = 1920, 1280
silhouette = [
    (382, 447), (391, 432), (410, 420), (420, 402), (438, 391),
    (454, 380), (744, 380), (766, 389), (865, 388), (875, 356),
    (906, 340), (927, 303), (954, 254), (982, 230), (1013, 220),
    (1163, 220), (1195, 230), (1222, 253), (1249, 303), (1268, 340),
    (1292, 346), (1306, 359), (1330, 352), (1370, 364), (1390, 380),
    (1480, 399), (1504, 415), (1520, 430), (1541, 447), (1533, 1027),
    (1518, 1045), (1430, 1052), (553, 1052), (466, 1045), (432, 1027),
    (421, 965), (414, 710), (403, 565),
]

width, height = image.size
scale_x, scale_y = width / preview_width, height / preview_height
mask = Image.new('L', (width, height), 0)
draw = ImageDraw.Draw(mask)
draw.polygon([(round(x * scale_x), round(y * scale_y)) for x, y in silhouette], fill=255)

# A small feather keeps the cutout edge clean without retaining the studio wall.
mask = mask.filter(ImageFilter.GaussianBlur(3))

image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
mask = mask.resize(image.size, Image.Resampling.LANCZOS)
result = image.convert('RGBA')
result.putalpha(mask)
box = mask.getbbox()
if box:
    result = result.crop(box)
result.thumbnail((1500, 1500), Image.Resampling.LANCZOS)
target.parent.mkdir(parents=True, exist_ok=True)
result.save(target, optimize=True)
print(target)
