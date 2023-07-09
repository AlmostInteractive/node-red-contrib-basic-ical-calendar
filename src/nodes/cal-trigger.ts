import {
  CalTriggerNode,
  CalNodeConfig,
  inTheFuture,
  inThePast,
} from './node-common';
import { CalConfigNode } from './cal-config';
import { icalCalendar } from 'basic-ical-events';

module.exports = function (RED: any) {
  function calTriggerNode(config: CalNodeConfig) {
    RED.nodes.createNode(this, config);
    const node: CalTriggerNode = this;

    node.config = config;
    node._nextCheckTime = new Date();
    node.onCalNodeConfigUpdate = () => {
      scheduleNextEvent(node);
    };

    try {
      const calConfigNode: CalConfigNode = RED.nodes.getNode(config.confignode);
      if (!calConfigNode) {
        node.status({ fill: 'red', shape: 'ring', text: 'Missing configuration node' });
        return;
      }

      node.on('close', (removed, done) => {
        calConfigNode.removeUpdateListener(node);
        if (node.timeout) {
          clearTimeout(node.timeout);
        }
        done();
      });

      calConfigNode.addUpdateListener(node);
      scheduleNextEvent(node);
    } catch (err) {
      node.error('Error: ' + err.message);
      node.status({ fill: 'red', shape: 'ring', text: err.message });
    }
  }

  const sendStatus = (node: CalTriggerNode, calConfigNode: CalConfigNode) => {
    const calculateStatus = () => {
      const inEvent = !calConfigNode.events.every(event => {
        const start = icalCalendar.countdown(event.eventStart);
        const end = icalCalendar.countdown(event.eventEnd);

        return !(inThePast(start) && inTheFuture(end));
      });

      if (inEvent) {
        node.send({ payload: { inEvent } });
      } else {
        node.send([null, { payload: { inEvent } }]);
      }

      node.status({
        fill: 'green',
        shape: 'ring',
        text: `${calConfigNode.events.length} events, in event ${inEvent}, ${getNextCheckTimeString(node)}`,
      });
    };

    calculateStatus();
  };

  const scheduleNextEvent = (node: CalTriggerNode) => {
    const calConfigNode: CalConfigNode = RED.nodes.getNode(node.config.confignode);

    const schedule = (date: Date) => {
      const now = Date.now();
      const time = date.getTime();
      const executeIn = Math.min(86400 * 1000, time - now) + 500; // max of one day plus a buffer to make sure we're on the other side of the threshold

      if (node.timeout) {
        clearTimeout(node.timeout);
      }

      node._nextCheckTime = new Date(now + executeIn);
      node.status({ fill: 'blue', shape: 'dot', text: `${getNextCheckTimeString(node)}` });

      node.timeout = setTimeout(() => {
        sendStatus(node, calConfigNode);
        scheduleNextEvent(node);
      }, executeIn);
    };

    // it's a hack using `every` to run until false
    const didSchedule = !calConfigNode.events.every(event => {
      const start = icalCalendar.countdown(event.eventStart);
      const end = icalCalendar.countdown(event.eventEnd);

      // if the event is ended, skip it
      if (inThePast(end)) {
        return true;
      }

      // if we're in an event, the next check is at the end
      if (inThePast(start) && inTheFuture(end)) {
        schedule(event.eventEnd);
        return false;
      }

      // if the event is in the future, the next check is at the start
      if (inTheFuture(start)) {
        schedule(event.eventStart);
        return false;
      }

      return true;
    });

    if (!didSchedule) {
      node.status({ fill: 'blue', shape: 'ring', text: `No events found` });
    }
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
