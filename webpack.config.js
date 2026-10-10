const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (_env, argv) => ({
  mode: argv.mode || 'production',
  entry: {
    content: './src/content/content.ts',
    contentHead: './src/content/contentHead.ts',
    background: './src/background.ts',
    options: { import: './src/options/options.ts', filename: 'options/options.js' },
    popup: { import: './src/popup/popup.ts', filename: 'popup/popup.js' },
  },
  devtool: false,
  module: { rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }] },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        // Public contains only files that can be copied without compilation.
        { from: 'public' },
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/_locales', to: '_locales' },
        { from: 'src/options/options.html', to: 'options/options.html' },
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
      ],
    }),
  ],
  resolve: { extensions: ['.ts', '.js'] },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    // CSS is generated after webpack, so every build can start clean.
    clean: true,
  },
});
