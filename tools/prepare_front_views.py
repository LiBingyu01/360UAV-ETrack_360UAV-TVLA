from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import json, subprocess, time, os, shutil

ROOT = Path(__file__).resolve().parents[1]
FFMPEG = Path(os.environ.get('FFMPEG') or shutil.which('ffmpeg') or 'ffmpeg')
FFPROBE = Path(os.environ.get('FFPROBE') or shutil.which('ffprobe') or 'ffprobe')
OUT = ROOT/'assets/videos/front'
POSTERS = ROOT/'assets/posters/front'
HERO = ROOT/'assets/videos/hero-composited'
for directory in [OUT, POSTERS, HERO]: directory.mkdir(exist_ok=True)

def run(args):
    result = subprocess.run([str(FFMPEG), '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', *args], capture_output=True, text=True)
    if result.returncode: raise RuntimeError(result.stderr)

def info(path):
    result = subprocess.run([str(FFPROBE), '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_read_frames,r_frame_rate:format=duration,size', '-of', 'json', str(path)], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)

def encode_scene(key):
    source = ROOT/f'assets/videos/{key}.mp4'
    destination = OUT/f'{key}.mp4'
    projection='v360=input=equirect:output=flat:h_fov=90:v_fov=58.715507:w=480:h=270:interp=linear'
    run(['-threads','2','-filter_threads','1','-i',str(source),'-vf',projection,'-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',str(destination)])
    run(['-i',str(ROOT/f'assets/posters/{key}.jpg'),'-vf',projection,'-frames:v','1','-q:v','2',str(POSTERS/f'{key}.jpg')])
    original, forward = info(source), info(destination)
    assert original['streams'][0]['nb_read_frames']==forward['streams'][0]['nb_read_frames'], key
    assert original['format']['duration']==forward['format']['duration'], key
    return {'id':key,'source':f'assets/videos/{key}.mp4','forward':f'assets/videos/front/{key}.mp4','frames':int(forward['streams'][0]['nb_read_frames']),'duration_s':float(forward['format']['duration']),'bytes':destination.stat().st_size,'width':480,'height':270}

def encode_hero(key):
    source=ROOT/f'assets/videos/hero/{key}.mp4'
    destination=HERO/f'{key}.mp4'
    filters='[0:v]split=2[base][front];[base]crop=ih:ih,scale=384:384[bg];[front]v360=input=equirect:output=flat:h_fov=90:v_fov=58.715507:w=120:h=68:interp=linear,pad=124:72:2:2:color=0xe8f6df[pip];[bg][pip]overlay=212:76[out]'
    run(['-threads','2','-filter_complex_threads','1','-i',str(source),'-filter_complex',filters,'-map','[out]','-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',str(destination)])
    original, composite = info(source), info(destination)
    assert original['streams'][0]['nb_read_frames']==composite['streams'][0]['nb_read_frames'], key
    return {'id':key,'path':f'assets/videos/hero-composited/{key}.mp4','frames':int(composite['streams'][0]['nb_read_frames']),'bytes':destination.stat().st_size}

if __name__=='__main__':
    start=time.time(); scenes=[]; heroes=[]
    with ThreadPoolExecutor(max_workers=3) as executor:
        jobs={executor.submit(encode_scene,key):'scene' for key in ['a1','a2','a3','a4','b1','b2','b3','b4']}
        jobs.update({executor.submit(encode_hero,key):'hero' for key in ['a1','a4','b2','b4','a2','b1']})
        for future in as_completed(jobs):
            result=future.result()
            (scenes if jobs[future]=='scene' else heroes).append(result)
            print(json.dumps({'type':jobs[future],**result}),flush=True)
    manifest={'horizontal_fov_degrees':90,'vertical_fov_degrees':58.715507,'heading_degrees':0,'pitch_degrees':0,'frame_rate_hz':10,'source':'same rendered ERP media, with unchanged frame count and timestamps','scenes':sorted(scenes,key=lambda x:x['id']),'hero_composites':heroes}
    (ROOT/'assets/front-view-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'complete':True,'seconds':round(time.time()-start,1),'added_bytes':sum(s['bytes'] for s in scenes+heroes)}),flush=True)
