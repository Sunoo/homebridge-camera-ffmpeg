import { Readable } from 'stream';

class MultiStream extends Readable {
  private _object: any;

  constructor(object: any, options?: any) {
    super();
    if (object instanceof Buffer || typeof object === 'string') {
      options = options || {};
      Readable.call(this, {
        highWaterMark: options.highWaterMark,
        encoding: options.encoding,
      });
    } else {
      Readable.call(this, { objectMode: true });
    }
    this._object = object;
  }

  _read(): void {
    this.push(this._object);
    this._object = null;
  }
}

export const createMultiStream = function (object: any, options?: any): MultiStream {
  return new MultiStream(object, options);
};
