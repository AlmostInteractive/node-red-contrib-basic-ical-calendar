# Node RED Basic iCal Calendar

... because naming things is hard.  This package provides two functional nodes to be able to query and react to being in (or out) of events in iCal-based calendars (eg: Google Calendar).

## Nodes

### calendar/cal-config
Configuration node.  It can automatically refresh itself periodically and in the event of a failure can use a cached backup to work from.  When the calendar is updated, the associated cal-sensor and cal-trigger nodes will automatically be aware of the up-to-date calendar information. 

### calendar/cal-sensor
On trigger, outputs true if the calendar is currently in an event, otherwise false.  Only outputs on trigger.  Output format:
`{ inEvent: boolean }`

### calendar/cal-trigger
Sends to Output 1 when an event starts.  Sends to Output 2 when an event ends.  Cannot be triggered manually (use the sensor for manual queries). Output format:
`{ inEvent: boolean }`

## Debugging
See [debugging.md](docs/debugging.md)

## Credits
Almost everything you find here was shamelessly stolen from Benjamin Neumann (@naimo84) and his repo here: https://github.com/naimo84/node-red-contrib-ical-events.  I stand on the shoulders of giants.  Thank you, Benjamin.
