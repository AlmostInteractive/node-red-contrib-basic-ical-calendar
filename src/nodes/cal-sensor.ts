import { NodeMessage, NodeMessageInFlow, NodeStatusShape } from 'node-red';
import { CalSensorNode, CalNodeConfig, inTheFuture, inThePast } from './node-common';
import { CalConfigNode } from './cal-config';

module.exports = function (RED: any) {
  function calSensorNode(config: CalNodeConfig) {
    RED.nodes.createNode(this, config);
    const node: CalSensorNode = this;

    node.config = config;

    try {
      const calConfigNode: CalConfigNode = RED.nodes.getNode(config.confignode);

      node.on('input', (msg, send, done) => {
        send = send || function () { node.send.apply(node, arguments); };
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
      node.status({ fill: 'green', shape, text: `processed ${calConfigNode.events.length} events, in event: ${inEvent}` });

      if (done) {
        done();
      }
    };

    const payload = msg.payload as any;
    if (payload && (typeof payload === 'object') && payload.hasOwnProperty('updateConfig') && payload.updateConfig) {
      shape = 'dot';
      calConfigNode.updateCalendar().then(calculateStatus);
    } else {
      calculateStatus();
    }
  };

  RED.nodes.registerType('cal-sensor', calSensorNode);
};
