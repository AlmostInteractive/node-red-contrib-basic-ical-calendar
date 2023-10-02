import { CalTriggerNode, CalNodeConfig } from './node-common';
import { CalConfigNode } from './cal-config';
import { CalendarEvent } from 'basic-ical-events';

const ONE_DAY_MS = 86400 * 1000;

module.exports = function (RED: any) {
  function calTriggerNode(config: CalNodeConfig) {
    RED.nodes.createNode(this, config);
    const node: CalTriggerNode = this;

    node.config = config;
    node._eventTimeoutPairs = new Map();

    const clearAllTimeouts = () => {
      clearTimeout(node._scheduleNextEventsTimeout);

      node._eventTimeoutPairs.forEach(timeoutPair => {
        clearTimeout(timeoutPair.start);
        clearTimeout(timeoutPair.end);
      });
      node._eventTimeoutPairs = new Map();
    };

    node.onCalNodeConfigUpdate = () => {
      clearAllTimeouts();
      scheduleNextEvents(node);

      const calConfigNode: CalConfigNode = RED.nodes.getNode(config.confignode);
      node.status({
        fill: 'green',
        shape: 'dot',
        text: `triggering on ${calConfigNode.events.length} events`,
      });
    };

    try {
      const calConfigNode: CalConfigNode = RED.nodes.getNode(config.confignode);
      if (!calConfigNode) {
        node.status({ fill: 'red', shape: 'ring', text: 'Missing configuration node' });
        return;
      }

      node.on('close', (removed, done) => {
        calConfigNode.removeUpdateListener(node);
        clearAllTimeouts();
        done();
      });

      calConfigNode.addUpdateListener(node);
      scheduleNextEvents(node);

      node.status({
        fill: 'blue',
        shape: 'dot',
        text: `triggering on ${calConfigNode.events.length} events`,
      });
    } catch (err) {
      node.error('Error: ' + err.message);
      node.status({ fill: 'red', shape: 'ring', text: err.message });
    }
  }

  const sendNodeOutput = (event: CalendarEvent, inEvent: boolean, node: CalTriggerNode) => {
    if (inEvent) {
      node.send({ payload: { inEvent, event } });
    } else {
      node.send([null, { payload: { inEvent, event } }]);
    }
  };

  const scheduleNextEvents = (node: CalTriggerNode) => {
    const calConfigNode: CalConfigNode = RED.nodes.getNode(node.config.confignode);

    const schedule = (event: CalendarEvent, starting: boolean, date: Date) => {
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

      if (executeIn < 0) {
        node.error(`Attempting to schedule in the past: ${event.summary} ${starting}`);
        return false;
      }

      // only schedule if it'll execute within a day
      if (executeIn > ONE_DAY_MS) {
        node.error(`Attempting to schedule further out than one day: ${event.summary} ${starting}`);
        return false;
      }

      const timeout = setTimeout(() => {
        sendNodeOutput(event, starting, node);
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

      if (now < start) {
        schedule(event, true, event.eventStart);
      }

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
