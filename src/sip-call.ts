//import { noop, Subject } from 'rxjs'
import { Logger } from './logger';

const sip = require('sip'),
      sdp = require('sdp')

export interface RtpStreamOptions {
  port: number
  rtcpPort: number
  ssrc?: number
}

export interface RtpOptions {
  audio: RtpStreamOptions
}

export interface RtpDescription {
  address: string
  audio: RtpStreamOptions
}

interface UriOptions {
  name?: string
  uri: string
  params?: { tag?: string }
}

interface SipHeaders {
  [name: string]: string | any
  cseq: { seq: number; method: string }
  to: UriOptions
  from: UriOptions
  contact?: UriOptions[]
  via?: UriOptions[]
}

export interface SipRequest {
  uri: UriOptions | string
  method: string
  headers: SipHeaders
  content: string
}

export interface SipResponse {
  status: number
  reason: string
  headers: SipHeaders
  content: string
}

export interface SipClient {
  send: (
    request: SipRequest | SipResponse,
    handler?: (response: SipResponse) => void
  ) => void
  destroy: () => void
  makeResponse: (
    response: SipRequest,
    status: number,
    method: string
  ) => SipResponse
}

export interface SipOptions {
  to: string
  from: string
  localIp: string
}

function getRandomId() {
  return Math.floor(Math.random() * 1e6).toString()
}

function getRtpDescription(
  log: Logger,
  sections: string[],
  mediaType: 'audio'
): RtpStreamOptions {
  try {
    const section = sections.find((s) => s.startsWith('m=' + mediaType))

    const { port } = sdp.parseMLine(section),
    lines: string[] = sdp.splitLines(section),
    rtcpLine = lines.find((l: string) => l.startsWith('a=rtcp:')),
    ssrcLine = lines.find((l: string) => l.startsWith('a=ssrc'))

    return {
      port,
      rtcpPort: (rtcpLine && Number(rtcpLine.match(/rtcp:(\S*)/)?.[1])) || port+1,
      ssrc:     (ssrcLine && Number(ssrcLine.match(/ssrc:(\S*)/)?.[1])) || undefined
    }
  } catch (e) {
    log.error('Failed to parse SDP from remote end')
    log.error(sections.join('\r\n'))
    throw e
  }
}

function parseRtpDescription(log: Logger, inviteResponse: {
  content: string
}): RtpDescription {
  const sections: string[] = sdp.splitSections(inviteResponse.content),
    lines: string[] = sdp.splitLines(sections[0]),
    cLine = lines.find((line: string) => line.startsWith('c='))!

  return {
    address: cLine.match(/c=IN IP4 (\S*)/)![1],
    audio: getRtpDescription(log, sections, 'audio')
  }
}

export class SipCall {
  private seq = 20
  private fromParams = { tag: getRandomId() }
  private toParams: { tag?: string } = {}
  private callId = getRandomId()
  private sipClient: SipClient
  //public readonly onEndedByRemote = new Subject()
  private destroyed = false
  private readonly log: Logger

  public readonly sdp: string

  constructor(
    log: Logger,
    private sipOptions: SipOptions,
    rtpOptions: RtpOptions,
  ) {
    this.log = log;
    const { audio } = rtpOptions,
          { from } = this.sipOptions,
          host = this.sipOptions.localIp

    this.sipClient = {
      makeResponse: sip.makeResponse, 
      ...sip.create({
        host,
        hostname: host,
        tcp: false,
        udp: true,
      },
      (request: SipRequest) => {
        if (request.method === 'BYE') {
          this.log.info('received BYE from remote end')
          this.sipClient.send(this.sipClient.makeResponse(request, 200, 'Ok'))

          if (this.destroyed) {
            //this.onEndedByRemote.next(null)
          }
        } 
      }
    )}

    this.sdp = [
      'v=0',
      `o=${from.split(':')[1].split('@')[0]} 3747 461 IN IP4 ${host}`,
      's=Talk',
      `c=IN IP4 ${host}`,
      't=0 0',
      `m=audio ${audio.port} RTP/AVP 0`,
      'a=rtpmap:0 PCMU/8000',
      `a=rtcp:${audio.rtcpPort}`,
      'a=ssrc:2315747900',
      'a=sendrecv'
    ]
      .filter((l) => l)
      .join('\r\n')
    this.sdp = this.sdp += '\r\n'
  }

  request({
    method,
    headers,
    content,
    seq,
  }: {
    method: string
    headers?: Partial<SipHeaders>
    content?: string
    seq?: number
  }) {
    if (this.destroyed) {
      return Promise.reject(
        new Error('SIP request made after call was destroyed')
      )
    }

    return new Promise<SipResponse>((resolve, reject) => {
      seq = seq || this.seq++
      this.sipClient.send(
        {
          method,
          uri: this.sipOptions.to,
          headers: {
            to: {
              name: '"SIP doorbell client"',
              uri: this.sipOptions.to,
              params: this.toParams,
            },
            from: {
              uri: this.sipOptions.from,
              params: this.fromParams,
            },
            'max-forwards': 70,
            'call-id': this.callId,
            cseq: { seq, method },
            ...headers,
          },
          content: content || '',
        },
        (response: SipResponse) => {
          if (response.headers.to.params && response.headers.to.params.tag) {
            this.toParams.tag = response.headers.to.params.tag
          }

          if (response.status >= 300) {
            if (response.status !== 408 || method !== 'BYE') {
              this.log.error(
                `sip ${method} request failed with status ` + response.status
              )
            }
            reject(
              new Error(
                `sip ${method} request failed with status ` + response.status
              )
            )
          } else if (response.status < 200) {
            // call made progress, do nothing and wait for another response
            // console.log('call progress status ' + response.status)
          } else {
            if (method === 'INVITE') {
              // The ACK must be sent with every OK to keep the connection alive.
              this.ackWithInfo(seq!).catch((e) => {
                this.log.error('Failed to send SDP ACK and INFO')
                this.log.error(e)
              })
            }
            resolve(response)
          }
        }
      )
    })
  }

  private async ackWithInfo(seq: number) {
    // Don't wait for ack, it won't ever come back.
    this.request({
      method: 'ACK',
      seq, // The ACK must have the original sequence number.
    //}).catch(noop)
    }).catch()
  }

  sendDtmf(key: string) {
    return this.request({
      method: 'INFO',
      headers: {
        'Content-Type': 'application/dtmf-relay',
      },
      content: `Signal=${key}\r\nDuration=250`,
    })
  }

  async invite() {
    const { from } = this.sipOptions,
      inviteResponse = await this.request({
        method: 'INVITE',
        headers: {
          supported: 'replaces, outbound',
          allow:
            'INVITE, ACK, CANCEL, OPTIONS, BYE, REFER, NOTIFY, MESSAGE, SUBSCRIBE, INFO, UPDATE',
          'content-type': 'application/sdp',
          contact: [{ uri: from }],
        },
        content: this.sdp,
      })

    return parseRtpDescription(this.log, inviteResponse)
  }

  sendBye() {
    return this.request({ method: 'BYE' }).catch(() => {
      // Don't care if we get an exception here.
    })
  }

  destroy() {
    this.destroyed = true
    this.sipClient.destroy()
  }
}
