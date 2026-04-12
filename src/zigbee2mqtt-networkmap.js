import { createApp } from 'vue'
import Zigbee2mqttNetworkmapVue from './components/Zigbee2mqttNetworkmap'

class Zigbee2mqttNetworkmap extends HTMLElement {
  constructor () {
    super()
    this._config = null
    this._hass = null
    this._app = null
    this._vm = null
  }

  connectedCallback () {
    const container = document.createElement('div')
    this.appendChild(container)
    this._app = createApp(Zigbee2mqttNetworkmapVue)
    this._vm = this._app.mount(container)
    if (this._config) this._vm.config = this._config
    if (this._hass) this._vm.hass = this._hass
  }

  disconnectedCallback () {
    if (this._app) {
      this._app.unmount()
      this._app = null
      this._vm = null
    }
  }

  get hass () {
    return this._hass
  }

  set hass (hass) {
    this._hass = hass
    if (this._vm) this._vm.hass = hass
  }

  setConfig (config) {
    this._config = config
    if (this._vm) this._vm.config = config
  }
}

window.customElements.define('zigbee2mqtt-networkmap', Zigbee2mqttNetworkmap)
