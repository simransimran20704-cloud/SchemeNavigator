"""Generate high-resolution grid background matching the main website for the presentation."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

def create_grid_background(width=1920, height=1080, output_path="scripts/assets/website_bg_grid.png"):
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 1. Base image with clean neutral gradient (from slate-50 to white)
    img = Image.new("RGB", (width, height), (248, 250, 252))
    draw = ImageDraw.Draw(img)
    
    for y in range(height):
        t = y / float(height)
        r = int(248 + t * (255 - 248))
        g = int(250 + t * (255 - 250))
        b = int(252 + t * (255 - 252))
        draw.line([(0, y), (width, y)], fill=(r, g, b))
        
    # 2. Ambient glow orbs (soft cool sky and indigo with blur - zero green tint)
    glow_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    
    # Orb 1: Soft sky glow on left
    glow_draw.ellipse(
        [(int(width * 0.15), -100), (int(width * 0.45), 500)],
        fill=(56, 189, 248, 22)
    )
    # Orb 2: Soft indigo glow on right
    glow_draw.ellipse(
        [(int(width * 0.55), -80), (int(width * 0.85), 480)],
        fill=(99, 102, 241, 16)
    )
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=90))
    
    # Composite glow onto base
    img = Image.alpha_composite(img.convert("RGBA"), glow_layer).convert("RGB")
    draw = ImageDraw.Draw(img)
    
    # 3. Draw clean neutral slate grid lines (slate-200: 226, 232, 240)
    grid_color = (226, 232, 240)
    grid_size = 48
    
    for x in range(0, width, grid_size):
        draw.line([(x, 0), (x, height)], fill=grid_color, width=1)
        
    for y in range(0, height, grid_size):
        draw.line([(0, y), (width, y)], fill=grid_color, width=1)
        
    img.save(output_path, "PNG", quality=95)
    print(f"Generated {output_path} ({width}x{height})")
    return output_path

if __name__ == "__main__":
    create_grid_background()
