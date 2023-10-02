# Node RED Basic iCal Calendar

... because naming things is hard.  This package provides two functional nodes to be able to query and react to being in (or out) of events in iCal-based calendars (eg: Google Calendar).

## Nodes

### calendar/cal-config
Configuration node.  It can automatically refresh itself periodically and in the event of a failure can use a cached backup to work from.  When the calendar is updated, the associated cal-sensor and cal-trigger nodes will automatically be aware of the up-to-date calendar information. 

### calendar/cal-sensor
On trigger, outputs true if the calendar is currently in an event, otherwise false.  Only outputs on trigger.  Output format:
`{ inEvent: boolean, events: CalendarEvent[] }` where `events` are the events that are currently in progress (so that'll be an empty array when `inEvent` is false. 
If the triggering message includes `forceCalendarUpdate: true` then the calendar will be re-fetched before querying.

### calendar/cal-trigger
Sends to Output 1 when an event starts.  Sends to Output 2 when an event ends.  Cannot be triggered manually (use the sensor for manual queries).  `inEvent` is true if the event is starting, otherwise false.  `event` is the triggering event. Output format:
`{ inEvent: boolean, event: CalendarEvent }`

## Debugging
See [debugging.md](docs/debugging.md)

## Credits
Almost everything you find here was shamelessly stolen from Benjamin Neumann (@naimo84) and his repo here: https://github.com/naimo84/node-red-contrib-ical-events.  I stand on the shoulders of giants.  Thank you, Benjamin.
