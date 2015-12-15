# Usage

This is a plugin for Tat Webui, see https://github.com/ovh/tatwebui

See Tat Engine for more information: https://github.com/ovh/tat

## Configuration
In plugin.tpl.json file, add this line :

```
"tatwebui-plugin-releaseview": "git+https://github.com/ovh/tatwebui-plugin-releaseview.git"
```

Add in config.json (client side) of tatwebui this attribute :

```
"releaseview": {
  "tracker": "RELEASEVIEW_TRACKER",
  "keyword": "RELEASEVIEW_KEYWORD"
},
```

Set tracker with your issue tracker system.

Set keyword to your issue tracker.

Example : if you write a
message like "feat: a big feature #RELEASE_KEYWORD:AAA-1", an url will be generated on tatwebui :
$RELEASE_TRACKER/AAA-1


# Hacking

You've developed a new cool feature? Fixed an annoying bug? We'd be happy
to hear from you! Make sure to read [CONTRIBUTING.md](./CONTRIBUTING.md) before.
