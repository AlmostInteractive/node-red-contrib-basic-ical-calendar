import { CalTriggerNode, CalNodeConfig, calcInEvent } from './node-common';
import { CalConfigNode } from './cal-config';

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
    const inEvent = calcInEvent(calConfigNode.events);

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

  const scheduleNextEvent = (node: CalTriggerNode) => {
    const calConfigNode: CalConfigNode = RED.nodes.getNode(node.config.confignode);

    const schedule = (date: Date) => {
      const nowMs = Date.now();
      const time = date.getTime();
      const oneDay = 86400 * 1000;
      const executeIn = time - nowMs + 500; // plus a buffer to make sure we're on the other side of the threshold
      const shouldSendStatus = executeIn < oneDay;

      if (node.timeout) {
        clearTimeout(node.timeout);
      }

      node._nextCheckTime = new Date(nowMs + executeIn);
      node.status({ fill: 'blue', shape: 'dot', text: `${getNextCheckTimeString(node)}` });

      node.timeout = setTimeout(() => {
        if (shouldSendStatus) {
          sendStatus(node, calConfigNode);
        }
        scheduleNextEvent(node);
      }, Math.min(executeIn, oneDay));  // max of one day
    };

    // it's a hack using `every` to run until false
    const now = new Date();
    const didSchedule = !calConfigNode.events.every(event => {
      const start = event.eventStart;
      const end = event.eventEnd;

      // if the event is ended, skip it
      if (end < now) {
        return true;
      }

      // if we're in an event, the next check is at the end
      if (start <= now && now < end) {
        schedule(event.eventEnd);
        return false;
      }

      // if the event is in the future, the next check is at the start
      if (now < start) {
        // console.log(`Scheduling ${event.summary} at ${event.eventStart} in`, start);
        schedule(event.eventStart);
        return false;
      }

      return true;
    });

    if (!didSchedule) {
      const oneDay = new Date(Date.now() + (86400 * 1000));
      schedule(oneDay);
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
