import { OnUpdateHandler } from './cal-config';
import { Node, NodeDef } from 'node-red';
import { CalendarEvent } from 'basic-ical-events';

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

type EventTimeoutPair = {
  start: NodeJS.Timeout;
  end: NodeJS.Timeout;
}
export interface CalTriggerNode extends Node, OnUpdateHandler {
  config: CalNodeConfig;
  _scheduleNextEventsTimeout?: NodeJS.Timeout;
  _eventTimeoutPairs?: Map<CalendarEvent, EventTimeoutPair>;
  _nextCheckTime?: Date;
}

export const calcInEvent = (events: CalendarEvent[]) => {
  const now = new Date();
  return !events.every(event => {
    const start = event.eventStart;
    const end = event.eventEnd;

    // the event has ended or hasn't yet started
    return (end <= now || now < start);
  });
}

export const getCurrentEvents = (events: CalendarEvent[]) => {
  const now = new Date();
  return events.filter(event => {
    const start = event.eventStart;
    const end = event.eventEnd;

    // the event has started and hasn't ended
    return (start <= now && now < end);
  });
}
