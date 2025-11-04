import soundcard as sc
import numpy as np
import soundfile as sf
import sys, time, os

SR = 48000
BLOCK = 2048
CHUNK_SEC = 5

meeting_id = sys.argv[1]
outdir = sys.argv[2]
duration = int(sys.argv[3]) if len(sys.argv) > 3 else 3600

lb = sc.all_microphones(include_loopback=True)[0] if sc.all_microphones(include_loopback=True) else None
mic = sc.default_microphone()

rec1 = lb.recorder(samplerate=SR, blocksize=BLOCK) if lb else None
rec2 = mic.recorder(samplerate=SR, blocksize=BLOCK) if mic else None
ctx1 = rec1.__enter__() if rec1 else None
ctx2 = rec2.__enter__() if rec2 else None

start = time.time()
chunk_i = 0
frames = []

try:
    while True:
        a = ctx1.record(numframes=BLOCK) if ctx1 else None
        b = ctx2.record(numframes=BLOCK) if ctx2 else None
        if a is not None and b is not None:
            if a.shape != b.shape:
                m = min(a.shape[0], b.shape[0])
                a, b = a[:m], b[:m]
            mixed = (a + b) / 2
        else:
            mixed = a or b
        frames.append(mixed)

        if time.time() - start >= CHUNK_SEC:
            chunk = np.vstack(frames)
            fname = os.path.join(outdir, f"{meeting_id}_{chunk_i}.wav")
            sf.write(fname, chunk, SR)
            print("WROTE", fname, flush=True)
            frames = []
            chunk_i += 1
            start = time.time()
except KeyboardInterrupt:
    pass
finally:
    if rec1: rec1.__exit__(None, None, None)
    if rec2: rec2.__exit__(None, None, None)
