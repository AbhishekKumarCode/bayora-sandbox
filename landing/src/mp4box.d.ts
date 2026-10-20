declare module 'mp4box' {
  export interface MP4Sample {
    is_sync: boolean;
    cts: number;
    dts: number;
    duration: number;
    timescale: number;
    data: Uint8Array;
  }
  export interface MP4VideoTrack {
    id: number;
    codec: string;
    nb_samples: number;
    timescale: number;
    duration: number;
    video: { width: number; height: number };
  }
  export interface MP4Info {
    videoTracks: MP4VideoTrack[];
  }
  export interface MP4ArrayBuffer extends ArrayBuffer {
    fileStart: number;
  }
  export interface MP4File {
    onReady?: (info: MP4Info) => void;
    onError?: (e: unknown) => void;
    onSamples?: (id: number, user: unknown, samples: MP4Sample[]) => void;
    appendBuffer(buffer: MP4ArrayBuffer): number;
    setExtractionOptions(id: number, user: unknown, options: { nbSamples?: number }): void;
    start(): void;
    stop(): void;
    flush(): void;
    getTrackById(id: number): any;
  }
  export class DataStream {
    static BIG_ENDIAN: boolean;
    constructor(arrayBuffer?: ArrayBuffer, byteOffset?: number, endianness?: boolean);
    buffer: ArrayBuffer;
  }
  export function createFile(): MP4File;
  const MP4Box: { createFile: typeof createFile; DataStream: typeof DataStream };
  export default MP4Box;
}
