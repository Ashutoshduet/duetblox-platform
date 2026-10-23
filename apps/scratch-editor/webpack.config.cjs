const path = require('node:path');
module.exports = {
  mode: 'production', entry: './src/main.js',
  output: {path: path.resolve(__dirname, '../../public/scratch'), filename: 'duetblox-editor.js', chunkFilename: 'duetblox-[name].[contenthash].js', publicPath: 'auto'},
  optimization: {minimize: false},
  devtool: false,
  performance: {hints: false},
  resolve: {extensions: ['.js']}
};
