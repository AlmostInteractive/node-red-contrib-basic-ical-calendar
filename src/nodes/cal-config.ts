import { Config, IKalenderEvent, KalenderEvents } from 'kalender-events';
import { Node } from 'node-red';
import * as NodeCache from 'node-cache';

type Countdown = { days: number, hours: number, minutes: number, seconds: number };

export interface CalConfigNodeConfig extends Config {
  name: string;
  caldav?: string;
  refresh?: number;
  refreshUnits?: 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface OnUpdateHandler {
  onCalNodeConfigUpdate: () => void;
}

export interface CalConfigNode extends Node {
  calConfigNodeConfig: CalConfigNodeConfig;
  cache?: NodeCache;
  kalendarEvents?: KalenderEvents;
  events: IKalenderEvent[];
  _interval?: NodeJS.Timer;
  _onUpdateCallbacks: OnUpdateHandler[];
  updateCalendar: () => Promise<void>;
  addUpdateListener: (callback: OnUpdateHandler) => void,
  removeUpdateListener: (callback: OnUpdateHandler) => void,
}

module.exports = function (RED: any) {
  function calConfigNode(config: CalConfigNodeConfig) {
    RED.nodes.createNode(this, config);
    const node: CalConfigNode = this;
    node.calConfigNodeConfig = config;

    node.events = [];
    node._onUpdateCallbacks = [];
    node.name = config.name;

    if (!config.type) {
      if (!config.caldav || config.caldav === 'false')
        node.type = 'ical';
      else if (config.caldav === 'true')
        node.type = 'caldav';
      else if (config.caldav === 'icloud')
        node.type = 'icloud';
    } else {
      node.type = config.type;
    }

    let seconds = 1;
    switch (node.calConfigNodeConfig.refreshUnits) {
      case 'seconds':
        seconds = node.calConfigNodeConfig.refresh;
        break;
      case 'minutes':
        seconds = node.calConfigNodeConfig.refresh * 60;
        break;
      case 'hours':
        seconds = node.calConfigNodeConfig.refresh * 60 * 60;
        break;
      case 'days':
        seconds = node.calConfigNodeConfig.refresh * 60 * 60 * 24;
        break;
    }

    node._interval = setInterval(() => updateCalendar(node), seconds * 1000);

    node.on('close', () => {
      clearInterval(node._interval);
      node._interval = undefined;
    });

    node.updateCalendar = async () => await updateCalendar(node);
    node.addUpdateListener = (callback: OnUpdateHandler) => {
      node._onUpdateCallbacks.push(callback);
    };
    node.removeUpdateListener = (callback: OnUpdateHandler) => {
      node._onUpdateCallbacks = node._onUpdateCallbacks.filter(check => check !== callback);
    };

    updateCalendar(node);
  }

  const updateCalendar = async (node: CalConfigNode) => {
    if (!node.kalendarEvents) {
      node.kalendarEvents = new KalenderEvents();
    }

    let events: IKalenderEvent[] = [];
    try {
      const eventData = await node.kalendarEvents.getEvents(node.calConfigNodeConfig);
      events = eventData.map(event => extendEvent(event, node.calConfigNodeConfig, node.kalendarEvents));

      if (node.calConfigNodeConfig.usecache) {
        if (!node.cache) {
          node.cache = new NodeCache();
        }
        node.cache.set('eventData', events);
      }

    } catch (err) {
      if (node.calConfigNodeConfig.usecache && node.cache) {
        events = node.cache.get('eventData');
      }
    }

    events.sort(countdownSort);
    node.events = events;

    node._onUpdateCallbacks.forEach(callback => {
      callback.onCalNodeConfigUpdate();
    });
  };

  RED.nodes.registerType('cal-config', calConfigNode, {
    credentials: {
      pass: { type: 'password' },
      user: { type: 'text' }
    }
  });
};

const extendEvent = (event: IKalenderEvent, config: CalConfigNodeConfig, kalenderEvents?: KalenderEvents) => {
  event.countdown = kalenderEvents.countdown(new Date(event.eventStart));
  event.countdown = kalenderEvents.countdown(new Date(event.eventStart));
  if (!event.calendarName)
    event.calendarName = config.name;
  return event;
};

const countdownSort = (a: IKalenderEvent, b: IKalenderEvent) => {
  const A = a.countdown as Countdown;
  const B = b.countdown as Countdown;

  if (A.days < B.days)
    return -1;
  else if (A.days > B.days)
    return 1;

  if (A.hours < B.hours)
    return -1;
  else if (A.hours > B.hours)
    return 1;

  if (A.minutes < B.minutes)
    return -1;
  else if (A.minutes > B.minutes)
    return 1;

  if (A.seconds < B.seconds)
    return -1;
  else if (A.seconds > B.seconds)
    return 1;

  return 0;
};
