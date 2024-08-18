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
        ieeeAddr: 'node-01',
        type: 'Coordinator'
      },
      {
        friendlyName: 'Door',
        definition: {
          model: 'MCCGQ14LM'
        },
        ieeeAddr: 'node-02',
        type: 'EndDevice'
      },
      {
        friendlyName: 'Heating',
        definition: {
          model: 'GS361A-H04'
        },
        ieeeAddr: 'node-04',
        type: 'EndDevice'
      },
      {
        friendlyName: 'Motion',
        definition: {
          model: '9290030675'
        },
        ieeeAddr: 'node-05',
        type: 'EndDevice'
      },
      {
        friendlyName: 'Humidity',
        definition: {
          model: 'WSDCGQ11LM'
        },
        ieeeAddr: 'node-06',
        type: 'EndDevice'
      },
      {
        friendlyName: 'Relay',
        definition: {
          model: 'TYWB 4ch-RF'
        },
        ieeeAddr: 'node-07',
        type: 'Router'
      },
      {
        friendlyName: 'Plug Switch',
        definition: {
          model: 'AC10691'
        },
        ieeeAddr: 'node-08',
        type: 'Router'
      },
      {
        friendlyName: 'Water',
        definition: {
          model: 'SJCGQ11LM'
        },
        ieeeAddr: 'node-09',
        type: 'EndDevice'
      },
      {
        friendlyName: 'Smoke',
        definition: {
          model: 'R7049'
        },
        ieeeAddr: 'node-10',
        type: 'EndDevice'
      },
      {
        friendlyName: 'TRETAKT',
        definition: {
          model: 'E2204'
        },
        ieeeAddr: 'node-11',
        type: 'Router'
      }
    ]

    const attrs = [
      {
        links: [
          {
            lqi: 17,
            sourceIeeeAddr: 'node-04',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 69,
            sourceIeeeAddr: 'node-05',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 13,
            sourceIeeeAddr: 'node-06',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 35,
            sourceIeeeAddr: 'node-07',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 41,
            sourceIeeeAddr: 'node-01',
            targetIeeeAddr: 'node-07'
          },
          {
            lqi: 26,
            sourceIeeeAddr: 'node-03',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 120,
            sourceIeeeAddr: 'node-02',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 32,
            sourceIeeeAddr: 'node-09',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 70,
            sourceIeeeAddr: 'node-10',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 160,
            sourceIeeeAddr: 'node-07',
            targetIeeeAddr: 'node-08'
          },
          {
            lqi: 65,
            sourceIeeeAddr: 'node-08',
            targetIeeeAddr: 'node-07'
          },
          {
            lqi: 75,
            sourceIeeeAddr: 'node-01',
            targetIeeeAddr: 'node-08'
          },
          {
            lqi: 250,
            sourceIeeeAddr: 'node-08',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 42,
            sourceIeeeAddr: 'node-11',
            targetIeeeAddr: 'node-08'
          },
          {
            lqi: 84,
            sourceIeeeAddr: 'node-08',
            targetIeeeAddr: 'node-11'
          }
        ],
        nodes: devices
      },
      {
        links: [
          {
            lqi: 17,
            sourceIeeeAddr: 'node-04',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 69,
            sourceIeeeAddr: 'node-05',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 13,
            sourceIeeeAddr: 'node-06',
            targetIeeeAddr: 'node-08'
          },
          {
            lqi: 35,
            sourceIeeeAddr: 'node-07',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 41,
            sourceIeeeAddr: 'node-01',
            targetIeeeAddr: 'node-07'
          },
          {
            lqi: 47,
            sourceIeeeAddr: 'node-02',
            targetIeeeAddr: 'node-07'
          },
          {
            lqi: 32,
            sourceIeeeAddr: 'node-09',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 70,
            sourceIeeeAddr: 'node-10',
            targetIeeeAddr: 'node-01'
          },
          {
            lqi: 80,
            sourceIeeeAddr: 'node-07',
            targetIeeeAddr: 'node-08'
          },
          {
            lqi: 40,
            sourceIeeeAddr: 'node-08',
            targetIeeeAddr: 'node-07'
          },
          {
            lqi: 90,
            sourceIeeeAddr: 'node-01',
            targetIeeeAddr: 'node-08'
          },
          {
            lqi: 50,
            sourceIeeeAddr: 'node-08',
            targetIeeeAddr: 'node-01'
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
