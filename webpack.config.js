const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    content: { import: './src/content/content.ts', filename: '[name].js' },
    contentHead: { import: './src/content/contentHead.ts', filename: '[name].js' },
    options: { import: './src/options/options.ts', filename: 'options/[name].js' },
    utils: { import: './src/utils/storageManager.ts', filename: 'utils/storageManager.js' }
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use:
        [
          'css-loader',
          'postcss-loader'
        ]
      }      
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        { 
          from: 'public', 
          globOptions: { 
            ignore: ['**/css/main.css'],
          } 
        },
        { from: 'src/options/options.html', to: 'options' }
      ]
    })
  ],
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
};