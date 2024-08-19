import '@material/mwc-button'
import './ha-card'
customElements.whenDefined('zigbee2mqtt-networkmap').then(() => {
  function createHass () {
    function pad (str) {
      return String('00' + str).slice(-2)
    }

    function format (d) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }

    const devices = [
      {
        friendlyName: 'Coordinator',
        ieeeAddr: 'node-Coord',
        type: 'Coordinator'
      },
      {
        friendlyName: 'Door',
        definition: {
          model: 'MCCGQ14LM'
        },
        ieeeAddr: 'node-Door',
        type: 'EndDevice'
      },
      {
        friendlyName: 'Heating',
        definition: {
          model: 'GS361A-H04'
        },
        ieeeAddr: 'node-Heating',
        type: 'EndDevice'
      },
      {
        friendlyName: 'Motion',
        definition: {
          model: '9290030675'
        },
        ieeeAddr: 'node-Motion',
        type: 'EndDevice'
      },
      {
        friendlyName: 'Humidity',
        definition: {
          model: 'WSDCGQ11LM'
        },
        ieeeAddr: 'node-Humid',
        type: 'EndDevice'
      },
      {
        friendlyName: 'Relay',
        definition: {
          model: 'TYWB 4ch-RF'
        },
        ieeeAddr: 'node-Relay',
        type: 'Router'
      },
      {
        friendlyName: 'Plug Switch',
        definition: {
          model: 'AC10691'
        },
        ieeeAddr: 'node-Plug',
        type: 'Router'
      },
      {
        friendlyName: 'Water',
        definition: {
          model: 'SJCGQ11LM'
        },
        ieeeAddr: 'node-Water',
        type: 'EndDevice'
      },
      {
        friendlyName: 'Smoke',
        definition: {
          model: 'R7049'
        },
        ieeeAddr: 'node-Smoke',
        type: 'EndDevice'
      },
      {
        friendlyName: 'TRETAKT',
        definition: {
          model: 'E2204'
        },
        ieeeAddr: 'node-Tretakt',
        type: 'Router'
      }
    ]

    const attrs = [
      {
        links: [
          {
            lqi: 17,
            sourceIeeeAddr: 'node-Heating',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 69,
            sourceIeeeAddr: 'node-Motion',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 13,
            sourceIeeeAddr: 'node-Humid',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 35,
            sourceIeeeAddr: 'node-Relay',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 41,
            sourceIeeeAddr: 'node-Coord',
            targetIeeeAddr: 'node-Relay'
          },
          {
            lqi: 26,
            sourceIeeeAddr: 'node-03',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 120,
            sourceIeeeAddr: 'node-Door',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 32,
            sourceIeeeAddr: 'node-Water',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 70,
            sourceIeeeAddr: 'node-Smoke',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 160,
            sourceIeeeAddr: 'node-Relay',
            targetIeeeAddr: 'node-Plug'
          },
          {
            lqi: 65,
            sourceIeeeAddr: 'node-Plug',
            targetIeeeAddr: 'node-Relay'
          },
          {
            lqi: 75,
            sourceIeeeAddr: 'node-Coord',
            targetIeeeAddr: 'node-Plug'
          },
          {
            lqi: 250,
            sourceIeeeAddr: 'node-Plug',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 42,
            sourceIeeeAddr: 'node-Tretakt',
            targetIeeeAddr: 'node-Plug'
          },
          {
            lqi: 84,
            sourceIeeeAddr: 'node-Plug',
            targetIeeeAddr: 'node-Tretakt'
          }
        ],
        nodes: devices
      },
      {
        links: [
          {
            lqi: 17,
            sourceIeeeAddr: 'node-Heating',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 69,
            sourceIeeeAddr: 'node-Motion',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 13,
            sourceIeeeAddr: 'node-Humid',
            targetIeeeAddr: 'node-Plug'
          },
          {
            lqi: 35,
            sourceIeeeAddr: 'node-Relay',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 41,
            sourceIeeeAddr: 'node-Coord',
            targetIeeeAddr: 'node-Relay'
          },
          {
            lqi: 47,
            sourceIeeeAddr: 'node-Door',
            targetIeeeAddr: 'node-Relay'
          },
          {
            lqi: 32,
            sourceIeeeAddr: 'node-Water',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 70,
            sourceIeeeAddr: 'node-Smoke',
            targetIeeeAddr: 'node-Coord'
          },
          {
            lqi: 80,
            sourceIeeeAddr: 'node-Relay',
            targetIeeeAddr: 'node-Plug'
          },
          {
            lqi: 40,
            sourceIeeeAddr: 'node-Plug',
            targetIeeeAddr: 'node-Relay'
          },
          {
            lqi: 90,
            sourceIeeeAddr: 'node-Coord',
            targetIeeeAddr: 'node-Plug'
          },
          {
            lqi: 50,
            sourceIeeeAddr: 'node-Plug',
            targetIeeeAddr: 'node-Coord'
          }
        ],
        nodes: devices
      }
    ]
    // dummy "backend" for development
    const hass = {
      count: 0,
      callService (platform, operation, data) {
        const mqttBaseTopic = net._config.mqtt_base_topic || 'zigbee2mqtt'
        if (data.topic === mqttBaseTopic + '/bridge/request/networkmap') {
          this.count++
          document.querySelector('zigbee2mqtt-networkmap').hass = Object.assign({}, hass, {
            count: this.count,
            states: {
              'sensor.zigbee2mqtt_networkmap': {
                state: format(new Date()),
                attributes: attrs[this.count % 2]
              },
              'sensor.zigbee2mqtt_networkmap_layout': {
                state: format(new Date()),
                attributes: localStorage.getItem('layout') ? JSON.parse(localStorage.getItem('layout')) : null
              }
            }
          })
        } else {
          localStorage.setItem('layout', data.payload)
        }
      },
      states: {
        'sensor.zigbee2mqtt_networkmap': {
          state: format(new Date()),
          attributes: attrs[0]
        },
        'sensor.zigbee2mqtt_networkmap_layout': {
          state: format(new Date()),
          attributes: localStorage.getItem('layout') ? JSON.parse(localStorage.getItem('layout')) : null
        }
      }
    }
    return hass
  }

  const net = document.querySelector('zigbee2mqtt-networkmap')
  net.setConfig({
    type: 'custom:zigbee2mqtt-networkmap',
    entity: 'sensor.zigbee2mqtt_networkmap',
    layout_entity: 'sensor.zigbee2mqtt_networkmap_layout',
    mqtt_base_topic: 'zigbee2mqtt'
  })
  net.hass = createHass()
})
