#!/usr/bin/env python3
"""Rigenera icona e splash di Cantina (richiede rsvg-convert). Uso: python3 resources/make_icons.py"""
import subprocess, pathlib, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
RES = ROOT / 'android/app/src/main/res'
BG, CREAM, WINE = '#7B1E3A', '#FBF3EE', '#A02C50'

GLASS = f'''<g transform="translate(0 2.5)">
  <path d="M39 24H69C69 43 63 55 54 55C45 55 39 43 39 24Z" fill="{CREAM}"/>
  <path d="M40.4 37H67.6C66.6 48 61.5 55 54 55C46.5 55 41.4 48 40.4 37Z" fill="{WINE}"/>
  <path d="M43.4 27C43.7 38 46 47 50 51.5" stroke="#fff" stroke-opacity=".6" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <rect x="52.9" y="54" width="2.2" height="21" rx="1.1" fill="{CREAM}"/>
  <rect x="43" y="74" width="22" height="3.2" rx="1.6" fill="{CREAM}"/>
</g>'''

def svg(w, h, body, vb=None):
    vb = vb or f'0 0 {w} {h}'
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">{body}</svg>'

def render(s, out, w, h):
    with tempfile.NamedTemporaryFile('w', suffix='.svg', delete=False) as f:
        f.write(s); t = f.name
    subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(h), '-o', str(out), t], check=True)

(ROOT / 'resources/icon-foreground.svg').write_text(svg(108, 108, GLASS))

D = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in D.items():
    out = RES / f'mipmap-{d}'
    render(svg(108, 108, GLASS), out / 'ic_launcher_foreground.png', int(108 * k), int(108 * k))
    n = int(48 * k)
    vb = '18 18 72 72'
    sq = svg(72, 72, f'<rect x="18" y="18" width="72" height="72" rx="15" fill="{BG}"/>{GLASS}', vb)
    rd = svg(72, 72, f'<circle cx="54" cy="54" r="36" fill="{BG}"/>{GLASS}', vb)
    render(sq, out / 'ic_launcher.png', n, n)
    render(rd, out / 'ic_launcher_round.png', n, n)

(RES / 'values/ic_launcher_background.xml').write_text(
    f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BG}</color>\n</resources>\n')

# Splash (Android < 12): sfondo bordeaux, calice al centro
def splash(w, h):
    s = min(w, h) * 0.34
    body = f'<rect width="{w}" height="{h}" fill="{BG}"/><g transform="translate({(w - s) / 2} {(h - s) / 2}) scale({s / 108})">{GLASS}</g>'
    return svg(w, h, body)
sizes = {'port-mdpi': (320, 480), 'port-hdpi': (480, 800), 'port-xhdpi': (720, 1280), 'port-xxhdpi': (960, 1600), 'port-xxxhdpi': (1280, 1920),
         'land-mdpi': (480, 320), 'land-hdpi': (800, 480), 'land-xhdpi': (1280, 720), 'land-xxhdpi': (1600, 960), 'land-xxxhdpi': (1920, 1280)}
for name, (w, h) in sizes.items():
    render(splash(w, h), RES / f'drawable-{name}/splash.png', w, h)
render(splash(480, 320), RES / 'drawable/splash.png', 480, 320)
print('ok')
