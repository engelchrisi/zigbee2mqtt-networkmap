const webpack = require('webpack')

module.exports = {
  publicPath: './',
  css: {
    extract: false
  },
  configureWebpack: {
    entry: {
      'zigbee2mqtt-networkmap': './src/zigbee2mqtt-networkmap.js'
    },
    output: {
      filename: '[name].js'
    },
    optimization: {
      splitChunks: false
    },
    plugins: [
      new webpack.DefinePlugin({
        __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
        __VERSION__: JSON.stringify(require('./package.json').version)
      })
    ]
  },
  productionSourceMap: false
}
