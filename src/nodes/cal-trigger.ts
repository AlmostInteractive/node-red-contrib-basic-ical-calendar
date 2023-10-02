import { CalTriggerNode, CalNodeConfig, calcInEvent } from './node-common';
import { CalConfigNode } from './cal-config';
import { CalendarEvent } from 'basic-ical-events';

const ONE_DAY_MS = 86400 * 1000;

module.exports = function (RED: any) {
  function calTriggerNode(config: CalNodeConfig) {
    RED.nodes.createNode(this, config);
    const node: CalTriggerNode = this;

    node.config = config;
    node._nextCheckTime = new Date();
    node._eventTimeoutPairs = new Map();

    const clearTimeouts = () => {
      clearTimeout(node._scheduleNextEventsTimeout);

      node._eventTimeoutPairs.forEach(timeoutPair => {
        clearTimeout(timeoutPair.start);
        clearTimeout(timeoutPair.end);
      });
      node._eventTimeoutPairs = new Map();
    };

    node.onCalNodeConfigUpdate = () => {
      clearTimeouts();
      scheduleNextEvents(node);
    };

    try {
      const calConfigNode: CalConfigNode = RED.nodes.getNode(config.confignode);
      if (!calConfigNode) {
        node.status({ fill: 'red', shape: 'ring', text: 'Missing configuration node' });
        return;
      }

      node.on('close', (removed, done) => {
        calConfigNode.removeUpdateListener(node);
        clearTimeouts();
        done();
      });

      calConfigNode.addUpdateListener(node);
      scheduleNextEvents(node);
    } catch (err) {
      node.error('Error: ' + err.message);
      node.status({ fill: 'red', shape: 'ring', text: err.message });
    }
  }

  const sendStatus = (event: CalendarEvent, inEvent: boolean, node: CalTriggerNode, calConfigNode: CalConfigNode) => {
    if (inEvent) {
      node.send({ payload: { inEvent, event } });
    } else {
      node.send([null, { payload: { inEvent, event } }]);
    }

    node.status({
      fill: 'green',
      shape: 'ring',
      text: `${calConfigNode.events.length} events, in event ${inEvent}, ${getNextCheckTimeString(node)}`,
    });
  };

  const scheduleNextEvents = (node: CalTriggerNode) => {
    const calConfigNode: CalConfigNode = RED.nodes.getNode(node.config.confignode);

    const schedule = (event: CalendarEvent, starting: boolean, date: Date) => {
      const now = new Date();
      const nowMs = Date.now();
      const time = date.getTime();
      const executeIn = time - nowMs + 250; // plus a buffer to make sure we're on the other side of the threshold
      const timeoutPair = node._eventTimeoutPairs.get(event) || { start: null, end: null };

      // clear any existing timeout
      if (starting) {
        clearTimeout(timeoutPair.start);
      } else {
        clearTimeout(timeoutPair.end);
      }

      // only schedule if it'll execute within a day
      if (executeIn > ONE_DAY_MS) {
        node.error(`Attempting to schedule further out than one day: ${event.summary}`);
        return false;
      }

      // set _nextCheckTime to the date if _nct is in the past, or the earliest of the date or _nct if otherwise
      if (node._nextCheckTime < now) {
        if (date < node._nextCheckTime) {
          node._nextCheckTime = date;
          node.status({ fill: 'blue', shape: 'dot', text: `${getNextCheckTimeString(node)}` });
        }
      }

      const timeout = setTimeout(() => {
        sendStatus(event, starting, node, calConfigNode);
        // cleanup the map when the event ends
        if (!starting) {
          node._eventTimeoutPairs.delete(event);
        }
      }, executeIn);

      if (starting) {
        timeoutPair.start = timeout;
      } else {
        timeoutPair.end = timeout;
      }
      node._eventTimeoutPairs.set(event, timeoutPair);

      return true;
    };

    const now = new Date();
    const inOneDay = new Date(Date.now() + ONE_DAY_MS);

    // schedule each event upcoming in the next day
    calConfigNode.events.forEach(event => {
      const start = event.eventStart;
      const end = event.eventEnd;

      // if the event is ended or won't start within a day, skip it
      if (end < now || inOneDay < start) {
        return;
      }

      schedule(event, true, event.eventStart);

      if (end < inOneDay) {
        schedule(event, false, event.eventEnd);
      }
    });

    clearTimeout(node._scheduleNextEventsTimeout);
    node._scheduleNextEventsTimeout = setTimeout(() => {
      scheduleNextEvents(node);
    }, ONE_DAY_MS / 2);
  };

  RED.nodes.registerType('cal-trigger', calTriggerNode);
};


const getNextCheckTimeString = (node: CalTriggerNode) => {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  const dateString = node._nextCheckTime.toLocaleDateString(undefined, options);

  const seconds = Math.floor((node._nextCheckTime.getTime() - new Date().getTime()) / 1000);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);

  let timeStr = '';
  if (d > 0) {
    timeStr += `${d}d `;
  }
  if (h > 0) {
    timeStr += `${h}h `;
  }
  if (m > 0) {
    timeStr += `${m}m `;
  }
  if (s > 0) {
    timeStr += `${s}s`;
  }

  return `next check at ${dateString} [${timeStr.trim()}]`;
};
