from PIL import Image, ImageDraw
import os

# Create icons folder if it doesn't exist
os.makedirs('icons', exist_ok=True)

# Colors
colors = ['#4CAF50', '#2196F3', '#FF9800']  # Green, Blue, Orange

# Create 3 sizes
sizes = [(16, 'icon16.png'), (48, 'icon48.png'), (128, 'icon128.png')]

for i, (size, filename) in enumerate(sizes):
    img = Image.new('RGB', (size, size), color=colors[i % len(colors)])
    draw = ImageDraw.Draw(img)
    
    # Draw a lock symbol
    lock_size = size // 2
    padding = size // 4
    draw.rectangle([padding, padding, size-padding, size-padding*1.5], 
                   fill='white', outline='black', width=1)
    draw.ellipse([size//2 - lock_size//4, padding*0.8, 
                  size//2 + lock_size//4, padding*1.5], 
                 fill='white', outline='black', width=1)
    
    img.save(f'icons/{filename}')
    print(f'Created: icons/{filename} ({size}x{size})')