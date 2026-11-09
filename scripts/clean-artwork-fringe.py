"""Remove pale matte fragments touching transparency without eroding dark outlines.

Apply to an RGBA cutout before publishing it. Only low-saturation, paper-toned
pixels on the outside edge are removed; interior colors and highlights stay intact.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--passes', type=int, default=2)
    args = parser.parse_args()
    pixels = np.array(Image.open(args.source).convert('RGBA'))
    rgb = pixels[:, :, :3].astype(np.int16)
    red, green, blue = rgb.transpose(2, 0, 1)
    maximum, minimum = rgb.max(axis=2), rgb.min(axis=2)
    pale_matte = ((maximum >= 90) & ((maximum - minimum) <= maximum * .28)
                  & (red >= green - 2) & (green >= blue - 2) & (red - blue <= 65))
    removed = 0
    for _ in range(args.passes):
        opaque = pixels[:, :, 3] > 0
        edge = opaque & ~ndimage.binary_erosion(opaque, structure=np.ones((3, 3)))
        fringe = edge & pale_matte
        removed += int(fringe.sum())
        pixels[fringe, 3] = 0
    pixels[pixels[:, :, 3] == 0, :3] = 0
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels).save(args.destination, 'WEBP', lossless=True, method=6)
    print(f'Removed {removed} pale edge pixels; saved {args.destination}')


if __name__ == '__main__':
    main()
