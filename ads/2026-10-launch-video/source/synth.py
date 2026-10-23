"""Original 21s track for the Subbies brag video: 120 BPM, D major.
Pure Python (no numpy). Writes work/audio.wav (44.1k, 16-bit stereo)."""
import math, random, wave, struct
from array import array

SR = 44100
DUR = 21.0
N = int(SR * DUR)
random.seed(7)
TAU = 2 * math.pi
BEAT = 0.5
L = array("d", bytes(8 * N))
R = array("d", bytes(8 * N))
SL = array("d", bytes(8 * N))  # sfx bus
SRB = array("d", bytes(8 * N))


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(t0, samples, gain=1.0, pan=0.0, bus="music"):
    a, b = (L, R) if bus == "music" else (SL, SRB)
    gl, gr = gain * math.cos((pan + 1) * math.pi / 4), gain * math.sin((pan + 1) * math.pi / 4)
    s0 = int(t0 * SR)
    for i, v in enumerate(samples):
        j = s0 + i
        if 0 <= j < N:
            a[j] += v * gl
            b[j] += v * gr


def lowpass(x, fc):
    a = 1 - math.exp(-TAU * fc / SR)
    y, out = 0.0, []
    for v in x:
        y += a * (v - y)
        out.append(y)
    return out


def highpass(x, fc):
    lp = lowpass(x, fc)
    return [v - w for v, w in zip(x, lp)]


# ---------- instruments ----------
def pad_note(m, dur, att=0.25, rel=0.5, detune=0.0):
    f = hz(m) * (1 + detune)
    n = int((dur + rel) * SR)
    out = []
    for i in range(n):
        t = i / SR
        env = min(1, t / att) if t < dur else max(0, 1 - (t - dur) / rel)
        ph = TAU * f * t
        out.append(env * (math.sin(ph) + .28 * math.sin(2 * ph) + .12 * math.sin(3 * ph) + .05 * math.sin(4 * ph)))
    return lowpass(out, 2200)


def pluck(m, dur=0.35, bright=1.0, decay=7.0):
    f = hz(m)
    n = int(dur * SR)
    out = []
    for i in range(n):
        t = i / SR
        env = math.exp(-decay * t) * min(1, t / .003)
        ph = TAU * f * t
        out.append(env * (math.sin(ph) + bright * .45 * math.exp(-14 * t) * math.sin(2 * ph) + bright * .2 * math.exp(-22 * t) * math.sin(3 * ph)))
    return out


def bell(m, dur=1.4):
    f = hz(m)
    n = int(dur * SR)
    out = []
    for i in range(n):
        t = i / SR
        mod = 1.6 * math.exp(-6 * t) * math.sin(TAU * f * 3.5 * t)
        out.append(math.exp(-3.2 * t) * min(1, t / .002) * math.sin(TAU * f * t + mod))
    return out


def kick(g=1.0):
    n = int(.32 * SR)
    out, ph = [], 0.0
    for i in range(n):
        t = i / SR
        f = 45 + 95 * math.exp(-28 * t)
        ph += TAU * f / SR
        out.append(g * math.exp(-9 * t) * math.sin(ph) + g * .25 * math.exp(-120 * t) * (random.random() * 2 - 1))
    return out


def clap():
    n = int(.22 * SR)
    noise = [random.random() * 2 - 1 for _ in range(n)]
    noise = highpass(lowpass(noise, 3800), 900)
    out = []
    for i, v in enumerate(noise):
        t = i / SR
        env = math.exp(-18 * t) + .6 * (math.exp(-200 * t) if t < .01 else 0) + .5 * (math.exp(-200 * (t - .012)) if t >= .012 else 0)
        out.append(v * env)
    return out


def hat(dur=.05):
    n = int(dur * SR)
    noise = highpass([random.random() * 2 - 1 for _ in range(n)], 7000)
    return [v * math.exp(-70 * i / SR) for i, v in enumerate(noise)]


def thump(m=38, g=1.0, dur=.5):
    """Stamp hit: pitched low body + short noise slap, low-passed."""
    f0 = hz(m)
    n = int(dur * SR)
    out, ph = [], 0.0
    for i in range(n):
        t = i / SR
        ph += TAU * f0 * (1 + .9 * math.exp(-30 * t)) / SR
        out.append(math.exp(-7 * t) * math.sin(ph) + .5 * math.exp(-60 * t) * (random.random() * 2 - 1))
    return [g * v for v in lowpass(out, 1400)]


def click(m=86):
    n = int(.04 * SR)
    noise = highpass([random.random() * 2 - 1 for _ in range(n)], 2500)
    f = hz(m)
    return [math.exp(-160 * i / SR) * (.6 * v + .5 * math.sin(TAU * f * i / SR)) for i, v in enumerate(noise)]


def riser(dur):
    n = int(dur * SR)
    noise = [random.random() * 2 - 1 for _ in range(n)]
    out, y = [], 0.0
    for i, v in enumerate(noise):
        p = i / n
        a = 1 - math.exp(-TAU * (300 + 6000 * p * p) / SR)
        y += a * (v - y)
        out.append(y * p * p)
    return out


# ---------- arrangement ----------
# D=62. Chords per 2s bar: Dmaj7, Bm7, Gmaj7, A6
CHORDS = [[50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 54, 61]]
ROOTS = [38, 35, 31, 33]
BAR = 4 * BEAT
END = 18.0

# pads: whole track up to the final hit
t = 0.0
k = 0
while t < END - 0.01:
    ch = CHORDS[k % 4]
    for j, m in enumerate(ch):
        add(t, pad_note(m, BAR - .05, detune=-.003), .055, -.5 + j * .1)
        add(t, pad_note(m, BAR - .05, detune=.003), .055, .5 - j * .1)
    t += BAR
    k += 1

# intro (0–3): soft kick on 1 and 3, low-passed later in master
for b in range(6):
    if b % 2 == 0:
        add(b * BEAT, kick(.55), .5)
add(2.0, riser(1.0), .18)

# full band 3.0–18.0
beat = 3.0
while beat < END - 0.01:
    bi = round((beat - 3.0) / BEAT)
    add(beat, kick(), .62)
    if bi % 2 == 1:
        add(beat, clap(), .22, .1)
    add(beat + BEAT / 2, hat(), .09, .35)
    add(beat, hat(.025), .04, -.3)
    beat += BEAT

# bass: pluck pattern per bar (beats 0, 0.75, 1.5, 2, 3, 3.5)
t = 3.0
while t < END - 0.01:
    bar_i = int(round((t - 0.0) / BAR)) % 4
    r = ROOTS[bar_i]
    for off, mm in [(0, 0), (.75, 0), (1.5, 12), (2, 0), (3, 7), (3.5, 12)]:
        add(t + off * BEAT, lowpass(pluck(r + mm, .4, .8, 6), 900), .38)
    t += BAR

# bell motif (2-bar phrase), D major pentatonic
MOTIF = [(0, 78), (1, 81), (1.5, 78), (2.5, 76), (4, 74), (5, 76), (6, 73), (7, 74)]
t = 3.0
while t < END - 0.01:
    for off, m in MOTIF:
        if t + off * BEAT < END - .2:
            add(t + off * BEAT, bell(m, 1.2), .085, .25)
    t += 2 * BAR

# final hit at 18.0: Dmaj9 ring-out
for j, m in enumerate([38, 50, 57, 61, 64, 66, 69]):
    add(END, pad_note(m, 1.6, att=.01, rel=1.4), .07, -.6 + j * .2)
add(END, kick(), .7)
add(END, bell(86, 2.8), .12, .2)
add(END + .25, bell(81, 2.6), .08, -.2)

# ---------- sfx (in key, under the music) ----------
add(.9, thump(38, 1.0), .55)                       # EXPIRED stamp slam
add(.9, click(74), .25)
for i, m in enumerate([69, 74, 78, 81]):            # four stamps file in
    add(3.75 + i * .13, pluck(m, .3, .6, 10), .16, -.4 + i * .27, "sfx")
for i, (tt, m) in enumerate(zip([6.95, 7.3, 7.65], [74, 78, 81])):  # ticks
    add(tt, pluck(m, .25, .7, 14), .17, .3, "sfx")
add(8.15, click(86), .22, .3, "sfx")                # send press
add(8.3, bell(86, 1.2), .1, .3, "sfx")              # success chime
add(8.42, bell(90, 1.0), .07, .3, "sfx")
for tt in [10.75, 11.25, 12.1, 12.5]:               # phone taps
    add(tt, click(81), .18, -.4, "sfx")
for tt, m in [(11.75, 78), (12.95, 81)]:            # upload done
    add(tt, pluck(m, .3, .5, 10), .15, -.4, "sfx")
add(13.15, bell(86, 1.2), .09, -.3, "sfx")          # "You're all done"
add(13.27, bell(90, 1.1), .07, -.3, "sfx")
add(14.98, click(86), .22, .2, "sfx")               # Approve press
add(15.05, thump(50, .5, .35), .4, .2, "sfx")       # stamp flip
add(15.08, bell(90, 1.0), .07, .2, "sfx")
for i in range(3):                                  # reminder rows
    add(15.85 + i * .16, pluck([74, 78, 81][i], .22, .5, 16), .12, .35, "sfx")

# ---------- master ----------
# intro low-pass sweep on the music bus (closed until 2.6s, opens fully by 3.0s)
yl = yr = 0.0
for i in range(N):
    tt = i / SR
    if tt < 3.0:
        fc = 450 if tt < 2.0 else 450 + 9000 * ((tt - 2.0) / 1.0) ** 3
        a = 1 - math.exp(-TAU * fc / SR)
        yl += a * (L[i] - yl)
        yr += a * (R[i] - yr)
        L[i], R[i] = yl, yr

# sfx sit under the music: gentle duck of sfx only, music unaffected
peak = 0.0
for i in range(N):
    L[i] += SL[i] * .8
    R[i] += SRB[i] * .8
    peak = max(peak, abs(L[i]), abs(R[i]))

g = 0.92 / peak
fade0 = 20.2
frames = bytearray()
for i in range(N):
    tt = i / SR
    f = 1.0 if tt < fade0 else max(0.0, 1 - (tt - fade0) / (DUR - fade0))
    f *= min(1.0, i / (SR * .01))
    for v in (L[i], R[i]):
        s = math.tanh(v * g * 1.15) / math.tanh(1.15) * f
        frames += struct.pack("<h", int(max(-1, min(1, s)) * 32000))

with wave.open("audio.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(bytes(frames))
print("peak", peak, "written audio.wav")
