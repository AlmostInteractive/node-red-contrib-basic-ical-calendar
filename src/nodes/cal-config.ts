import { Node } from 'node-red';
import * as NodeCache from 'node-cache';
import { CalendarConfig, CalendarEvent, icalCalendar } from 'basic-ical-events';

type Countdown = { days: number, hours: number, minutes: number, seconds: number };

export interface CalConfigNodeConfig extends CalendarConfig {
  name: string;
  refresh?: number;
  refreshUnits?: 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface OnUpdateHandler {
  onCalNodeConfigUpdate: () => void;
}

export interface CalConfigNode extends Node {
  calConfigNodeConfig: CalConfigNodeConfig;
  cache?: NodeCache;
  calendar?: icalCalendar;
  events: CalendarEvent[];
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
    if (!node.calendar) {
      node.calendar = new icalCalendar(node.calConfigNodeConfig);
    }

    await node.calendar.updateCalendar();

    const events = await node.calendar.getEvents();
    events.sort((a, b) => a < b ? -1 : 1);
    node.events = events;

    node._onUpdateCallbacks.forEach(callback => {
      callback.onCalNodeConfigUpdate();
    });
  };

  RED.nodes.registerType('cal-config', calConfigNode, {
    credentials: {
      pass: { type: 'password' },
      user: { type: 'text' },
    },
  });
};

