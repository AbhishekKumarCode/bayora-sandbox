import { useCallback, useEffect, useRef, useState } from 'react';
import MP4Box, { type MP4ArrayBuffer, type MP4Sample, type MP4VideoTrack } from 'mp4box';

const LERP_TAU = 8;
const SNAP = 0.002;
const LRU_MAX = 24;
const LEAD = 24;
const WATCHDOG = 60000;

type Frame = { ts: number; blob: Blob };

function codecDescription(trak: any): Uint8Array | undefined {
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
    if (box) {
      const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
      box.write(stream);
      return new Uint8Array(stream.buffer, 8);
    }
  }
  return undefined;
}

function decodeAll(buffer: ArrayBuffer, hardwareAcceleration: HardwareAcceleration): Promise<Frame[]> {
  return new Promise((resolve, reject) => {
    const mp4 = MP4Box.createFile();
    const out: Frame[] = [];
    const samples: MP4Sample[] = [];
    const off = document.createElement('canvas');
    let decoder: VideoDecoder | null = null;
    let track: MP4VideoTrack | null = null;
    let fed = 0;
    let pending = 0;
    let flushing = false;
    let failed = false;

    const fail = (e: unknown) => {
      if (failed) return;
      failed = true;
      try { decoder?.close(); } catch { /* already closed */ }
      reject(e);
    };

    const finish = () => {
      if (pending === 0) resolve(out);
      else setTimeout(finish, 20);
    };

    const pump = () => {
      if (!decoder || !track || failed) return;
      while (fed < samples.length && fed - out.length < LEAD) {
        const s = samples[fed++];
        decoder.decode(new EncodedVideoChunk({
          type: s.is_sync ? 'key' : 'delta',
          timestamp: (s.cts * 1e6) / s.timescale,
          duration: (s.duration * 1e6) / s.timescale,
          data: s.data,
        }));
      }
      if (fed === track.nb_samples && !flushing) {
        flushing = true;
        decoder.flush().then(finish).catch(fail);
      }
    };

    mp4.onError = fail;
    mp4.onReady = (info) => {
      track = info.videoTracks[0];
      if (!track) return fail(new Error('no video track'));
      off.width = track.video.width;
      off.height = track.video.height;
      const ctx = off.getContext('2d');
      if (!ctx) return fail(new Error('no 2d context'));

      decoder = new VideoDecoder({
        output: (frame) => {
          const ts = frame.timestamp;
          ctx.drawImage(frame, 0, 0);
          frame.close();
          pending++;
          off.toBlob((blob) => {
            if (blob) out.push({ ts, blob });
            pending--;
            pump();
          }, 'image/webp', 0.82);
        },
        error: fail,
      });
      decoder.configure({
        codec: track.codec,
        codedWidth: track.video.width,
        codedHeight: track.video.height,
        description: codecDescription(mp4.getTrackById(track.id)),
        hardwareAcceleration,
      });
      mp4.setExtractionOptions(track.id, null, { nbSamples: 100 });
      mp4.start();
    };
    mp4.onSamples = (_id, _user, s) => {
      samples.push(...s);
      pump();
    };

    const buf = buffer as MP4ArrayBuffer;
    buf.fileStart = 0;
    mp4.appendBuffer(buf);
    mp4.flush();
  });
}

export function useVideoScrub(videoSrc: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canvasLive, setCanvasLive] = useState(false);

  const bank = useRef<Frame[]>([]);
  const lru = useRef(new Map<number, ImageBitmap | null>());
  const current = useRef(0);
  const target = useRef(0);
  const ready = useRef(false);
  const reverted = useRef(false);
  const painted = useRef(false);
  const building = useRef(false);
  const dur = useRef(0);
  const span = useRef(1);
  const lastDrawn = useRef(-1);

  const getProgress = useCallback(() => {
    const p = window.scrollY / span.current;
    return Math.max(0, Math.min(1, p));
  }, []);

  const nearestIndex = (t: number) => {
    const frames = bank.current;
    const us = t * 1e6;
    let lo = 0;
    let hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (frames[mid].ts < us) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(frames[lo - 1].ts - us) < Math.abs(frames[lo].ts - us)) return lo - 1;
    return lo;
  };

  const warmLRU = (i: number) => {
    const frames = bank.current;
    for (let j = i - 1; j <= i + 2; j++) {
      if (j < 0 || j >= frames.length || lru.current.has(j)) continue;
      lru.current.set(j, null);
      createImageBitmap(frames[j].blob).then((bm) => {
        if (!lru.current.has(j)) { bm.close(); return; }
        lru.current.set(j, bm);
      }).catch(() => lru.current.delete(j));
    }
    while (lru.current.size > LRU_MAX) {
      const oldest = lru.current.keys().next().value as number;
      lru.current.get(oldest)?.close();
      lru.current.delete(oldest);
    }
  };

  const drawFrame = (t: number) => {
    const canvas = canvasRef.current;
    if (!canvas || bank.current.length === 0) return;
    const i = nearestIndex(t);
    warmLRU(i);
    if (i === lastDrawn.current) return;
    const bm = lru.current.get(i);
    if (!bm) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(bm, 0, 0, canvas.width, canvas.height);
    lastDrawn.current = i;
    if (!painted.current) {
      painted.current = true;
      setCanvasLive(true);
    }
  };

  const revert = () => {
    reverted.current = true;
    ready.current = false;
    painted.current = false;
    setCanvasLive(false);
  };

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const video = videoRef.current;

    const measure = () => {
      const c = containerRef.current;
      span.current = Math.max(1, (c ? c.offsetHeight : 0) - window.innerHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    const onMeta = () => { if (video) dur.current = video.duration || 0; };
    video?.addEventListener('loadedmetadata', onMeta);
    if (video && video.readyState >= 1) onMeta();

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const p = getProgress();
      setScrollProgress((prev) => (Math.abs(prev - p) < 0.0005 ? prev : p));
      if (dur.current > 0) {
        target.current = p * dur.current;
        if (reduced) {
          current.current = target.current;
        } else {
          current.current += (target.current - current.current) * (1 - Math.exp(-dt * LERP_TAU));
          if (Math.abs(target.current - current.current) < SNAP) current.current = target.current;
        }
        if (ready.current) {
          drawFrame(current.current);
        } else if (video && !video.seeking && Math.abs(video.currentTime - current.current) > 0.01) {
          video.currentTime = current.current;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const build = async () => {
      if (building.current || reduced || typeof VideoDecoder === 'undefined') return;
      building.current = true;
      const watchdog = window.setTimeout(() => { if (!ready.current) revert(); }, WATCHDOG);
      try {
        const res = await fetch(videoSrc, { mode: 'cors' });
        const buf = await res.arrayBuffer();
        let frames: Frame[];
        try {
          frames = await decodeAll(buf, 'prefer-hardware');
        } catch {
          frames = await decodeAll(buf.slice(0), 'prefer-software');
        }
        if (reverted.current) return;
        frames.sort((a, b) => a.ts - b.ts);
        bank.current = frames;
        ready.current = true;
        window.clearTimeout(watchdog);
      } catch {
        window.clearTimeout(watchdog);
        revert();
      }
    };
    if (document.readyState === 'complete') build();
    else window.addEventListener('load', build, { once: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.removeEventListener('load', build);
      video?.removeEventListener('loadedmetadata', onMeta);
      lru.current.forEach((bm) => bm?.close());
      lru.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSrc]);

  return { videoRef, canvasRef, containerRef, scrollProgress, canvasLive };
}
