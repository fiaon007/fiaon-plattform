declare module "archiver" {
  import { Transform, Readable } from "stream";

  interface ZipArchiveOptions {
    zlib?: { level?: number };
    forceLocalTime?: boolean;
    comment?: string;
    store?: boolean;
  }

  interface EntryData {
    name: string;
    prefix?: string;
    date?: Date | string;
    mode?: number;
  }

  export class Archiver extends Transform {
    append(source: Readable | Buffer | string, data: EntryData): this;
    file(filepath: string, data: EntryData): this;
    directory(dirpath: string, destpath: string | false): this;
    finalize(): Promise<void>;
    pointer(): number;
    abort(): this;
  }

  export class ZipArchive extends Archiver {
    constructor(options?: ZipArchiveOptions);
  }

  export class TarArchive extends Archiver {
    constructor(options?: object);
  }

  export class JsonArchive extends Archiver {
    constructor(options?: object);
  }
}
