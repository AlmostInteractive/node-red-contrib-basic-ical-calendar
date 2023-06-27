import { OnUpdateHandler } from './cal-config';
import { Node, NodeDef } from 'node-red';

export type Countdown = { days: number, hours: number, minutes: number, seconds: number };

export interface Job {
  id: string,
  cronjob: any
}

export interface CalNodeConfig extends NodeDef {
  id: string,
  type: 'cal-sensor' | 'cal-trigger',
  confignode: string,
  name: string
}

export interface CalSensorNode extends Node, OnUpdateHandler {
  config: CalNodeConfig;
}

export interface CalTriggerNode extends Node, OnUpdateHandler {
  config: CalNodeConfig;
  timeout?: NodeJS.Timeout;
  _nextCheckTime?: Date;
}

export const inThePast = (countdown: Countdown) => {
  if (countdown.days < 0)
    return true;
  if (countdown.days > 0)
    return false;

  if (countdown.hours < 0)
    return true;
  if (countdown.hours > 0)
    return false;

  if (countdown.minutes < 0)
    return true;
  if (countdown.minutes > 0)
    return false;

  return (countdown.seconds < 0);
};

export const inTheFuture = (countdown: Countdown) => {
  if (countdown.days < 0)
    return false;
  if (countdown.days > 0)
    return true;

  if (countdown.hours < 0)
    return false;
  if (countdown.hours > 0)
    return true;

  if (countdown.minutes < 0)
    return false;
  if (countdown.minutes > 0)
    return true;

  return (countdown.seconds > 0);
};
