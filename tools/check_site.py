"""Validate static/dynamic assets and GitHub Pages upload sizes."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,re
ROOT=Path(__file__).resolve().parent.parent
class Assets(HTMLParser):
    def __init__(self):super().__init__();self.paths=[]
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key in ['src','href'] and value:
                p=urlsplit(value)
                if not p.scheme and not p.netloc and p.path:self.paths.append(unquote(p.path))
parser=Assets();parser.feed((ROOT/'index.html').read_text(encoding='utf-8'))
for path in parser.paths:
    assert not path.startswith('/'),'Use repository-relative URLs: '+path
    assert (ROOT/path).is_file(),'Missing linked asset: '+path
manifest=json.loads((ROOT/'assets/media-manifest.json').read_text(encoding='utf-8'))
assert len(manifest)==8
for scene in manifest:
    key=scene['id']
    for path in [f'assets/videos/{key}.mp4',f'assets/posters/{key}.jpg',f'assets/trajectories/{key}.json',f'assets/trajectory-figures/{key}.pdf']:
        assert (ROOT/path).is_file(),'Missing dynamic asset: '+path
    d=json.loads((ROOT/f'assets/trajectories/{key}.json').read_text())
    assert len(d['predicted_uav_displacements_m'])==scene['frames']
    assert scene['uav_action_prediction_horizon_s']==1
for key in ['a1','a4','b2','b4','a2','b1']:
    assert (ROOT/f'assets/videos/hero/{key}.mp4').is_file()
forward=json.loads((ROOT/'assets/front-view-manifest.json').read_text(encoding='utf-8'))
assert len(forward['scenes'])==8 and len(forward['hero_composites'])==6
for scene in forward['scenes']:
    assert (ROOT/scene['forward']).is_file()
    assert (ROOT/f"assets/posters/front/{scene['id']}.jpg").is_file()
    original=next(item for item in manifest if item['id']==scene['id'])
    assert original['frames']==scene['frames'], 'Forward video frame mismatch'
for scene in forward['hero_composites']:
    assert (ROOT/scene['path']).is_file()

files=[p for p in ROOT.rglob('*') if p.is_file() and not set(p.relative_to(ROOT).parts)&{'.git','_site'}]
for p in files:assert p.stat().st_size<100*1024**2,'File exceeds regular Git limit: '+str(p)
public=[p for p in (ROOT/'assets').rglob('*') if p.is_file()]+[ROOT/n for n in ['index.html','styles.css','app.js','sphere.js','trajectories.js']]
size=sum(p.stat().st_size for p in public)
assert size<1_000_000_000,'Published site exceeds 1 GB'
for file in ['index.html','app.js','sphere.js','trajectories.js']:
    text=(ROOT/file).read_text(encoding='utf-8')
    assert not re.search(r'(?:http://(?:127\.0\.0\.1|localhost)|file:///|[A-Z]:[\\/])',text),'Local-only runtime path in '+file
largest=max(files,key=lambda p:p.stat().st_size)
print(json.dumps({'status':'passed','scenes':8,'frames':sum(m['frames'] for m in manifest),'public_site_bytes':size,'largest_file':largest.relative_to(ROOT).as_posix(),'largest_file_bytes':largest.stat().st_size,'html_asset_references':len(parser.paths)},indent=2))
