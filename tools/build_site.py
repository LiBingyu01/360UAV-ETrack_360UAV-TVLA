"""Stage only public website files. No third-party dependencies."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'_site'
OUT.mkdir(exist_ok=True)
for name in ['index.html','styles.css','app.js','sphere.js','trajectories.js','.nojekyll']:
    shutil.copy2(ROOT/name,OUT/name)
shutil.copytree(ROOT/'assets',OUT/'assets',dirs_exist_ok=True)
print('Static website staged at',OUT)
