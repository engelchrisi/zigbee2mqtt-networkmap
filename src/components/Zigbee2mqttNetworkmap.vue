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
          <input type="checkbox" id="lqi" v-model="showLqi" @change="doUpdateLayout($event)">
          <label for="checkbox">LQI</label>
        </div>
        <div>
          <input type="checkbox" id="EnddeviceEdgesId" v-model="showEnddeviceEdges" @change="doUpdateLayout($event)">
          <label for="checkbox">End-Device Edges</label>
        </div>
        <div>
          <input type="checkbox" id="RouterEdgesId" v-model="showRouterEdges" @change="doUpdateLayout($event)">
          <label for="checkbox">Router Edges</label>
        </div>
        <!-- Dropdown for Weak edges -->
        <div>
          <label for="weakEdgesDropdown" style="margin-right: 8px;">Weak edges</label>
          <select id="weakEdgesDropdown" v-model="selectedWeakEdgeOption" @change="doUpdateLayout($event)">
            <option value="na" selected>N/A</option>
            <option value="showOnly">Show Only</option>
            <option value="filterOut">Filter out</option>
          </select>
        </div>
        <!-- Dropdown for strong edges -->
        <div>
          <label for="strongEdgesDropdown" style="margin-right: 8px;">Strong edges</label>
          <select id="strongEdgesDropdown" v-model="selectedStrongEdgeOption" @change="doUpdateLayout($event)">
            <option value="na" selected>N/A</option>
            <option value="showOnly">Show Only</option>
            <option value="filterOut">Filter out</option>
          </select>
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
      showEnddeviceEdges: true,
      showRouterEdges: true,
      selectedWeakEdgeOption: 'na',
      selectedStrongEdgeOption: 'na',
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
      layout.showEnddeviceEdges = this.showEnddeviceEdges
      layout.showRouterEdges = this.showRouterEdges
      layout.selectedWeakEdgeOption = this.selectedWeakEdgeOption
      layout.selectedStrongEdgeOption = this.selectedStrongEdgeOption
      if (this.hass.states[this.config.layout_entity] && this.hass.states[this.config.layout_entity].attributes) {
        this.hass.states[this.config.layout_entity].attributes.showLqi = this.showLqi
        this.hass.states[this.config.layout_entity].attributes.showEnddeviceEdges = this.showEnddeviceEdges
        this.hass.states[this.config.layout_entity].attributes.showRouterEdges = this.showRouterEdges
        this.hass.states[this.config.layout_entity].attributes.selectedWeakEdgeOption = this.selectedWeakEdgeOption
        this.hass.states[this.config.layout_entity].attributes.selectedStrongEdgeOption = this.selectedStrongEdgeOption
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
    doUpdateLayout (e) {
      // console.log('doUpdateLayout' + e)
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
      if (device.type === 'Coordinator') {
        return 'https://www.zigbee2mqtt.io/images/devices/ZBDongle-E.png'
      } else if (device && device.definition && device.definition.model) {
        var devModel = device.definition.model
        devModel = devModel.replace(/\//g, '-')
        // replace space with "-" e.g. 'TYWB 4ch-RF'
        devModel = devModel.replace(/\s+/g, '-')
        return 'https://www.zigbee2mqtt.io/images/devices/' + devModel + '.png' // ((devModel === 'E2204') ? '.png' : '.png')
      } else {
        return './zigbee_icon.png'
      }
    },
    processEdges (nodesDict, edges) {
      const nodeIDs = Object.keys(nodesDict)
      if (!nodeIDs || !edges) return null

      edges = edges.filter(
        e => nodeIDs.includes(e.sourceIeeeAddr) &&
           nodeIDs.includes(e.targetIeeeAddr)
      )
      edges.forEach(edge => {
        edge.hidden = false
        edge.reverseEdge = null

        const reverseEdge = edges.find(e => e.sourceIeeeAddr === edge.targetIeeeAddr && e.targetIeeeAddr === edge.sourceIeeeAddr)
        if (reverseEdge) {
          reverseEdge.hidden = true
          edge.reverseEdge = reverseEdge
          edge.combinedLqi = Math.round((edge.lqi + reverseEdge.lqi) / 2)
        } else {
          edge.combinedLqi = edge.lqi
        }

        const MAX_WEAK_LQI = 50
        const MIN_STRONG_LQI = 100
        edge.isWeak = edge.combinedLqi <= MAX_WEAK_LQI
        edge.isStrong = edge.combinedLqi > MIN_STRONG_LQI

        if (!this.showEnddeviceEdges) {
          // Filter out all edges having a node with type 'EndDevice' as the target
          if ((nodesDict[edge.targetIeeeAddr] && nodesDict[edge.targetIeeeAddr].type === 'EndDevice') ||
              (nodesDict[edge.sourceIeeeAddr] && nodesDict[edge.sourceIeeeAddr].type === 'EndDevice')) {
            edge.hidden = true
          }
        }
        if (!edge.hidden && !this.showRouterEdges) {
          // Filter out all edges having a node with type 'Router' as the target and source
          if ((nodesDict[edge.sourceIeeeAddr] && nodesDict[edge.targetIeeeAddr]) &&
              (nodesDict[edge.sourceIeeeAddr].type === 'Router' || nodesDict[edge.sourceIeeeAddr].type === 'Coordinator') &&
              (nodesDict[edge.targetIeeeAddr].type === 'Router' || nodesDict[edge.targetIeeeAddr].type === 'Coordinator')) {
            edge.hidden = true
          }
        }
        if (!edge.hidden && this.selectedWeakEdgeOption !== 'na') {
          // Filter out all edges whose lqi <= MAX_WEAK_LQI
          if (!edge.isWeak && this.selectedWeakEdgeOption === 'showOnly') {
            edge.hidden = true
          } else if (edge.isWeak && this.selectedWeakEdgeOption === 'filterOut') {
            edge.hidden = true
          }
        }
        if (!edge.hidden && this.selectedStrongEdgeOption !== 'na') {
          // Filter out all edges whose lqi < MIN_STRONG_LQI
          if (!edge.isStrong && this.selectedStrongEdgeOption === 'showOnly') {
            edge.hidden = true
          } else if (edge.isStrong && this.selectedStrongEdgeOption === 'filterOut') {
            edge.hidden = true
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
      // console.log('layout' + JSON.stringify(layout))
      this.showLqi = layout ? layout.showLqi || false : false
      this.showEnddeviceEdges = layout ? layout.showEnddeviceEdges || false : false
      this.showRouterEdges = layout ? layout.showRouterEdges || false : false
      this.selectedWeakEdgeOption = layout ? layout.selectedWeakEdgeOption || 'na' : 'na'
      this.selectedStrongEdgeOption = layout ? layout.selectedStrongEdgeOption || 'na' : 'na'
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
          shadow: true, // d.type === 'EndDevice',
          /*
          widthConstraint: {
            maximum: 70
          },
          */
          physics: true,
          borderWidth: d.type !== 'EndDevice' ? 2 : 1,
          color: {
            background: this.isUnconnected(d, attr.links) ? '#FF0000' : '#ffffff',
            border: this.isUnconnected(d, attr.links) ? '#FF0000' : (d.type === 'EndDevice' ? '#3E8CFF' : '#632289'),
            highlight: {
              border: '#6D6B75',
              background: d.type !== 'EndDevice' ? '#66B0FB' : '#ffffff'
            }
          },
          label: d.type === 'Coordinator' ? ' ' : d.friendlyName, // + ' (' + d.ieeeAddr + ')',
          shape: 'circularImage'
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
        this.processEdges(nodesDict, attr.links),
        e => e.sid + e.tid,
        e => e.sourceIeeeAddr + e.targetIeeeAddr,
        e => {
          const lqi = e.combinedLqi
          const edgeColor = this.edgeColor(lqi)
          const edge = {
            id: e.sourceIeeeAddr + e.targetIeeeAddr,
            from: e.sourceIeeeAddr,
            to: e.targetIeeeAddr,
            dashes: nodesDict[e.sourceIeeeAddr] && nodesDict[e.sourceIeeeAddr].type === 'EndDevice' ? [5, 5] : [0, 0],
            width: 1,
            color: {
              color: edgeColor
            },
            smooth: {
              enabled: true,
              type: 'dynamic'
            },
            font: {
              color: e.isWeak ? '#FFFFFF' : '#000000', // Text color
              // face: 'arial', // Font family
              // background: edgeColor, // Background color
              strokeWidth: e.isWeak ? 5 : 0, // Simulated padding by making the stroke wider
              strokeColor: edgeColor, // Stroke color same as background to create padding effect
              size: e.isWeak ? 14 : 12 // Font size in pixels
            },
            label: this.showLqi ? lqi.toString() : '' // e.lqi.toString() + (e.reverseEdge ? '/' + e.reverseEdge.lqi : '') : ' '
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
