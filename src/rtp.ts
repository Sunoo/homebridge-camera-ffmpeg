import { Logger } from "./logger";
import { createSocket, RemoteInfo, Socket } from "dgram";

export class RtpHelper {
  private readonly logPrefix: string;
  private readonly log: Logger;
  private heartbeatTimer!: NodeJS.Timeout;
  private heartbeatMsg!: Buffer;
  private inputPort: number;
  private inputRtcpPort: number;
  public readonly rtpSocket: Socket;
  public readonly rtcpSocket?: Socket;

  // Create an instance of RtpHelper.
  constructor(log: Logger, logPrefix: string, ipFamily: ("ipv4" | "ipv6") , inputPort: number, inputRtcpPort: number, rtcpPort: number, rtpPort: number, 
                                                                            sendAddress: string, sendPort: number, sendRtcpPort: number) {

    this.log = log;
    this.logPrefix = logPrefix;
    this.inputPort = inputPort;
    this.inputRtcpPort = inputRtcpPort;
    this.rtpSocket = createSocket(ipFamily === "ipv6" ? "udp6" : "udp4" );
    this.rtcpSocket = (inputPort !== inputRtcpPort) ? createSocket(ipFamily === "ipv6" ? "udp6" : "udp4" ) : undefined;

    // Catch errors when they happen on our demuxer.
    this.rtpSocket.on("error", (error)  => {
      this.log.error("RtpHelper (RTP) Error: " + error, this.logPrefix);
      this.rtpSocket.close();
    });

    // Catch errors when they happen on our demuxer.
    this.rtcpSocket?.on("error", (error)  => {
        this.log.error("RtpHelper (RTCP) Error: " + error, this.logPrefix);
        this.rtcpSocket?.close();
    });
      
    // Split the message into RTP and RTCP packets.
    this.rtpSocket.on("message", (msg: Buffer, rinfo: RemoteInfo) => {

      // Check if we have to forward a packet from ffmpeg to the external peer
      if (rinfo.address === '127.0.0.1')
      {
        this.rtpSocket.send(msg, sendPort, sendAddress);
        return;
      }

      // Send RTP packets to the RTP port.
      if(this.isRtpMessage(msg)) {

        this.rtpSocket.send(msg, rtpPort);

      } else {

        // Save this RTCP message for heartbeat purposes for the RTP port. This works because RTCP packets will be ignored
        // by ffmpeg on the RTP port, effectively providing a heartbeat to ensure FFmpeg doesn't timeout if there's an
        // extended delay between data transmission.
        //this.heartbeatMsg = Buffer.from(msg);

        // Clear the old heartbeat timer.
        //clearTimeout(this.heartbeatTimer);
        //this.heartbeat(rtpPort);

        // RTCP control packets should go to the RTCP port.
        this.rtpSocket.send(msg, rtcpPort);

      }
    });

    // Split the message into RTP and RTCP packets.
    this.rtcpSocket?.on("message", (msg: Buffer, rinfo: RemoteInfo) => {

        // Check if we have to forward a packet from ffmpeg to the external peer
        if (rinfo.address === '127.0.0.1')
        {
            this.rtcpSocket?.send(msg, sendRtcpPort, sendAddress);
            return;
        }
    
        // Send RTP packets to the RTP port.
        if(this.isRtpMessage(msg)) {
    
            this.rtcpSocket?.send(msg, rtpPort);
    
        } else {
    
            // Save this RTCP message for heartbeat purposes for the RTP port. This works because RTCP packets will be ignored
            // by ffmpeg on the RTP port, effectively providing a heartbeat to ensure FFmpeg doesn't timeout if there's an
            // extended delay between data transmission.
            //this.heartbeatMsg = Buffer.from(msg);
    
            // Clear the old heartbeat timer.
            //clearTimeout(this.heartbeatTimer);
            //this.heartbeat(rtpPort);
    
            // RTCP control packets should go to the RTCP port.
            this.rtcpSocket?.send(msg, rtcpPort);
    
        }
    });
      
    this.log.debug("Creating RtpHelper instance - inbound port: " + this.inputPort + ", RTCP port: " + rtcpPort + ", RTP port: " + rtpPort, this.logPrefix);

    // Take the socket live.
    this.rtpSocket.bind(this.inputPort);
    this.rtcpSocket?.bind(this.inputRtcpPort);
  }

  // Send a regular heartbeat to FFmpeg to ensure the pipe remains open and the process alive.
  private heartbeat(port: number): void {

    // Clear the old heartbeat timer.
    clearTimeout(this.heartbeatTimer);

    // Send a heartbeat to FFmpeg every few seconds to keep things open. FFmpeg has a five-second timeout
    // in reading input, and we want to be comfortably within the margin for error to ensure the process
    // continues to run.
    this.heartbeatTimer = setTimeout(() => {

      this.log.debug("Sending ffmpeg a heartbeat.", this.logPrefix);

      this.rtpSocket.send(this.heartbeatMsg, port);
      this.heartbeat(port);

    }, 3.5 * 1000);
  }

  // Close the socket and cleanup.
  public close(): void {
    this.log.debug("Closing RtpHelper instance on port: " + this.inputPort, this.logPrefix);

    //clearTimeout(this.heartbeatTimer);
    this.rtpSocket.close();
    this.rtcpSocket?.close();
  }

  // Retrieve the payload information from a packet to discern what the packet payload is.
  private getPayloadType(message: Buffer): number {
    return message.readUInt8(1) & 0x7f;
  }

  // Return whether or not a packet is RTP (or not).
  private isRtpMessage(message: Buffer): boolean {
    const payloadType = this.getPayloadType(message);

    return (payloadType > 90) || (payloadType === 0);
  }
}
