"""Original Coffee Under Fire instrumental: sixteen bars at 96 BPM.
Rebuild: python3 assets/scripts/generate_music_v1.py. No samples or dependencies.
"""
import math, random, wave, struct
from pathlib import Path
RATE=22050
BEAT=60/96
LENGTH=16*4*BEAT
samples=[0.0]*round(RATE*LENGTH)
rng=random.Random(1944)
def note(beat, midi, beats, gain, voice='pluck'):
    start=round(beat*BEAT*RATE); duration=beats*BEAT; f=440*2**((midi-69)/12)
    for i in range(round(duration*RATE)):
        t=i/RATE; phase=math.tau*f*t
        if voice=='bass':
            tone=math.sin(phase)+.18*math.sin(2*phase)
            env=min(1,t/.015)*math.exp(-t*3)*min(1,(duration-t)/.06)
        elif voice=='flute':
            tone=math.sin(phase+.012*math.sin(math.tau*4*t))+.12*math.sin(2*phase)
            env=min(1,t/.035)*math.exp(-t*1.6)*min(1,(duration-t)/.09)
        else:
            tone=math.sin(phase)+.28*math.sin(2*phase)*math.exp(-t*7)+.08*math.sin(3*phase)*math.exp(-t*12)
            env=min(1,t/.006)*math.exp(-t*6)*min(1,(duration-t)/.035)
        samples[(start+i)%len(samples)]+=tone*env*gain
# Am7, Fmaj7, Cmaj7, G6: a restrained, lilting field-camp tune.
chords=[(45,[60,64,67,69]),(41,[60,64,65,69]),(48,[59,60,64,67]),(43,[59,62,64,67])]
melodies=[[76,74,72,69,72,74],[72,69,67,69,72,76],[79,76,74,72,74,76],[74,71,69,67,69,71]]
for bar in range(16):
    root,chord=chords[bar%4]; base=bar*4
    for offset,pitch in [(0,root),(2,root+7)]: note(base+offset,pitch,1.65,.19,'bass')
    for j in range(8): note(base+j*.5,chord[[0,2,1,3,2,1,3,1][j]],.8,.052 if j%2 else .068)
    motif=melodies[bar%4]
    for j,offset in enumerate([.5,1,1.75,2.5,3,3.5]):
        if bar in [3,7,11,15] and j>3: continue
        note(base+offset,motif[j]+(0 if bar<8 else -12),.58,.085,'flute')
    for beat in range(4):
        start=round((base+beat)*BEAT*RATE)
        for i in range(round(.10*RATE)):
            t=i/RATE
            # Quiet brushed-noise rhythm; seeded for reproducible exports.
            samples[(start+i)%len(samples)]+=rng.uniform(-1,1)*math.exp(-t*65)*min(1,t/.004)*(.021 if beat%2 else .009)
peak=max(abs(x) for x in samples)
path=Path(__file__).resolve().parents[2]/'apps/web/public/assets/audio/coffee-patrol-v1.wav'
with wave.open(str(path),'wb') as out:
    out.setnchannels(1);out.setsampwidth(2);out.setframerate(RATE)
    out.writeframes(b''.join(struct.pack('<h',round(x/peak*.65*32767)) for x in samples))
print(f'{path.name}: {LENGTH:.1f}s, {RATE} Hz, mono PCM16, peak 0.65, {path.stat().st_size} bytes')
