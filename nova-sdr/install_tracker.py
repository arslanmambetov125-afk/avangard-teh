#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TARGETS=['catalog.html','product-chl-cpcd15.html','lizing.html']
TAG='<script src="nova-intent.js" defer></script>'

for name in TARGETS:
    p=ROOT/name
    if not p.exists():
        print('missing',name); continue
    s=p.read_text(encoding='utf-8')
    if TAG in s:
        print('already',name); continue
    if '</body>' not in s.lower():
        print('no body',name); continue
    idx=s.lower().rfind('</body>')
    s=s[:idx]+'    '+TAG+'\n'+s[idx:]
    p.write_text(s,encoding='utf-8')
    print('installed',name)
