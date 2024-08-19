<!-- https://visjs.github.io/vis-network/docs/network/ -->
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
      v-on:deselect-node="networkEvent('deselect-node')"
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
        height: this.calcWindowHeight().toString(),
        interaction: {
          selectConnectedEdges: false
        }
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
        let oldAttr = null
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
      if (eventName === 'select-node') {
        this.handleSelectNode()
      } else if (eventName === 'deselect-node') {
        // console.log(eventName)
      } else if (eventName === 'doubleClick') {
        this.handleDoubleClick()
      }
    },
    // normal selection of clicked node + all connected edges
    handleSelectNode () {
      const params = this.$refs.network.getSelectedNodes()
      // console.log('handleSelectNode => ' + JSON.stringify(params))
      if (params.length > 0) {
        this.$refs.network.setSelection({
          nodes: params
        }, {
          highlightEdges: true
        })
      }
    },
    // select path to coordinator with highest avergage LQI
    handleDoubleClick () {
      console.log('================================')
      const params = this.$refs.network.getSelectedNodes()

      if (params.length > 0) {
        const clickedNodeId = params[0]
        const coordinatorNode = this.nodes.find(n => n.type === 'Coordinator')

        // Running the Modified Nearest Neighbor algorithm
        // search by intention backwards from endNodeId to startNodeId
        let firstResult = this.tspNearestNeighborLQI(this.nodeIds, coordinatorNode.id, clickedNodeId)

        // if nearest neighbor fails, try random neighbor
        while (firstResult.path === null) {
          firstResult = this.tspRandomNeighborLQI(this.nodeIds, coordinatorNode.id, clickedNodeId)
        }

        // Log the Nearest Neighbor results
        console.log('First Path: ', firstResult.path)
        console.log('First Minimum LQI: ', firstResult.minLQI)

        // Running DFS with the LQI constraint
        // search by intention backwards from endNodeId to startNodeId
        const bestResult = this.dfsLQI(coordinatorNode.id, clickedNodeId, firstResult)

        // Log all valid paths
        console.log('Best Path: ', bestResult.path)
        console.log('Best Minimum LQI: ', bestResult.minLQI)

        // Highlight the best path
        const highlightEdges = this.getEdgesFromPath(bestResult.path)

        this.$refs.network.setSelection({
          nodes: bestResult.path,
          edges: highlightEdges
        }, {
          highlightEdges: false
        })
      }
    },
    arraysAreIdentical (arr1, arr2) {
      if (arr1.length !== arr2.length) {
        return false
      }

      return arr1.every((value, index) => value === arr2[index])
    },

    /**
     * Finds the shortest path using the nearest neighbor algorithm based on Link Quality Indicator (LQI).
     *
     * @param {string[]} nodeIds - The array of node IDs.
     * @param {string} startNodeId - The ID of the starting node.
     * @param {string} endNodeId - The ID of the ending node.
     * @returns {{ path: string[] | null, minLQI: number }} - The shortest path and the minimum LQI value.
     */
    tspNearestNeighborLQI (nodeIds, startNodeId, endNodeId) {
      const visitedNodeIds = []
      const unvisitedNodeIds = new Set(nodeIds)
      let currentNodeId = startNodeId
      let minLQI = Infinity

      while (currentNodeId !== endNodeId) {
        visitedNodeIds.push(currentNodeId)
        unvisitedNodeIds.delete(currentNodeId)

        let bestNeighborId = null
        let bestLQI = -Infinity

        this.edgesPerNode[currentNodeId].forEach(edge => {
          const neighborId = edge.from === currentNodeId ? edge.to : edge.from

          if (unvisitedNodeIds.has(neighborId) && edge.combinedLqi > bestLQI) {
            bestLQI = edge.combinedLqi
            bestNeighborId = neighborId
          }
        })

        if (bestNeighborId === null) {
          console.log('No valid neighbor')
          return { path: null, minLQI: -Infinity }
        }

        minLQI = Math.min(minLQI, bestLQI)
        currentNodeId = bestNeighborId
      }
      visitedNodeIds.push(currentNodeId) // Add the end node to the path

      return { path: visitedNodeIds, minLQI }
    },

    /**
     * Finds a random neighbor with the lowest LQI (Link Quality Indicator) in a given graph,
     * using the Traveling Salesman Problem (TSP) algorithm.
     *
     * @param {string[]} nodeIds - The IDs of all nodes in the graph.
     * @param {string} startNodeId - The ID of the starting node.
     * @param {string} endNodeId - The ID of the ending node.
     * @returns {{ path: string[] | null, minLQI: number }} - The path of visited node IDs and the minimum LQI value.
     */
    tspRandomNeighborLQI (nodeIds, startNodeId, endNodeId) {
      const visitedNodeIds = []
      const unvisitedNodeIds = new Set(nodeIds)
      let currentNodeId = startNodeId
      let minLQI = Infinity

      while (currentNodeId !== endNodeId) {
        visitedNodeIds.push(currentNodeId)
        unvisitedNodeIds.delete(currentNodeId)

        const unvisitedNeighbors = Array.from(this.edgesPerNode[currentNodeId])
          .filter(edge => unvisitedNodeIds.has(edge.from) || unvisitedNodeIds.has(edge.to))

        if (unvisitedNeighbors.length === 0) {
          console.log('No valid neighbor')
          return { path: null, minLQI: -Infinity }
        }

        // Randomly select a neighbor
        const randomIndex = Math.floor(Math.random() * unvisitedNeighbors.length)
        const randomNeighbor = unvisitedNeighbors[randomIndex]
        const neighborId = randomNeighbor.from === currentNodeId ? randomNeighbor.to : randomNeighbor.from

        minLQI = Math.min(minLQI, randomNeighbor.combinedLqi)
        currentNodeId = neighborId
      }

      visitedNodeIds.push(currentNodeId) // Add the end node to the path

      return { path: visitedNodeIds, minLQI }
    },

    /**
     * Performs a Depth-First Search (DFS) algorithm to find the path with the minimum Link Quality Indicator (LQI) between two nodes.
     *
     * @param startNodeId - The ID of the starting node.
     * @param endNodeId - The ID of the target node.
     * @param bestResult - The current best result, containing the path and the minimum LQI.
     * @returns The best result, containing the path and the minimum LQI.
     */
    dfsLQI (startNodeId, endNodeId, bestResult) {
      const stack = [{ path: [startNodeId], minLQI: Infinity }] // Stack to hold paths

      while (stack.length > 0) {
        const currentItem = stack.pop()

        if (currentItem.minLQI <= bestResult.minLQI) {
          // console.log('SKIPPED path: ', JSON.stringify(currentItem))
          continue
        }

        const currentPath = currentItem.path
        const currentNodeId = currentPath[currentPath.length - 1]
        const edges = this.edgesPerNode[currentNodeId]

        for (let i = 0; i < edges.length; i++) {
          const edge = edges[i]

          if (edge.combinedLqi <= bestResult.minLQI) {
            // console.log('Skipped path: ', edge.combinedLqi, currentPath, ' + ', edge)
            continue
          }

          const neighborId = edge.from === currentNodeId ? edge.to : edge.from
          if (neighborId === endNodeId) { // target found
            bestResult = { path: [...currentPath, endNodeId], minLQI: Math.min(edge.combinedLqi, currentItem.minLQI) }
            // console.log('New candidate: ', JSON.stringify(bestResult))

            if (bestResult.minLQI === currentItem.minLQI) {
              // every other edge cannot lead to more than the current best result
              // console.log('Optimum found for: ', JSON.stringify(currentItem))
              break
            }
          } else if (!currentPath.includes(neighborId)) {
            const newItem = { path: [...currentPath, neighborId], minLQI: Math.min(edge.combinedLqi, currentItem.minLQI) }
            // console.count('Pushed path' + JSON.stringify(newItem))
            stack.push(newItem)
          }
        }
      }

      return bestResult
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

    generateEdgeKey (sourceIeeeAddr, targetIeeeAddr) {
      return sourceIeeeAddr + '/' + targetIeeeAddr
    },

    // The merge function takes two arrays of objects (target and source), matches them based on keys
    // generated by the tkey and skey functions, and combines them into a single array. If an object
    // in target matches an object in source (i.e., the keys match), the target object is updated
    // with properties from the source object. If no match is found for an object in source,
    // it is added to the result. The function returns this merged array as the result.
    merge (target, source, tkey, skey, map) {
      const result = []
      const store = {}

      // Populating the store with source Objects:
      if (source) {
        source.forEach(e => {
          const key = skey(e)
          store[key] = map(e)
        })
      }
      // Merging target Objects with source Data:
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
      // Adding Remaining source Objects:
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
        let devModel = device.definition.model
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

      // consider only edges whose source and target node exist
      edges = edges.filter(
        e => nodeIDs.includes(e.sourceIeeeAddr) &&
           nodeIDs.includes(e.targetIeeeAddr)
      )
      edges.forEach(edge => {
        edge.hidden = false

        // combine edges in both directions source <=> target
        edge.reverseEdge = null
        const reverseEdge = edges.find(e => e.sourceIeeeAddr === edge.targetIeeeAddr && e.targetIeeeAddr === edge.sourceIeeeAddr)
        if (reverseEdge) {
          reverseEdge.hidden = true
          edge.reverseEdge = reverseEdge
          edge.combinedLqi = Math.round((edge.lqi + reverseEdge.lqi) / 2)
        } else {
          edge.combinedLqi = edge.lqi
        }

        //
        // filtering according to UI settings
        //
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

      // return only visible edges
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
    updateNodesHelper () {
      this.nodesDict = this.nodes.reduce((acc, n) => {
        acc[n.id] = n
        return acc
      }, {})

      this.nodeIds = []
      this.nodes.forEach(node => {
        this.nodeIds.push(node.id)
      })
    },
    updateEdgesHelper () {
      this.edgesDict = this.edges.reduce((acc, e) => {
        acc[e.id] = e
        return acc
      }, {})
    },
    /**
     * Function to create an edgesPerNode dictionary
     *
     * @param {Array<{ id: string }>} nodes - The array of nodes.
     * @param {Array<{ from: string, to: string }>} edges - The array of edges.
     */
    createEdgesPerNode () {
      this.edgesPerNode = {}

      this.nodes.forEach(node => {
        this.edgesPerNode[node.id] = []
      })

      this.edges.forEach(edge => {
        this.edgesPerNode[edge.from].push(edge)
        this.edgesPerNode[edge.to].push(edge)
      })
    },
    findEdge (parentNodeId, nodeId) {
      // console.count('findEdge')
      const key1 = this.generateEdgeKey(parentNodeId, nodeId)
      let edge = this.edgesDict[key1]

      if (edge === undefined) {
        const key2 = this.generateEdgeKey(nodeId, parentNodeId)
        edge = this.edgesDict[key2]
      }

      if (edge === undefined) {
        const parentNode = this.nodesDict[parentNodeId]
        const node = this.nodesDict[nodeId]
        console.error('No edge found between\n' + JSON.stringify(parentNode) + '\nand\n' + JSON.stringify(node))
      }

      return edge
    },
    getEdgesFromPath (path) {
      const edgesInPath = []
      let parentNodeId = 0

      path.forEach(nodeId => {
        if (parentNodeId !== 0) {
          const edge = this.findEdge(parentNodeId, nodeId)
          edgesInPath.push(edge.id)
        }
        parentNodeId = nodeId
      })

      return edgesInPath
    },
    // =====================================================
    // update
    // =====================================================
    update () {
      const attr = this.hass.states[this.config.entity].attributes
      if (!attr.nodes && !this.initialized) {
        this.initialized = true
        this.refresh()
        return
      }
      const layout = this.hass.states[this.config.layout_entity] ? this.hass.states[this.config.layout_entity].attributes : null
      // console.log('layout' + JSON.stringify(layout))
      this.showLqi = layout ? layout.showLqi || false : false
      this.showEnddeviceEdges = layout ? layout.showEnddeviceEdges || false : false
      this.showRouterEdges = layout ? layout.showRouterEdges || false : false
      this.selectedWeakEdgeOption = layout ? layout.selectedWeakEdgeOption || 'na' : 'na'
      this.selectedStrongEdgeOption = layout ? layout.selectedStrongEdgeOption || 'na' : 'na'
      // console.log('Nodes: ' + JSON.stringify(this.nodes))
      // console.log('Attr. Nodes: ' + JSON.stringify(attr.nodes))

      // merge this.nodes with attr.node
      this.nodes = this.merge(this.nodes, attr.nodes, d => d.id, d => d.ieeeAddr, d => {
        const node = {
          id: d.ieeeAddr,
          brokenImage: './zigbee_icon.png',
          image: this.imageUrl(d),
          imagePadding: 8,
          font: {
            size: 10
          },
          shadow: true,
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
              background: '#66B0FB'
              // strokeWidth: 5,
              // strokeColor: '#FF0000',
              // size: 14
            }
          },
          label: d.friendlyName /* + ' (' + d.ieeeAddr + ')' */,
          type: d.type,
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
      this.updateNodesHelper()
      // console.log('Attr.links: ' + JSON.stringify(attr.links))

      // merge this.edges with this.processEdges(this.nodesDict, attr.links)
      this.edges = this.merge(
        this.edges,
        this.processEdges(this.nodesDict, attr.links),
        e => this.generateEdgeKey(e.sid, e.tid),
        e => this.generateEdgeKey(e.sourceIeeeAddr, e.targetIeeeAddr),
        e => {
          const lqi = e.combinedLqi
          const edgeColor = this.edgeColor(lqi)
          const edgeId = this.generateEdgeKey(e.sourceIeeeAddr, e.targetIeeeAddr)
          const edge = {
            id: edgeId,
            from: e.sourceIeeeAddr,
            to: e.targetIeeeAddr,
            dashes: this.nodesDict[e.sourceIeeeAddr] && this.nodesDict[e.sourceIeeeAddr].type === 'EndDevice' ? [5, 5] : [0, 0],
            width: 1,
            selectionWidth: 2,
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
            label: this.showLqi ? lqi.toString() /* + ' (' + edgeId + ')' */ : '',
            // e.lqi.toString() + (e.reverseEdge ? '/' + e.reverseEdge.lqi : '') : ' '
            // for edges in both directions the average out of the 2 LQIs, otherwise e.LQI
            combinedLqi: e.combinedLqi
          }
          return edge
        })
      // console.log('Processed Edges: ' + JSON.stringify(this.edges))
      this.updateEdgesHelper()
      this.createEdgesPerNode()
    }
  },
  mounted () {
  }
}
</script>
