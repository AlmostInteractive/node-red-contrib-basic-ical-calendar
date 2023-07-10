import { NodeMessage, NodeMessageInFlow, NodeStatusShape } from 'node-red';
import { CalSensorNode, CalNodeConfig, calcInEvent } from './node-common';
import { CalConfigNode } from './cal-config';
import { icalCalendar } from 'basic-ical-events';

module.exports = function (RED: any) {
  function calSensorNode(config: CalNodeConfig) {
    RED.nodes.createNode(this, config);
    const node: CalSensorNode = this;

    node.config = config;

    const calConfigNode: CalConfigNode = RED.nodes.getNode(config.confignode);
    if (!calConfigNode) {
      node.status({ fill: 'red', shape: 'ring', text: `Missing configuration node` });
      return;
    }

    try {
      node.on('input', (msg, send, done) => {
        send = send || function () {
          node.send.apply(node, arguments);
        };

        const calConfigNode: CalConfigNode = RED.nodes.getNode(config.confignode);
        if (!calConfigNode) {
          node.status({ fill: 'red', shape: 'ring', text: `Missing configuration node` });
          return;
        }

        node.status({ fill: 'grey', shape: 'ring', text: `Working...` });

        onInput(node, msg, send, done, calConfigNode);
      });
    } catch (err) {
      node.error('Error: ' + err.message);
      node.status({ fill: 'red', shape: 'ring', text: err.message });
    }
  }

  const onInput = (node: CalSensorNode, msg: NodeMessageInFlow, send: (msg: NodeMessage | NodeMessage[]) => void, done: (err?: Error) => void, calConfigNode: CalConfigNode) => {
    let shape: NodeStatusShape = 'ring';

    const calculateStatus = () => {
      const inEvent = calcInEvent(calConfigNode.events);

      send({ payload: { inEvent } });
      node.status({
        fill: 'green',
        shape,
        text: `processed ${calConfigNode.events.length} events, in event: ${inEvent}`,
      });

      if (done) {
        done();
      }
    };

    if (msg && 'forceCalendarUpdate' in msg && (typeof msg.forceCalendarUpdate === 'boolean') && msg.forceCalendarUpdate) {
      shape = 'dot';
      calConfigNode.updateCalendar().then(calculateStatus);
    } else {
      calculateStatus();
    }
  };

  RED.nodes.registerType('cal-sensor', calSensorNode);
};
