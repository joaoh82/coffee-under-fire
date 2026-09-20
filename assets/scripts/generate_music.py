"""Coffee Patrol v2: original sixteen-bar, 112 BPM field march.
Rebuild with npm run assets:music. Standard library; no external samples.
"""
import math, random, wave, struct, json
from pathlib import Path
RATE=22050
BPM=112
BEAT=60/BPM
LENGTH=16*4*BEAT
samples=[0.0]*round(RATE*LENGTH)
rng=random.Random(1944)
def note(beat,midi,beats,gain,voice='strings'):
 start=round(beat*BEAT*RATE);duration=beats*BEAT;f=440*2**((midi-69)/12)
 for i in range(round(duration*RATE)):
  t=i/RATE;p=math.tau*f*t
  if voice=='brass':
   tone=sum(math.sin(p*k)*v for k,v in [(1,1),(2,.42),(3,.23),(4,.11),(5,.05)])
   env=min(1,t/.025)*(.75+.25*math.exp(-t*8))*min(1,(duration-t)/.09)
  elif voice=='bass':
   tone=math.sin(p)+.24*math.sin(p*2);env=min(1,t/.008)*math.exp(-t*3)*min(1,(duration-t)/.05)
  else:
   tone=math.sin(p)+.25*math.sin(p*2)+.12*math.sin(p*3)
   env=min(1,t/.012)*math.exp(-t*5)*min(1,(duration-t)/.045)
  samples[(start+i)%len(samples)]+=tone*env*gain

def drum(beat,kind,gain):
 start=round(beat*BEAT*RATE);duration=.24 if kind=='kick' else .16
 previous=0
 for i in range(round(duration*RATE)):
  t=i/RATE;noise=rng.uniform(-1,1)
  if kind=='kick':tone=math.sin(math.tau*(49*t+3*(1-math.exp(-t*24))))*math.exp(-t*19)
  else:
   tone=(noise-previous)*.55*math.exp(-t*27)+.25*math.sin(math.tau*185*t)*math.exp(-t*33)
  previous=noise
  samples[(start+i)%len(samples)]+=gain*tone*min(1,t/.002)
# Minor marching ostinato with short brass calls; no borrowed tune.
roots=[45,41,38,40]
chords=[[57,60,64],[53,57,60],[50,53,57],[52,56,59]]
calls=[[69,69,72,71,69],[65,69,67,65,64],[62,65,69,67,65],[64,68,71,68,64]]
for bar in range(16):
 base=bar*4;root=roots[bar%4];chord=chords[bar%4]
 for j in range(8):note(base+j*.5,chord[[0,2,1,2,0,2,1,2][j]],.36,.10)
 for j in range(4):
  note(base+j,root+(7 if j%2 else 0),.65,.22,'bass')
  drum(base+j,'kick',.30 if j%2==0 else .13)
  drum(base+j+.5,'snare',.17 if j%2==0 else .23)
 if bar%4==3:
  for offset in [3.25,3.5,3.625,3.75,3.875]:drum(base+offset,'snare',.08 if offset<3.75 else .13)
 if bar%2==0 or bar>=8:
  for j,offset in enumerate([0,.75,1.5,2.5,3]):
   note(base+offset,calls[bar%4][j],.55 if j<4 else .75,.105,'brass')
   if bar>=8:note(base+offset,calls[bar%4][j]-12,.55,.045,'brass')
peak=max(abs(x) for x in samples)
pcm=[round(x/peak*.78*32767) for x in samples]
root=Path(__file__).resolve().parents[2]
path=root/'apps/web/public/assets/audio/coffee-patrol-v2.wav'
with wave.open(str(path),'wb') as out:
 out.setnchannels(1);out.setsampwidth(2);out.setframerate(RATE)
 out.writeframes(b''.join(struct.pack('<h',x) for x in pcm))
report={'file':str(path.relative_to(root)),'durationSeconds':len(pcm)/RATE,'bpm':BPM,'sampleRate':RATE,'channels':1,'bytes':path.stat().st_size,'peak':max(abs(x) for x in pcm)/32768,'rms':math.sqrt(sum(x*x for x in pcm)/len(pcm))/32768,'loopBoundaryStep':abs(pcm[0]-pcm[-1])/32768,'provenance':'Original code-composed field march; no external samples','generator':'assets/scripts/generate_music.py'}
(root/'assets/music-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
