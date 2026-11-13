import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { NetworkAddressService } from './network-address.service.js';
import type { HttpRequestInput } from '../network.type.js';

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;

/** Sends bounded HTTP requests to validated public destinations. */
@Injectable()
export class NetworkHttpService {
  constructor(private readonly addresses: NetworkAddressService) {}

  /** Sends an HTTP request to a validated public destination and bounds its response. */
  async request(input: HttpRequestInput) {
    const headers = this.validateHeaders(input.headers);
    let url = this.validateUrl(input.url);
    let method = input.method;
    let body = input.body;

    for (
      let redirectCount = 0;
      redirectCount <= MAX_REDIRECTS;
      redirectCount += 1
    ) {
      const addresses = await this.addresses.resolvePublicAddresses(
        url.hostname,
      );
      const response = await this.sendOnce({
        url,
        method,
        headers,
        body,
        timeoutMs: input.timeoutMs,
        maxResponseBytes: input.maxResponseBytes,
        address: addresses[0].address,
      });

      if (!REDIRECT_CODES.has(response.statusCode) || !response.location) {
        return {
          url: url.toString(),
          statusCode: response.statusCode,
          statusMessage: response.statusMessage,
          headers: response.headers,
          body: response.body,
          truncated: response.truncated,
          durationMs: response.durationMs,
          completedAt: new Date().toISOString(),
        };
      }

      if (redirectCount === MAX_REDIRECTS) {
        throw new BadRequestException('HTTP redirect limit exceeded');
      }

      url = this.validateUrl(new URL(response.location, url).toString());
      if (
        response.statusCode === 303 ||
        ((response.statusCode === 301 || response.statusCode === 302) &&
          method === 'POST')
      ) {
        method = 'GET';
        body = undefined;
      }
    }

    throw new BadRequestException('Unable to complete HTTP request');
  }

  /** Performs one request while pinning DNS resolution to the validated address. */
  private sendOnce(input: {
    url: URL;
    method: string;
    headers: Record<string, string>;
    body?: string;
    timeoutMs: number;
    maxResponseBytes: number;
    address: string;
  }) {
    const transport =
      input.url.protocol === 'https:' ? httpsRequest : httpRequest;
    const family = isIP(input.address);

    return new Promise<{
      statusCode: number;
      statusMessage: string;
      headers: Record<string, string | string[] | undefined>;
      location?: string;
      body: string;
      truncated: boolean;
      durationMs: number;
    }>((resolvePromise, reject) => {
      const startedAt = Date.now();
      const request = transport(
        input.url,
        {
          method: input.method,
          headers: { ...input.headers, host: input.url.host },
          servername: input.url.hostname,
          lookup: (_hostname, _options, callback) => {
            callback(null, input.address, family);
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          let received = 0;
          let truncated = false;

          response.on('data', (chunk: Buffer) => {
            const remaining = input.maxResponseBytes - received;
            if (remaining <= 0) {
              truncated = true;
              response.destroy();
              return;
            }
            const part = chunk.subarray(0, remaining);
            chunks.push(part);
            received += part.length;
            if (part.length < chunk.length) {
              truncated = true;
              response.destroy();
            }
          });
          response.once('aborted', () => {
            // A deliberately truncated response is returned with the bytes already received.
            if (!truncated)
              reject(
                new ServiceUnavailableException(
                  'HTTP response was interrupted',
                ),
              );
          });
          response.once('error', (error) => {
            if (!truncated)
              reject(
                new ServiceUnavailableException(
                  this.addresses.errorMessage(error),
                ),
              );
          });
          response.once('end', () => {
            resolvePromise({
              statusCode: response.statusCode ?? 0,
              statusMessage: response.statusMessage ?? '',
              headers: response.headers,
              location: response.headers.location,
              body: Buffer.concat(chunks).toString('utf8'),
              truncated,
              durationMs: Date.now() - startedAt,
            });
          });
          response.once('close', () => {
            if (truncated) {
              resolvePromise({
                statusCode: response.statusCode ?? 0,
                statusMessage: response.statusMessage ?? '',
                headers: response.headers,
                location: response.headers.location,
                body: Buffer.concat(chunks).toString('utf8'),
                truncated: true,
                durationMs: Date.now() - startedAt,
              });
            }
          });
        },
      );

      request.setTimeout(input.timeoutMs, () => {
        request.destroy(new GatewayTimeoutException('HTTP request timed out'));
      });
      request.once('error', reject);
      if (input.body !== undefined) request.write(input.body);
      request.end();
    });
  }

  /** Rejects URL credentials, unsupported schemes, and malformed hostnames. */
  private validateUrl(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(
        'A valid absolute HTTP or HTTPS URL is required',
      );
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new BadRequestException(
        'Only credential-free HTTP and HTTPS URLs are supported',
      );
    }
    this.addresses.normalizeHostname(url.hostname);
    return url;
  }

  /** Validates header names and values before passing them to Node.js HTTP. */
  private validateHeaders(headers: Record<string, string>) {
    const result: Record<string, string> = {};
    for (const [name, value] of Object.entries(headers)) {
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || /[\r\n]/.test(value)) {
        throw new BadRequestException('Invalid HTTP header name or value');
      }
      if (/^(host|content-length|connection|transfer-encoding)$/i.test(name)) {
        throw new BadRequestException(
          `The ${name} header is managed by Projectron`,
        );
      }
      result[name] = value;
    }
    return result;
  }
}
