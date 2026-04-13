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
    <div ref="networkContainer" class="network"></div>
    <div id="card-actions" class="card-actions">
      <div class="flex">
        <mwc-button @click="refresh">Refresh</mwc-button>
        <div>
          <input type="checkbox" id="lqi" v-model="showLqi" @change="doUpdateLayout($event)">
          <label for="checkbox">LQI</label>
        </div>
        <div>
          <input type="checkbox" id="lqi" v-model="perfMode" @change="doUpdateLayout($event)">
          <label for="checkbox">Performance</label>
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
        <div style="display:flex;align-items:center;gap:4px;">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search nodes…"
            style="padding:2px 6px;border:1px solid #ccc;border-radius:3px;font-size:12px;width:130px;outline:none;"
          >
          <span v-if="searchQuery.trim()" style="font-size:12px;white-space:nowrap;">
            {{ searchMatchIds ? searchMatchIds.size : 0 }}
            match{{ searchMatchIds && searchMatchIds.size === 1 ? '' : 'es' }}
          </span>
        </div>
        <div>{{ state }}</div>
        <div>Edges: {{ visibleEdges.length }} / {{ allEdges.length }}</div>
        <div>Zoom: {{ zoomScale }}</div>
      </div>
    </div>
  </ha-card>
</template>

<script>
import { h } from 'vue'
import { Network as VisNetwork } from 'vis-network'
import { DataSet } from 'vis-data'
import isEqual from 'lodash.isequal'

// Renders a <style> tag — slots are functions in Vue 3
const VStyle = {
  render () {
    return h('style', this.$slots.default ? this.$slots.default() : [])
  }
}

class Node {
  constructor (hassioNode, attr, imageUrl, isUnconnected) {
    this.id = hassioNode.ieeeAddr
    this.brokenImage = './zigbee_icon.png'
    this.image = imageUrl(hassioNode)
    this.imagePadding = 8
    this.font = {
      size: 10
    }
    this.shadow = true
    this.physics = true
    this.borderWidth = hassioNode.type !== 'EndDevice' ? 2 : 1
    this.color = {
      background: isUnconnected(hassioNode, attr.links) ? '#FF0000' : '#ffffff',
      border: isUnconnected(hassioNode, attr.links) ? '#FF0000' : (hassioNode.type === 'EndDevice' ? '#3E8CFF' : '#632289'),
      highlight: {
        border: '#6D6B75',
        background: '#66B0FB'
      }
    }
    this.label = hassioNode.friendlyName // + ' (' + d.ieeeAddr + ')'
    this.type = hassioNode.type
    this.shape = 'circularImage'
  }
}

class Edge {
  constructor (hassioEdge, nodesDict, edgeColorFunc, generateEdgeKeyFunc, showLqi) {
    const lqi = Number.isFinite(hassioEdge.combinedLqi) ? hassioEdge.combinedLqi : 0
    const edgeColor = edgeColorFunc(lqi)
    const edgeId = generateEdgeKeyFunc(hassioEdge.sourceIeeeAddr, hassioEdge.targetIeeeAddr)

    this.id = edgeId
    this.lqi = lqi
    this.hidden = hassioEdge.hidden
    this.from = hassioEdge.sourceIeeeAddr
    this.to = hassioEdge.targetIeeeAddr
    this.dashes = nodesDict[hassioEdge.sourceIeeeAddr] && nodesDict[hassioEdge.sourceIeeeAddr].type === 'EndDevice' ? [5, 5] : [0, 0]
    this.width = 1
    this.selectionWidth = 2
    this.color = {
      color: edgeColor
    }
    this.background = {
      enabled: false,
      color: 'rgba(111,111,111,0.5)',
      size: 10
      // dashes: [20, 10]
    }
    this.smooth = {
      enabled: true,
      // type: 'continuous'
      type: 'dynamic'
    }
    this.font = {
      color: (lqi < 90) ? 'white' : 'black',
      strokeWidth: 0,
      strokeColor: 'black', // edgeColor,
      size: 14,
      background: edgeColor // hassioEdge.isWeak ? 'red' :
    }
    this.label = showLqi ? lqi.toString() : ''
  }
}

class Path {
  constructor (nodeIds, minLQI, getEdgesFromPathFunc) {
    this.nodeIds = nodeIds
    this.minLQI = minLQI
    this.edges = nodeIds != null ? getEdgesFromPathFunc(this.nodeIds) : null
    this.edgeIds = this.edges != null ? this.edges.map(e => e.id) : null
  }
}

class ColorHelper {
  static ColIndex = 0
  static highlightForegroundColors = [
    '#D2691E', // Chocolate Brown
    '#800000', // Maroon
    '#DC143C', // Crimson Red
    '#800080', // Purple
    '#000080', // Navy Blue
    '#008080', // Teal
    '#333333', // Dark Gray
    '#808000', // Olive
    '#228B22' // Forest Green
  ]

  static getColor () {
    const highlightCol = this.highlightForegroundColors[this.ColIndex]
    if (++this.ColIndex >= this.highlightForegroundColors.length) {
      this.ColIndex = 0
    }
    return highlightCol
  }
}

export default {
  components: {
    'v-style': VStyle
  },
  data () {
    return {
      networkEvents: '',
      initialized: false,
      config: {},
      hass: null,
      bgImage: null,
      zoomScale: '1.00',
      initialZoomApplied: false,
      zoomRestored: false, // one-time flag; never reset by update() so the user's zoom survives data refreshes
      // network data model - s. v-bind
      visibleNodes: /** @type {Node[]} */ [], // An array intended to hold instances of the Node class
      visibleEdges: /** @type {Edge[]} */ [], // An array intended to hold instances of the Edge class
      // this.edges does not contain all invisible edges. In order to calculate paths through invisible edges
      // we need them all.
      allEdges: /** @type {Edge[]} */ [],
      // performance helper
      nodesDict: /**  @type {Record<string, Node>} */ {}, // f(node-key) = node
      nodeIds: /** @type {string[]} */ [],
      edgesDict: /**  @type {Record<string, Edge>} */ {}, // f(edge-key) = edge
      edgesPerNode: /**  @type {Record<string, Edge[]>} */ {}, // f(node-key) = array of all connected edges
      // ----------------
      state: '',
      // Search / highlight
      searchQuery: '',
      // UI Options
      perfMode: false,
      showLqi: false,
      showEnddeviceEdges: true,
      showRouterEdges: true,
      selectedWeakEdgeOption: 'na',
      selectedStrongEdgeOption: 'na',
      // ----------------
      // avoid click/select when a double click will follow immediately
      doubleClickTimeout: null,
      options: {
        autoResize: true,
        height: this.calcWindowHeight().toString(),
        interaction: {
          selectConnectedEdges: false,
          // https://visjs.github.io/vis-network/examples/network/edgeStyles/smoothWorldCup.html
          hideEdgesOnDrag: false,
          // Reduce zoom speed — the default (1.0) is too fast on tablet touch screens
          zoomSpeed: 0.3
        }
        // configure: {
        //   filter: function (option, path) {
        //     if (option === 'hideEdgesOnDrag') {
        //       return true
        //     }
        //   }
        // }
      }
    }
  },
  computed: {
    css () {
      return this.config.css || ''
    },
    searchMatchIds () {
      const q = this.searchQuery.trim().toLowerCase()
      if (!q) return null
      return new Set(
        this.visibleNodes
          .filter(n =>
            (n.label && n.label.toLowerCase().includes(q)) ||
            (n.type && n.type.toLowerCase().includes(q))
          )
          .map(n => n.id)
      )
    },
    backgroundImage () {
      return this.config.background_image || null
    },
    backgroundOpacity () {
      return this.config.background_opacity !== undefined ? this.config.background_opacity : 0.3
    }
  },
  watch: {
    searchQuery () {
      this.applySearchHighlight()
    },
    visibleNodes (newNodes) {
      if (!this.nodesDataSet) return
      this.nodesDataSet.clear()
      this.nodesDataSet.add(newNodes)
      // Re-apply any active search highlight after nodes are replaced
      this.applySearchHighlight()
    },
    visibleEdges (newEdges) {
      if (!this.edgesDataSet) return
      this.edgesDataSet.clear()
      this.edgesDataSet.add(newEdges)
    },
    options: {
      deep: true,
      handler (newOptions) {
        if (!this.network) return
        // height is managed exclusively by onResize; passing it here would feed back
        // into setSize → resize event → onResize, causing an infinite loop
        const { height: _height, ...otherOptions } = newOptions
        this.network.setOptions(otherOptions)
      }
    },
    backgroundImage: {
      immediate: true,
      handler (url) {
        if (!url) {
          this.bgImage = null
          return
        }
        const img = new Image()
        img.onload = () => {
          this.bgImage = img
          this.$nextTick(() => {
            if (this.network) this.network.redraw()
          })
        }
        img.src = url
      }
    },
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
    applySearchHighlight () {
      if (!this.nodesDataSet) return
      const matchIds = this.searchMatchIds
      if (!matchIds) {
        // Restore every node to its original colour stored in visibleNodes
        this.nodesDataSet.update(
          this.visibleNodes.map(n => ({ id: n.id, color: n.color, font: n.font }))
        )
        return
      }
      this.nodesDataSet.update(
        this.visibleNodes.map(n => {
          if (matchIds.has(n.id)) {
            return {
              id: n.id,
              color: { ...n.color, border: '#FF9800', background: '#FFF3E0' },
              font: { ...n.font, color: '#000000' }
            }
          } else {
            return {
              id: n.id,
              color: { border: '#CCCCCC', background: '#F0F0F0', highlight: n.color.highlight },
              font: { ...n.font, color: '#BBBBBB' }
            }
          }
        })
      )
    },
    saveSettings () {
      const settings = {
        perfMode: this.perfMode,
        showLqi: this.showLqi,
        showEnddeviceEdges: this.showEnddeviceEdges,
        showRouterEdges: this.showRouterEdges,
        selectedWeakEdgeOption: this.selectedWeakEdgeOption,
        selectedStrongEdgeOption: this.selectedStrongEdgeOption
      }
      console.log('[persist] saveSettings', settings)
      try {
        localStorage.setItem('zigbee2mqtt-networkmap-settings', JSON.stringify(settings))
      } catch (e) {
        console.error('[persist] saveSettings localStorage error', e)
      }
    },
    saveViewport () {
      if (!this.network) return
      const pos = this.network.getViewPosition()
      const scale = this.network.getScale()
      const viewport = { x: pos.x, y: pos.y, scale }
      console.log('[persist] saveViewport', viewport)
      try {
        localStorage.setItem('zigbee2mqtt-networkmap-viewport', JSON.stringify(viewport))
        // keep legacy key in sync so old code reading it still works
        localStorage.setItem('zigbee2mqtt-networkmap-zoom', scale.toFixed(2))
      } catch (e) {
        console.error('[persist] saveViewport localStorage error', e)
      }
    },
    onZoom (event) {
      this.zoomScale = event.scale.toFixed(2)
      this.saveViewport()
    },
    onBeforeDrawing (ctx) {
      if (!this.bgImage || !this.bgImage.complete) return
      const img = this.bgImage
      const w = this.config.background_network_width || 1000
      const h = w * (img.naturalHeight / img.naturalWidth)
      const x = this.config.background_network_x !== undefined ? this.config.background_network_x : -w / 2
      const y = this.config.background_network_y !== undefined ? this.config.background_network_y : -h / 2
      // Do NOT use ctx.save()/ctx.restore() here — vis.js has already pushed its
      // pan/zoom transform onto the save stack and restore() would pop it, causing
      // edges and nodes to be drawn in the wrong coordinate space.
      const prevAlpha = ctx.globalAlpha
      ctx.globalAlpha = this.backgroundOpacity
      ctx.drawImage(img, x, y, w, h)
      ctx.globalAlpha = prevAlpha
    },
    networkEvent (eventName) {
      // console.log(eventName)
      if (eventName === 'select-node') {
        console.log(eventName)
        // Set a timeout to handle single click after 500ms in case no double click has happened inbetween - s. clearTimeout
        clearTimeout(this.doubleClickTimeout)
        this.doubleClickTimeout = setTimeout(() => {
          this.handleSelectNode()
        }, 300 /* ms */)
      } else if (eventName === 'deselect-node') {
        // Clear the single click timeout to prevent it from firing
        clearTimeout(this.doubleClickTimeout)
        console.log(eventName)
        this.handleDeselectNode()
      } else if (eventName === 'doubleClick') {
        // Clear the single click timeout to prevent it from firing
        clearTimeout(this.doubleClickTimeout)
        console.log(eventName)
        this.handleDoubleClick()
      } else if (eventName === 'select') {
        console.log(eventName)
      }
    },
    // normal selection of clicked node + all connected edges
    handleDeselectNode () {
      if (!this.network) return
      console.log('handleDeselectNode => ' + JSON.stringify(this.network.getSelectedNodes()))
      this.network.unselectAll()
    },
    // normal selection of clicked node + all connected edges
    handleSelectNode () {
      if (!this.network) return
      const params = this.network.getSelectedNodes()
      if (params.length > 0) {
        this.network.setSelection({ nodes: params }, { highlightEdges: true })
      }
    },
    // select path to coordinator with highest avergage LQI
    handleDoubleClick () {
      const params = this.network ? this.network.getSelectedNodes() : []
      if (params.length <= 0) {
        return
      }

      console.log('================================')
      const clickedNodeId = params[0]

      if (this.edgesPerNode[clickedNodeId].length === 0) {
        // single node without edges
        return
      }

      const coordinatorNode = this.visibleNodes.find(n => n.type === 'Coordinator')

      // Running the Modified Nearest Neighbor algorithm
      let firstResult = this.tspNearestNeighborLQI(this.nodeIds, clickedNodeId, coordinatorNode.id)

      // if nearest neighbor fails, try random neighbor
      while (firstResult.nodeIds === null) {
        firstResult = this.tspRandomNeighborLQI(this.nodeIds, clickedNodeId, coordinatorNode.id)
      }

      // Log the Nearest Neighbor results
      console.log('First Path: ', firstResult.nodeIds)
      console.log('First Minimum LQI: ', firstResult.minLQI)

      // Running DFS with the LQI constraint
      const bestResult = this.dfsLQI(clickedNodeId, coordinatorNode.id, firstResult)

      // Log all valid paths
      console.log('Best Path: ', bestResult.nodeIds)
      console.log('Best Minimum LQI: ', bestResult.minLQI)

      // unhide in case they are filtered out ("Router Edges" checkbox e.g.)
      let refreshNeeded = false
      bestResult.edges.forEach(edge => {
        if (edge.hidden) {
          edge.hidden = false
          this.visibleEdges.push(edge)
          refreshNeeded = true
        }
      })

      // this.$refs.network.setSelection({
      //   nodes: bestResult.nodeIds,
      //   edges: bestResult.edgeIds
      // }, {
      //   highlightEdges: false
      // })
      this.highlightPath(bestResult)

      if (refreshNeeded) {
        this.refreshNetwork()
      }
    },
    arraysAreIdentical (arr1, arr2) {
      if (arr1.length !== arr2.length) {
        return false
      }

      return arr1.every((value, index) => value === arr2[index])
    },

    highlightPath (path) {
      const highlightCol = ColorHelper.getColor()

      path.nodeIds.forEach(nid => {
        const n = this.nodesDict[nid]
        n.color.border = highlightCol
        n.font.strokeColor = highlightCol
      })

      path.edges.forEach(e => {
        // e.color = highlightCol
        // e.font.strokeColor = highlightCol
        // e.width = 3
        // example: https://visjs.github.io/vis-network/examples/network/edgeStyles/background.html
        e.background.color = highlightCol
        e.background.enabled = true
      })
    },
    refreshNetwork () {
      if (!this.network) return
      this.nodesDataSet.clear()
      this.nodesDataSet.add(this.visibleNodes)
      this.edgesDataSet.clear()
      this.edgesDataSet.add(this.visibleEdges)
      this.network.setOptions(this.options)
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

          if (unvisitedNodeIds.has(neighborId) && edge.lqi > bestLQI) {
            bestLQI = edge.lqi
            bestNeighborId = neighborId
          }
        })

        if (bestNeighborId === null) {
          // console.log('No valid neighbor')
          return new Path(null, -Infinity)
        }

        minLQI = Math.min(minLQI, bestLQI)
        currentNodeId = bestNeighborId
      }
      visitedNodeIds.push(currentNodeId) // Add the end node to the path

      return new Path(visitedNodeIds, minLQI, this.getEdgesFromPath)
    },

    /**
     * Finds a random neighbor with the lowest LQI (Link Quality Indicator) in a given graph,
     * using the Traveling Salesman Problem (TSP) algorithm.
     *
     * @param {string[]} nodeIds - The IDs of all nodes in the graph.
     * @param {string} startNodeId - The ID of the starting node.
     * @param {string} endNodeId - The ID of the ending node.
     * @returns Path object - The path of visited node IDs and the minimum LQI value.
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
          // console.log('No valid neighbor')
          return new Path(null, -Infinity)
        }

        // Randomly select a neighbor
        const randomIndex = Math.floor(Math.random() * unvisitedNeighbors.length)
        const randomNeighbor = unvisitedNeighbors[randomIndex]
        const neighborId = randomNeighbor.from === currentNodeId ? randomNeighbor.to : randomNeighbor.from

        minLQI = Math.min(minLQI, randomNeighbor.lqi)
        currentNodeId = neighborId
      }

      visitedNodeIds.push(currentNodeId) // Add the end node to the path

      return new Path(visitedNodeIds, minLQI, this.getEdgesFromPath)
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
      const stack = [new Path([startNodeId], Infinity, this.getEdgesFromPath)] // Stack to hold paths

      while (stack.length > 0) {
        const currentItem = stack.pop()

        if (currentItem.minLQI <= bestResult.minLQI) {
          // console.log('SKIPPED path: ', JSON.stringify(currentItem))
          continue
        }

        const currentPath = currentItem.nodeIds
        const currentNodeId = currentPath[currentPath.length - 1]
        const edges = this.edgesPerNode[currentNodeId]

        for (let i = 0; i < edges.length; i++) {
          const edge = edges[i]

          if (edge.lqi <= bestResult.minLQI) {
            // console.log('Skipped path: ', edge.lqi, currentPath, ' + ', edge)
            continue
          }

          const neighborId = edge.from === currentNodeId ? edge.to : edge.from
          if (neighborId === endNodeId) { // target found
            bestResult = new Path([...currentPath, endNodeId], Math.min(edge.lqi, currentItem.minLQI), this.getEdgesFromPath)
            // console.log('New candidate: ', JSON.stringify(bestResult))

            if (bestResult.minLQI === currentItem.minLQI) {
              // every other edge cannot lead to more than the current best result
              // console.log('Optimum found for: ', JSON.stringify(currentItem))
              break
            }
          } else if (!currentPath.includes(neighborId)) {
            const newItem = new Path([...currentPath, neighborId], Math.min(edge.lqi, currentItem.minLQI), this.getEdgesFromPath)
            // console.count('Pushed path' + JSON.stringify(newItem))
            stack.push(newItem)
          }
        }
      }

      return bestResult
    },
    dragRelease () {
      console.log('dragRelease')
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
      const newHeight = this.calcWindowHeight().toString()
      if (newHeight === this.options.height) return
      this.options.height = newHeight
      if (this.network) {
        this.network.setOptions({ height: newHeight })
        this.network.fit()
      }
    },

    generateEdgeKey (sourceIeeeAddr, targetIeeeAddr) {
      return sourceIeeeAddr + '/' + targetIeeeAddr
    },

    // The merge function takes two arrays of objects (target and source), matches them based on keys
    // generated by the tkey and skey functions, and combines them into a single array. If an object
    // in target matches an object in source (i.e., the keys match), the target object is updated
    // with properties from the source object. If no match is found for an object in source,
    // it is added to the result. The function returns this merged array as the result.
    merge (target, tkeyFunc, source, skeyFunc, mapFunc) {
      const result = []
      const sourceDict = {}

      // Populating sourceDict with source Objects:
      if (source) {
        source.forEach(e => {
          const key = skeyFunc(e)
          sourceDict[key] = mapFunc(e)
        })
      }
      // Merging target Objects with source Data:
      target.forEach((e, i) => {
        const key = tkeyFunc(e)
        if (key in sourceDict) {
          for (const k in sourceDict[key]) {
            e[k] = sourceDict[key][k]
          }
          result.push(e)
          delete sourceDict[key]
        }
      })
      // Adding Remaining source Objects:
      for (const k in sourceDict) {
        result.push(sourceDict[k])
      }
      return result
    },
    stabilized () {
      // switch of physics after initial stabilization
      this.visibleNodes.forEach(node => {
        node.physics = false
      })
      // Restore viewport exactly once per page-load (zoomRestored is never reset by update())
      // so that a data refresh from Home Assistant cannot reset the user's position/zoom.
      if (!this.zoomRestored) {
        this.zoomRestored = true
        let viewport = null
        let source = 'none'
        try {
          const saved = localStorage.getItem('zigbee2mqtt-networkmap-viewport')
          console.log('[persist] stabilized: localStorage viewport raw =', saved)
          if (saved) { viewport = JSON.parse(saved); source = 'localStorage-viewport' }
        } catch (e) {
          console.error('[persist] stabilized: error reading viewport from localStorage', e)
        }
        // Legacy fallback: zoom-only key written by older versions
        if (!viewport) {
          try {
            const savedZoom = localStorage.getItem('zigbee2mqtt-networkmap-zoom')
            console.log('[persist] stabilized: localStorage zoom (legacy) raw =', savedZoom)
            if (savedZoom) { viewport = { scale: parseFloat(savedZoom) }; source = 'localStorage-zoom-legacy' }
          } catch (e) {
            console.error('[persist] stabilized: error reading legacy zoom from localStorage', e)
          }
        }
        // Final fallback: card config
        if (!viewport && this.config.initial_zoom !== undefined) {
          viewport = { scale: this.config.initial_zoom }
          source = 'config-initial_zoom'
        }
        console.log('[persist] stabilized: restoring viewport from', source, viewport)
        if (viewport && this.network) {
          const moveOpts = { scale: viewport.scale }
          if (viewport.x !== undefined) moveOpts.position = { x: viewport.x, y: viewport.y }
          this.network.moveTo(moveOpts)
          this.zoomScale = viewport.scale.toFixed(2)
        }
      }
    },
    saveLayout () {
      console.log('[persist] saveLayout')
      const layout = this.network ? this.network.getPositions() : {}
      const nodeCount = Object.keys(layout).length
      if (nodeCount === 0) {
        console.warn('[persist] saveLayout: ABORTED — no nodes loaded yet (graph still initialising or refreshing). Saving an empty layout would wipe all stored positions.')
        return
      }
      layout.perfMode = this.perfMode
      layout.showLqi = this.showLqi
      layout.showEnddeviceEdges = this.showEnddeviceEdges
      layout.showRouterEdges = this.showRouterEdges
      layout.selectedWeakEdgeOption = this.selectedWeakEdgeOption
      layout.selectedStrongEdgeOption = this.selectedStrongEdgeOption
      const settingsKeys = new Set(['perfMode', 'showLqi', 'showEnddeviceEdges', 'showRouterEdges', 'selectedWeakEdgeOption', 'selectedStrongEdgeOption'])
      const positionCount = Object.keys(layout).filter(k => !settingsKeys.has(k)).length
      console.log('[persist] saveLayout: saving', positionCount, 'node positions to localStorage + MQTT')
      if (this.hass.states[this.config.layout_entity] && this.hass.states[this.config.layout_entity].attributes) {
        this.hass.states[this.config.layout_entity].attributes.perfMode = this.perfMode
        this.hass.states[this.config.layout_entity].attributes.showLqi = this.showLqi
        this.hass.states[this.config.layout_entity].attributes.showEnddeviceEdges = this.showEnddeviceEdges
        this.hass.states[this.config.layout_entity].attributes.showRouterEdges = this.showRouterEdges
        this.hass.states[this.config.layout_entity].attributes.selectedWeakEdgeOption = this.selectedWeakEdgeOption
        this.hass.states[this.config.layout_entity].attributes.selectedStrongEdgeOption = this.selectedStrongEdgeOption
      }
      // Mirror to localStorage so positions survive an MQTT broker restart
      try {
        localStorage.setItem('zigbee2mqtt-networkmap-layout', JSON.stringify(layout))
        console.log('[persist] saveLayout: localStorage write OK')
      } catch (e) {
        console.error('[persist] saveLayout: localStorage write FAILED', e)
      }
      const mqttBaseTopic = this.config.mqtt_base_topic || 'zigbee2mqtt'
      console.log('[persist] saveLayout: publishing to MQTT topic', mqttBaseTopic + '/bridge/networkmap/layout')
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
      console.log('doUpdateLayout' + e)
      this.saveSettings()
      this.saveLayout()
      this.update()
      // necessary for showLQI changes
      this.refreshNetwork()
    },
    refresh () {
      this.state = 'Refreshing...'
      this._refreshStartedAt = Date.now()
      console.log('[refresh] started — waiting for zigbee2mqtt to publish network map')
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
    processEdges (hassioEdges, mapFunc) {
      const nodesDict = this.nodesDict
      if (!this.nodeIds || !hassioEdges) {
        return null
      }

      // consider only edges whose source and target node exist
      hassioEdges = hassioEdges.filter(e => this.nodeIds.includes(e.sourceIeeeAddr) && this.nodeIds.includes(e.targetIeeeAddr))
      hassioEdges.forEach(hedge => {
        hedge.hidden = false

        // combine edges in both directions source <=> target
        hedge.reverseEdge = null
        const reverseEdge = hassioEdges.find(e => e.sourceIeeeAddr === hedge.targetIeeeAddr && e.targetIeeeAddr === hedge.sourceIeeeAddr)
        if (reverseEdge) {
          reverseEdge.hidden = true
          hedge.reverseEdge = reverseEdge
          hedge.combinedLqi = Math.round((hedge.lqi + reverseEdge.lqi) / 2)

          // Remove the reverse edge from the edges array
          const index = hassioEdges.findIndex(e => e === reverseEdge)
          if (index !== -1) {
            hassioEdges.splice(index, 1)
          }
        } else {
          hedge.combinedLqi = hedge.lqi
        }

        //
        // filtering according to UI settings
        //
        const MAX_WEAK_LQI = 50
        const MIN_STRONG_LQI = 100
        hedge.isWeak = hedge.combinedLqi <= MAX_WEAK_LQI
        hedge.isStrong = hedge.combinedLqi > MIN_STRONG_LQI

        if (!this.showEnddeviceEdges) {
          // Filter out all edges having a node with type 'EndDevice' as the target
          if ((nodesDict[hedge.targetIeeeAddr] && nodesDict[hedge.targetIeeeAddr].type === 'EndDevice') ||
              (nodesDict[hedge.sourceIeeeAddr] && nodesDict[hedge.sourceIeeeAddr].type === 'EndDevice')) {
            hedge.hidden = true
          }
        }
        if (!hedge.hidden && !this.showRouterEdges) {
          // Filter out all edges having a node with type 'Router' as the target and source
          if ((nodesDict[hedge.sourceIeeeAddr] && nodesDict[hedge.targetIeeeAddr]) &&
              (nodesDict[hedge.sourceIeeeAddr].type === 'Router' || nodesDict[hedge.sourceIeeeAddr].type === 'Coordinator') &&
              (nodesDict[hedge.targetIeeeAddr].type === 'Router' || nodesDict[hedge.targetIeeeAddr].type === 'Coordinator')) {
            hedge.hidden = true
          }
        }
        if (!hedge.hidden && this.selectedWeakEdgeOption !== 'na') {
          // Filter out all edges whose lqi <= MAX_WEAK_LQI
          if (!hedge.isWeak && this.selectedWeakEdgeOption === 'showOnly') {
            hedge.hidden = true
          } else if (hedge.isWeak && this.selectedWeakEdgeOption === 'filterOut') {
            hedge.hidden = true
          }
        }
        if (!hedge.hidden && this.selectedStrongEdgeOption !== 'na') {
          // Filter out all edges whose lqi < MIN_STRONG_LQI
          if (!hedge.isStrong && this.selectedStrongEdgeOption === 'showOnly') {
            hedge.hidden = true
          } else if (hedge.isStrong && this.selectedStrongEdgeOption === 'filterOut') {
            hedge.hidden = true
          }
        }
      })

      this.allEdges = hassioEdges.map(e => mapFunc(e))

      // return only visible edges
      return this.allEdges.filter(e => !e.hidden)
    },
    hsv2rgb (h, s, v) {
      const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0)
      return 'rgb(' + (f(5) * 255) + ',' + (f(3) * 255) + ',' + (f(1) * 255) + ')'
    },
    edgeColor (lqi) {
      return this.hsv2rgb(120 * lqi / 255, 1, 0.8)
    },
    updateNodesHelper () {
      this.nodesDict = this.visibleNodes.reduce((acc, n) => {
        acc[n.id] = n
        return acc
      }, {})

      this.nodeIds = Object.keys(this.nodesDict)
    },
    updateEdgesHelper () {
      this.edgesDict = this.allEdges.reduce((acc, e) => {
        acc[e.id] = e
        return acc
      }, {})

      this.createEdgesPerNode(this.allEdges)
    },
    /**
     * Function to create an edgesPerNode dictionary
     *
     * @param {Array<{ id: string }>} nodes - The array of nodes.
     * @param {Array<{ from: string, to: string }>} edges - The array of edges.
     */
    createEdgesPerNode (edges) {
      this.edgesPerNode = {}

      this.visibleNodes.forEach(node => {
        this.edgesPerNode[node.id] = []
      })

      edges.forEach(edge => {
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
          edgesInPath.push(edge)
        }
        parentNodeId = nodeId
      })

      return edgesInPath
    },
    // =====================================================
    // update
    // =====================================================
    update () {
      console.log('update')
      this.initialZoomApplied = false // kept for backwards-compat; zoom restoration now uses zoomRestored instead
      let attr = this.hass.states[this.config.entity].attributes // TODO rename
      const liveHasNodes = !!(attr.nodes && attr.nodes.length)
      let usingCache = false
      // If live entity has no nodes yet, try the retained cache entity so the map
      // is immediately visible after a reboot while the live map is still loading
      if (!liveHasNodes && this.config.cached_entity) {
        const cachedState = this.hass.states[this.config.cached_entity]
        if (cachedState && cachedState.attributes && cachedState.attributes.nodes) {
          console.log('[cache] live entity has no nodes — reading from cached entity', this.config.cached_entity,
            '(' + cachedState.attributes.nodes.length + ' nodes,', cachedState.attributes.links ? cachedState.attributes.links.length : 0, 'links,',
            'state:', cachedState.state + ')')
          attr = cachedState.attributes
          usingCache = true
        } else {
          console.log('[cache] live entity has no nodes and cached entity',
            this.config.cached_entity || '(not configured)',
            cachedState ? 'exists but has no nodes' : 'not found in HA states')
        }
      } else if (liveHasNodes) {
        console.log('[cache] live entity has', attr.nodes.length, 'nodes — using live data')
      }
      if (!attr.nodes && !this.initialized) {
        this.initialized = true
        this.refresh()
        return
      }
      if (this._refreshStartedAt) {
        const elapsed = ((Date.now() - this._refreshStartedAt) / 1000).toFixed(1)
        console.log('[refresh] done — took ' + elapsed + 's, got ' + (attr.nodes ? attr.nodes.length : 0) + ' nodes')
        this._refreshStartedAt = null
      }
      // Mirror fresh live data to the retained cache topic — skip when we're already reading from the cache
      if (liveHasNodes && !usingCache && attr.links) {
        const mqttBaseTopic = this.config.mqtt_base_topic || 'zigbee2mqtt'
        const cacheTopic = mqttBaseTopic + '/bridge/networkmap/cached'
        console.log('[cache] writing live map to retained cache topic', cacheTopic,
          '(' + attr.nodes.length + ' nodes,', attr.links.length, 'links)')
        this.hass.callService('mqtt', 'publish', {
          topic: cacheTopic,
          retain: true,
          payload: JSON.stringify({ data: { value: { nodes: attr.nodes, links: attr.links } } })
        })
      }
      const layoutFromMqtt = this.hass.states[this.config.layout_entity] ? this.hass.states[this.config.layout_entity].attributes : null
      console.log('[persist] update: layout_entity =', this.config.layout_entity, '| from MQTT:', layoutFromMqtt ? 'yes (' + Object.keys(layoutFromMqtt).length + ' keys)' : 'null/missing')
      let layout = layoutFromMqtt
      let layoutSource = layoutFromMqtt ? 'MQTT' : 'none'
      // Fall back to localStorage when the MQTT retained message is missing (e.g. after broker restart)
      if (!layout) {
        try {
          const stored = localStorage.getItem('zigbee2mqtt-networkmap-layout')
          console.log('[persist] update: MQTT layout missing — localStorage raw length:', stored ? stored.length : 0)
          if (stored) { layout = JSON.parse(stored); layoutSource = 'localStorage' }
        } catch (e) {
          console.error('[persist] update: error reading layout from localStorage', e)
        }
      }
      console.log('[persist] update: using layout from', layoutSource)
      this.perfMode = layout ? layout.perfMode || false : false
      this.options.interaction.hideEdgesOnDrag = this.perfMode
      this.showLqi = layout ? layout.showLqi || false : false
      this.showEnddeviceEdges = layout?.showEnddeviceEdges ?? true
      this.showRouterEdges = layout?.showRouterEdges ?? true
      this.selectedWeakEdgeOption = layout ? layout.selectedWeakEdgeOption || 'na' : 'na'
      this.selectedStrongEdgeOption = layout ? layout.selectedStrongEdgeOption || 'na' : 'na'
      // Restore settings from dedicated localStorage key — takes priority over MQTT layout
      // so UI preferences survive HA reboots independently of node positions
      try {
        const savedSettings = localStorage.getItem('zigbee2mqtt-networkmap-settings')
        if (savedSettings) {
          const s = JSON.parse(savedSettings)
          console.log('[persist] update: restoring settings from localStorage', s)
          if (s.perfMode !== undefined) { this.perfMode = s.perfMode; this.options.interaction.hideEdgesOnDrag = s.perfMode }
          if (s.showLqi !== undefined) this.showLqi = s.showLqi
          if (s.showEnddeviceEdges !== undefined) this.showEnddeviceEdges = s.showEnddeviceEdges
          if (s.showRouterEdges !== undefined) this.showRouterEdges = s.showRouterEdges
          if (s.selectedWeakEdgeOption !== undefined) this.selectedWeakEdgeOption = s.selectedWeakEdgeOption
          if (s.selectedStrongEdgeOption !== undefined) this.selectedStrongEdgeOption = s.selectedStrongEdgeOption
        } else {
          console.log('[persist] update: no saved settings in localStorage, using layout defaults')
        }
      } catch (e) {
        console.error('[persist] update: error restoring settings from localStorage', e)
      }

      // /////////////////////////////////
      // nodes update

      // Build a lookup of nodes that are already pinned so we can preserve their
      // live vis.js position rather than re-reading from the layout entity.  This
      // avoids the race where doUpdateLayout() calls saveLayout() (async MQTT) and
      // then update() immediately, reading a stale layout_entity and jumping nodes back.
      const pinnedIds = new Set(this.visibleNodes.filter(n => !n.physics).map(n => n.id))
      const currentPositions = (this.network && pinnedIds.size) ? this.network.getPositions() : {}

      // merge this.nodes with attr.node
      this.visibleNodes = this.merge(this.visibleNodes, d => d.id,
        attr.nodes, hassioNode => hassioNode.ieeeAddr,
        hassioNode => {
          const node = new Node(hassioNode, attr, this.imageUrl, this.isUnconnected)
          const ieeeAddr = hassioNode.ieeeAddr
          // Prefer live vis.js position for already-pinned nodes (survives async MQTT race)
          if (pinnedIds.has(ieeeAddr) && currentPositions[ieeeAddr]) {
            node.x = currentPositions[ieeeAddr].x
            node.y = currentPositions[ieeeAddr].y
            node.physics = false
          } else if (layout && layout[ieeeAddr] && layout[ieeeAddr].x !== undefined) {
            // set layout, if saved previously
            node.x = layout[ieeeAddr].x
            node.y = layout[ieeeAddr].y
            node.physics = false
          }
          return node
        })
      this.updateNodesHelper()

      // /////////////////////////////////
      // edges update

      const newVisibleEdges = this.processEdges(attr.links,
        hassioEdge => new Edge(hassioEdge, this.nodesDict, this.edgeColor, this.generateEdgeKey, this.showLqi))

      // merge this.visibleEdges with the result of this.processEdges
      this.visibleEdges = this.merge(
        this.visibleEdges, e => e.id,
        newVisibleEdges, e => e.id,
        e => e)
      this.updateEdgesHelper()
    }
  },
  mounted () {
    /* eslint-disable no-undef */
    console.log(
      '%c Zigbee2MQTT Networkmap %c v' + __VERSION__ + ' %c ' + __BUILD_TIMESTAMP__ + ' ',
      'background:#1a1a2e; color:#e94560; font-weight:bold; border-radius:3px 0 0 3px; padding:2px 6px',
      'background:#e94560; color:#fff; font-weight:bold; padding:2px 6px',
      'background:#0f3460; color:#a8dadc; padding:2px 6px; border-radius:0 3px 3px 0'
    )
    /* eslint-enable no-undef */
    // vis.Network and DataSets are stored as plain instance properties (not in
    // data()) so Vue 3 does not wrap them in a Proxy, which would break vis.js.
    this.nodesDataSet = new DataSet([])
    this.edgesDataSet = new DataSet([])
    this.network = new VisNetwork(
      this.$refs.networkContainer,
      { nodes: this.nodesDataSet, edges: this.edgesDataSet },
      this.options
    )

    // vis.js uses camelCase event names; vue-visjs used kebab-case
    this.network.on('click', () => this.networkEvent('click'))
    this.network.on('doubleClick', () => this.networkEvent('doubleClick'))
    this.network.on('oncontext', () => this.networkEvent('oncontext'))
    this.network.on('hold', () => this.networkEvent('hold'))
    this.network.on('release', () => this.dragRelease())
    this.network.on('select', () => this.networkEvent('select'))
    this.network.on('selectNode', () => this.networkEvent('select-node'))
    this.network.on('selectEdge', () => this.networkEvent('selectEdge'))
    this.network.on('deselectNode', () => this.networkEvent('deselect-node'))
    this.network.on('deselectEdge', () => this.networkEvent('deselectEdge'))
    this.network.on('dragStart', () => this.networkEvent('dragStart'))
    this.network.on('dragging', () => this.dragging())
    this.network.on('dragEnd', () => { this.networkEvent('dragEnd'); this.saveViewport() })
    this.network.on('hoverNode', () => this.networkEvent('hoverNode'))
    this.network.on('blurNode', () => this.networkEvent('blurNode'))
    this.network.on('hoverEdge', () => this.networkEvent('hoverEdge'))
    this.network.on('blurEdge', () => this.networkEvent('blurEdge'))
    this.network.on('zoom', (e) => this.onZoom(e))
    this.network.on('showPopup', () => this.networkEvent('showPopup'))
    this.network.on('hidePopup', () => this.networkEvent('hidePopup'))
    this.network.on('startStabilizing', () => this.networkEvent('startStabilizing'))
    this.network.on('stabilizationProgress', () => this.networkEvent('stabilizationProgress'))
    this.network.on('stabilizationIterationsDone', () => this.networkEvent('stabilizationIterationsDone'))
    this.network.on('stabilized', () => this.stabilized())
    // Use window resize instead of network's own resize event.
    // network.on('resize') fires whenever setOptions({height}) is called,
    // which would re-trigger onResize and cause an infinite loop.
    this._windowResizeHandler = () => this.onResize()
    window.addEventListener('resize', this._windowResizeHandler)
    this.network.on('initRedraw', () => this.networkEvent('initRedraw'))
    this.network.on('beforeDrawing', (ctx) => this.onBeforeDrawing(ctx))
    this.network.on('afterDrawing', () => this.networkEvent('afterDrawing'))
    this.network.on('animationFinished', () => this.networkEvent('animationFinished'))
    this.network.on('configChange', () => this.networkEvent('configChange'))
  },
  beforeUnmount () {
    if (this._windowResizeHandler) {
      window.removeEventListener('resize', this._windowResizeHandler)
      this._windowResizeHandler = null
    }
    if (this.network) {
      this.network.destroy()
      this.network = null
    }
  }
}
</script>
