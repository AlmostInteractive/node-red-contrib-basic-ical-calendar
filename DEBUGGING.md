
### Setup
First of all, we have to install Node-RED locally as a global package

```npm i -g node-red```

run node-red once and shutdown it after a few seconds, in order to generate a .node-red folder in your $HOME folder

```node-red```

### Create launch.json
If using VScode, create a launch.json under ~/.node-red/.vscode (but with your correct `outFiles` value):

```
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "attach",
            "name": "Attach to node-red",
            "port": 9229,
            "trace": true,
            "sourceMaps": true,
            "outFiles": ["/Users/whatever/.node-red/node_modules/node-red-contrib-basic-ical-calendar/dist/**/*.js"]
        }
    ]
}
```

### Install package

Now clone node-red-contrib-basic-ical-calendar and install the dependencies.

```
cd $HOME
git clone https://github.com/AlmostInteractive/node-red-contrib-basic-ical-calendar.git
npm i
```

Connect node-red-contrib-basic-ical-calendar via npm install to the $HOME/.node-red folder

```
cd $HOME/.node-red
npm install $HOME/node-red-contrib-basic-ical-calendar
```

The package.json under $HOME/.node-red should now look like the following:

```
{
    "name": "node-red-project",
    "description": "A Node-RED Project",
    "version": "0.0.1",
    "private": true,
    "dependencies": {
        "node-red-contrib-basic-ical-calendar": "file:../node-red-contrib-basic-ical-calendar"
    }
}
```

Now it's really important to open the correct folder as you can see under topic **Create launch.json**.

The correct folder to get a breakpoint into the module is:

`$HOME/.node-red/node_modules/node-red-contrib-basic-ical-calendar`

Run the npm `dev` task, which opens a remote debugging
(opens new window) port 9229

```
cd $HOME/.node-red/node_modules/node-red-contrib-basic-ical-calendar
npm run dev
```

Attach to node-red under VS Code's "Run and Debug"

Now open http://localhost:1880
(opens new window) and add a node, trigger it and happy debugging ;) 
