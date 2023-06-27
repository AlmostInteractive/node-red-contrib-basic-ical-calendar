import { NodeMessage, NodeMessageInFlow, NodeStatusShape } from 'node-red';
import { CalNode, CalNodeConfig } from './node-common';
import { CalConfigNode } from './cal-config';

type Countdown = { days: number, hours: number, minutes: number, seconds: number };

module.exports = function (RED: any) {
  function calSensorNode(config: CalNodeConfig) {
    RED.nodes.createNode(this, config);
    const node: CalNode = this;

    node.config = config;
    node._nextCheckTime = new Date();
    node.onCalNodeConfigUpdate = () => {
      scheduleNextEvent(node);
    }

    try {
      const calConfigNode: CalConfigNode = RED.nodes.getNode(config.confignode);

      node.on('input', (msg, send, done) => {
        send = send || function () { node.send.apply(node, arguments); };
        onInput(node, msg, send, done, calConfigNode);
      });

      node.on('close', (removed, done) => {
        calConfigNode.removeUpdateListener(node);
        if (node.timeout) {
          clearTimeout(node.timeout);
        }
        done();
      });

      calConfigNode.addUpdateListener(node);
      scheduleNextEvent(node);
      node.emit('input', {});
    } catch (err) {
      node.error('Error: ' + err.message);
      node.status({ fill: 'red', shape: 'ring', text: err.message });
    }
  }

  const onInput = (node: CalNode, msg: NodeMessageInFlow, send: (msg: NodeMessage | NodeMessage[]) => void, done: (err?: Error) => void, calConfigNode: CalConfigNode) => {
    let shape: NodeStatusShape = 'ring';

    const calculateStatus = () => {
      let inEvent = false;
      const ke = calConfigNode.kalendarEvents;

      calConfigNode.events.every(event => {
        const start = ke.countdown(event.eventStart);
        const end = ke.countdown(event.eventEnd);

        if (inThePast(start) && inTheFuture(end)) {
          inEvent = true;
          return false;
        }

        return true;
      });

      send({ payload: { inEvent } });
      node.status({ fill: 'green', shape, text: `processed ${calConfigNode.events.length} events, next check in ${getNextCheckTimeString(node)}` });

      if (done) {
        done();
      }
    };

    const payload = msg.payload as any;
    if (payload && ('updateConfig' in payload) && payload.updateConfig) {
      shape = 'dot';
      calConfigNode.updateCalendar().then(calculateStatus);
    } else {
      calculateStatus();
    }
  };

  const scheduleNextEvent = (node: CalNode) => {
    const calConfigNode: CalConfigNode = RED.nodes.getNode(node.config.confignode);
    const ke = calConfigNode.kalendarEvents;

    const schedule = (date: Date) => {
      const now = Date.now();
      const time = date.getTime();
      const ms = time - now + 1000;

      if (node.timeout) {
        clearTimeout(node.timeout);
      }

      node._nextCheckTime = date;
      const timeStr = getNextCheckTimeString(node);
      node.status({ fill: 'blue', shape: 'dot', text: `next check in ${timeStr}` });
      node.log(`next check in ${timeStr}`);

      node.timeout = setTimeout(() => {
        node.emit('input', {});
        scheduleNextEvent(node);
      }, ms);
    };

    calConfigNode.events.every(event => {
      const start = ke.countdown(event.eventStart);
      const end = ke.countdown(event.eventEnd);

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
  };

  RED.nodes.registerType('cal-sensor', calSensorNode);
};

const inThePast = (countdown: Countdown) => {
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

  return (countdown.seconds <= 0);
};

const inTheFuture = (countdown: Countdown) => {
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

  return (countdown.seconds >= 0);
};

const getNextCheckTimeString = (node: CalNode) => {
  const seconds = Math.floor((node._nextCheckTime.getTime() - new Date().getTime()) / 1000);
  if (seconds < 0)
    return '';

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

  return timeStr.trim();
}
