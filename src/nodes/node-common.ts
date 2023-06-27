import { CalConfigNodeConfig, OnUpdateHandler } from './cal-config';
import { CronJob } from 'cron';
import * as NodeCache from 'node-cache';
import { IKalenderEvent, KalenderEvents } from 'kalender-events';
import { DateTime } from 'luxon';
import { Node, NodeDef } from 'node-red';
import moment = require('moment');

export interface Job {
  id: string,
  cronjob: any
}

export interface CalNodeConfig extends NodeDef{
  id: string,
  type: 'cal-sensor' | 'cal-trigger',
  confignode: string,
  name: string
}

export interface CalNode extends Node, OnUpdateHandler {
  config: CalNodeConfig;
  timeout?: NodeJS.Timeout;
  _nextCheckTime?: Date;
}
