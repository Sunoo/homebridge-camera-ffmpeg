declare module 'pick-port' {
  namespace pickPort {
    type pickPortOptions = {
      type?: ('udp' | 'tcp');
      ip?: string;
      minPort?: number;
      maxPort?: number;
      reserveTimeout?: number;
    };

    type reserveOptions = {
      type: ('udp' | 'tcp');
      ip: string;
      port: number;
      reserveTimeout: number;
    };

    type isReservedOptions = {
      type: ('udp' | 'tcp');
      ip: string;
      port: number;
    };

    function reserve(options: reserveOptions): void;
    function isReserved(options: isReservedOptions): boolean;
  }

  function pickPort(options: pickPort.pickPortOptions): Promise<number>;

  export = pickPort;
}