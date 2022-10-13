# ATC Mi Thermometer Service

A service that picks up BLE broadcasts from a Mi Thermometer flashed with the ATC firmware and POSTs it to Graphite.

## Installation

To get it going you need to export these environment variables:

```
GRAPHITE_USER=...
GRAPHITE_PASSWORD=...
GRAPHITE_ENDPOINT_URL=...
```

And run `ansible-playbook main.yml -i hosts` in the `ansible` directory. Remember to change the `hosts` file : )

## Customization

If you want to change where the data ends up simply change `publishMetrics()` and `formatToGraphite()` in `main.js`.

## License

MIT
