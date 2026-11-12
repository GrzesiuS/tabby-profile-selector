# Tabby Profile Selector Plugin

A Material Design profile selector plugin for Tabby terminal focused on clean, user-curated terminal profiles.

![Profile Selector Screenshot](https://raw.githubusercontent.com/D3VL/tabby-profile-selector/refs/heads/main/images/screenshot1.png)

## Features

- **Curated by Default**: Starts with an empty state prompting configuration; `Built-in` profiles and `.ssh/config` imports are hidden by default, and the `Recent` section is removed.
- **Quick Setup**: One-click option on the empty state to reveal `Built-in` profiles, or create custom profiles derived from built-in templates.
- **Material Design Tiles**: Clean cards displaying only the profile icon, name, and color accent (hiding raw executable descriptions).
- **Simple Icons & Custom SVG Support**: Built-in `simple-icons` brand picker, FontAwesome support, and custom SVG upload/paste.
- **Smart SVG Color Extraction**: Automatically suggests a profile color when adding a colored custom SVG icon, while always allowing manual color selection.
- **Fastfetch System Overview**: Displays a formatted Material Design `fastfetch` system summary (with colored ASCII logo, spec cards, or classic terminal view) in the space below profiles, or a clear notice if `fastfetch` is not detected.
- **Integrated Configuration**: Manage visibility toggles and profiles both directly inside the Profile Selector tab and under **Settings → Profile Selector**.

## Development & Local Build

```bash
npm install --legacy-peer-deps
npm run build
```

## Local Installation in Tabby

Copy the plugin folder (containing `package.json` and the built `dist/` directory) into Tabby's user plugins directory:

- **Windows**: `%APPDATA%\tabby\plugins\node_modules\tabby-profile-selector`
- **Linux**: `~/.config/tabby/plugins/node_modules/tabby-profile-selector`
- **macOS**: `~/Library/Application Support/tabby/plugins/node_modules/tabby-profile-selector`

Restart Tabby after copying the files.

## License

MIT License - feel free to use and modify this plugin for your needs.

## Credits

Developed by D3VL
