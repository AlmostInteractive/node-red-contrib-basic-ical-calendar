import { Node } from 'node-red';
import * as NodeCache from 'node-cache';
import { CalendarConfig, CalendarEvent, EventsFilter, icalCalendar } from 'basic-ical-events';


export interface CalConfigNodeConfig extends CalendarConfig {
  name: string;
  refresh?: string;
  refreshUnits?: 'seconds' | 'minutes' | 'hours' | 'days';
  pastViewWindowAmount?: string;
  pastViewWindowUnits?: 'hours' | 'days';
  futureViewWindowAmount?: string;
  futureViewWindowUnits?: 'hours' | 'days';
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

    let updateIntervalSeconds = 1;
    const refresh = Math.max(1, parseInt(node.calConfigNodeConfig.refresh));
    switch (node.calConfigNodeConfig.refreshUnits) {
      case 'seconds':
        updateIntervalSeconds = refresh;
        break;
      case 'minutes':
        updateIntervalSeconds = refresh * 60;
        break;
      case 'hours':
        updateIntervalSeconds = refresh * 60 * 60;
        break;
      case 'days':
        updateIntervalSeconds = refresh * 60 * 60 * 24;
        break;
    }
    updateIntervalSeconds = Math.min(2 * 86400, updateIntervalSeconds); // max two days
    node._interval = setInterval(() => updateCalendar(node), updateIntervalSeconds * 1000);

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

    try {
      await node.calendar.updateCalendar();

      const filter: EventsFilter = {
        pastViewWindow: {
          amount: 3,
          units: 'days',
        },
        futureViewWindow: {
          amount: 3,
          units: 'days',
        },
      };

      const events = await node.calendar.getEvents(filter);
      events.sort((a, b) => a.eventStart < b.eventStart ? -1 : 1);
      node.events = events;

      node._onUpdateCallbacks.forEach(callback => {
        callback.onCalNodeConfigUpdate();
      });
    } catch (error) {
      node.error(`updateCalendar error: ${error.message}`);
    }
  };

  RED.nodes.registerType('cal-config', calConfigNode);
};

