<template>
  <ha-card>
    <v-style>
      .flex {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      {{ css }}
    </v-style>
    <network
      class="network"
      ref="network"
      v-bind:nodes="nodes"
      v-bind:edges="edges"
      v-bind:options="options"
      v-on:click="networkEvent('click')"
      v-on:double-click="networkEvent('doubleClick')"
      v-on:oncontext="networkEvent('oncontext')"
      v-on:hold="networkEvent('hold')"
      v-on:release="dragRelease"
      v-on:select="networkEvent('select')"
      v-on:select-node="networkEvent('select-node')"
      v-on:select-edge="networkEvent('selectEdge')"
      v-on:deselect-node="networkEvent('deselectNode')"
      v-on:deselect-edge="networkEvent('deselectEdge')"
      v-on:drag-start="networkEvent('dragStart')"
      v-on:dragging="dragging"
      v-on:drag-end="networkEvent('dragEnd')"
      v-on:hover-node="networkEvent('hoverNode')"
      v-on:blur-node="networkEvent('blurNode')"
      v-on:hover-edge="networkEvent('hoverEdge')"
      v-on:blur-edge="networkEvent('blurEdge')"
      v-on:zoom="networkEvent('zoom')"
      v-on:show-popup="networkEvent('showPopup')"
      v-on:hide-popup="networkEvent('hidePopup')"
      v-on:start-stabilizing="networkEvent('startStabilizing')"
      v-on:stabilization-progress="networkEvent('stabilizationProgress')"
      v-on:stabilization-iterations-done="networkEvent('stabilizationIterationsDone')"
      v-on:stabilized="stabilized"
      v-on:resize="onResize"
      v-on:init-redraw="networkEvent('initRedraw')"
      v-on:before-drawing="networkEvent('beforeDrawing')"
      v-on:after-drawing="networkEvent('afterDrawing')"
      v-on:animation-finished="networkEvent('animationFinished')"
      v-on:config-change="networkEvent('configChange')"
      v-on:nodes-mounted="networkEvent('nodes-mounted')"
      v-on:nodes-add="networkEvent('nodes-add')"
      v-on:nodes-update="networkEvent('nodes-update')"
      v-on:nodes-remove="networkEvent('nodes-remove')"
      v-on:edges-mounted="networkEvent('edges-mounted')"
      v-on:edges-add="networkEvent('edges-add')"
      v-on:edges-update="networkEvent('edges-update')"
      v-on:edges-remove="networkEvent('edges-remove')"
    ></network>
    <div id="card-actions" class="card-actions">
      <div class="flex">
        <mwc-button @click="refresh">Refresh</mwc-button>
        <div>
        <input type="checkbox" id="lqi" v-model="showLqi" @change="toggleLqi($event)">
        <label for="checkbox">LQI</label>
        </div>
        <div>{{ state }}</div>
      </div>
    </div>
  </ha-card>
</template>

<script>
import { Network } from 'vue-visjs'
import isEqual from 'lodash.isequal'

export default {
  components: {
    Network
  },
  data () {
    return {
      networkEvents: '',
      initialized: false,
      config: {},
      hass: null,
      nodes: [],
      edges: [],
      state: '',
      showLqi: false,
      options: {
        autoResize: true,
        height: this.calcWindowHeight().toString()
        /*
        configure: {
          enabled: true,
          showButton: true
        }
        */
      }
    }
  },
  computed: {
    css () {
      return this.config.css || ''
    }
  },
  watch: {
    hass (newHass, oldHass) {
      const entity = this.config.entity
      if (newHass && entity) {
        const newAttr = newHass.states[entity].attributes
        var oldAttr = null
        if (oldHass) {
          oldAttr = oldHass.states[entity].attributes
        }
        if (newAttr !== oldAttr) {
          this.state = newHass.states[entity].state
        }
        if (!isEqual(newAttr, oldAttr)) {
          this.update()
        }
      }
    },
    config (newConfig, oldConfig) {
      if (newConfig) {
        // this.$refs.net.size.h = newConfig.height || 400
      }
    }
  },
  methods: {
    networkEvent (eventName) {
      // console.log(eventName)
    },
    dragRelease () {
      // save state
      this.saveLayout()
    },
    dragging () {

    },
    calcWindowHeight () {
      // var footer = document.querySelector('zigbee2mqtt-networkmap')
      // if (footer.shadowRoot) { footer = footer.shadowRoot.getElementById('card-actions') }
      // return window.innerHeight - (footer ? footer.offsetHeight : 36)
      return window.innerHeight - 120
    },
    onResize () {
      this.options.height = this.calcWindowHeight().toString()
      this.$refs.network.fit()
    },
    merge (target, source, tkey, skey, map) {
      const result = []
      const store = {}
      if (source) {
        source.forEach(e => {
          const key = skey(e)
          store[key] = map(e)
        })
      }
      target.forEach((e, i) => {
        const key = tkey(e)
        if (key in store) {
          for (const k in store[key]) {
            e[k] = store[key][k]
          }
          result.push(e)
          delete store[key]
        }
      })
      for (const k in store) {
        result.push(store[k])
      }
      return result
    },
    stabilized () {
      // switch of physics after initial stabilization
      this.nodes.forEach(node => {
        node.physics = false
      })
    },
    saveLayout () {
      const layout = this.$refs.network.getPositions()
      layout.showLqi = this.showLqi
      if (this.hass.states[this.config.layout_entity] && this.hass.states[this.config.layout_entity].attributes) {
        this.hass.states[this.config.layout_entity].attributes.showLqi = this.showLqi
      }
      const mqttBaseTopic = this.config.mqtt_base_topic || 'zigbee2mqtt'
      this.hass.callService('mqtt', 'publish', {
        topic: mqttBaseTopic + '/bridge/networkmap/layout',
        retain: true,
        payload: JSON.stringify(layout)
      })
    },
    isUnconnected (node, links) {
      return !links || !links.some(l => l.sourceIeeeAddr === node.ieeeAddr)
    },
    toggleLqi (e) {
      this.saveLayout()
      this.update()
    },
    refresh () {
      this.state = 'Refreshing...'
      const mqttBaseTopic = this.config.mqtt_base_topic || 'zigbee2mqtt'
      this.hass.callService('mqtt', 'publish', {
        topic: mqttBaseTopic + '/bridge/request/networkmap',
        payload: JSON.stringify({ type: 'raw', routes: false })
      })
    },
    imageUrl (device) {
      // console.log('Device ' + JSON.stringify(device))
      if (device && device.definition && device.definition.model) {
        var devModel = device.definition.model
        devModel = devModel.replace(/\//g, '-')
        return 'https://www.zigbee2mqtt.io/images/devices/' + devModel + '.jpg'
      } else {
        return './zigbee_icon.png'
      }
    },
    processEdges (nodeIDs, edges) {
      if (!nodeIDs || !edges) return null

      edges = edges.filter(
        e => nodeIDs.includes(e.sourceIeeeAddr) &&
           nodeIDs.includes(e.targetIeeeAddr)
      )
      edges.forEach(edge => {
        if (!edge.hidden) {
          const reverse = edges.find(e => e.sourceIeeeAddr === edge.targetIeeeAddr && e.targetIeeeAddr === edge.sourceIeeeAddr)
          if (reverse) {
            reverse.hidden = true
            edge.reverse = reverse
          }
        }
      })
      return edges.filter(
        e => !e.hidden
      )
    },
    hsv2rgb (h, s, v) {
      const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0)
      return 'rgb(' + (f(5) * 255) + ',' + (f(3) * 255) + ',' + (f(1) * 255) + ')'
    },
    edgeColor (lqi) {
      return this.hsv2rgb(120 * lqi / 255, 1, 0.8)
    },
    update () {
      const attr = this.hass.states[this.config.entity].attributes
      if (!attr.nodes && !this.initialized) {
        this.initialized = true
        this.refresh()
        return
      }
      const nodesDict = Object.assign({}, ...attr.nodes.map((n) => ({ [n.ieeeAddr]: n })))
      const layout = this.hass.states[this.config.layout_entity] ? this.hass.states[this.config.layout_entity].attributes : null
      this.showLqi = layout ? layout.showLqi || false : false
      // console.log('Nodes: ' + JSON.stringify(this.nodes))
      // console.log('Attr. Nodes: ' + JSON.stringify(attr.nodes))
      this.nodes = this.merge(this.nodes, attr.nodes, d => d.id, d => d.ieeeAddr, d => {
        const node = {
          id: d.ieeeAddr,
          brokenImage: './zigbee_icon.png',
          image: this.imageUrl(d),
          imagePadding: 8,
          font: {
            size: 10
          },
          /*
          widthConstraint: {
            maximum: 70
          },
          shadow: true,
          */
          physics: true,
          borderWidth: 1,
          color: {
            background: d.type === 'Coordinator' ? '#3E8CFF' : (this.isUnconnected(d, attr.links) ? '#FF0000' : '#ffffff'),
            border: this.isUnconnected(d, attr.links) ? '#FF0000' : '#3E8CFF',
            highlight: {
              border: '#6D6B75',
              background: d.type === 'Coordinator' ? '#3E8CFF' : '#ffffff'
            }
          },
          label: d.type === 'Coordinator' ? ' ' : d.friendlyName,
          shape: d.type === 'Coordinator' ? 'hexagon' : 'circularImage'
        }
        // set layout, if saved previously
        if (layout && layout[d.ieeeAddr] && layout[d.ieeeAddr].x) {
          node.x = layout[d.ieeeAddr].x
          node.y = layout[d.ieeeAddr].y
          node.physics = false
        }
        return node
      })
      // console.log('Attr.links: ' + JSON.stringify(attr.links))
      this.edges = this.merge(
        this.edges,
        this.processEdges(Object.keys(nodesDict), attr.links),
        e => e.sid + e.tid,
        e => e.sourceIeeeAddr + e.targetIeeeAddr,
        e => {
          const edge = {
            id: e.sourceIeeeAddr + e.targetIeeeAddr,
            from: e.sourceIeeeAddr,
            to: e.targetIeeeAddr,
            // title: e.reverse ? (e.lqi + e.reverse.lqi) / 2 : e.lqi,
            /*
            scaling: {
              min: 1,
              max: 3
            },
            value: e.reverse ? (e.lqi + e.reverse.lqi) / 2 : e.lqi,
             */
            dashes: nodesDict[e.sourceIeeeAddr] && nodesDict[e.sourceIeeeAddr].type === 'EndDevice',
            color: {
              color: this.edgeColor(e.reverse ? (e.lqi + e.reverse.lqi) / 2 : e.lqi)
            },
            smooth: {
              enabled: true,
              type: 'dynamic'
            },
            font: {
              size: 10
            },
            label: this.showLqi ? e.lqi.toString() + (e.reverse ? '/' + e.reverse.lqi : '') : ' '
          }
          return edge
        })
      // console.log('Processed Edges: ' + JSON.stringify(this.edges))
    }
  },
  mounted () {
  }
}
</script>
