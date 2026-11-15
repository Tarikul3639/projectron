import { Injectable } from '@nestjs/common';
import { ActivityLoggingService } from './activity-logging.service.js';
import type { ArchiveResult } from '../interfaces/log.interface.js';

@Injectable()
export class LogRotationService {
  /** Injects the logger responsible for archiving active log files. */
  constructor(private readonly logs: ActivityLoggingService) {}
  /** Requests a verified archive of the current active logs with the supplied reason. */
  rotate(reason = 'scheduled'): Promise<ArchiveResult> {
    return this.logs.archiveActive(reason);
  }
}
