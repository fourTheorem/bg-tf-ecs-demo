const path = require('path');
const webpack = require('webpack');
const package = require('./package.json');

module.exports = {
  mode: 'development',
  entry: './src/index.ts',
  externalsPresets: {
    node: true,
  },
  resolve: {
    extensions: ['.js', '.json', '.ts', '.cjs', '.mjs'],
  },
  output: {
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, 'dist'),
    filename: 'index-[id].cjs',
  },
  optimization: {
    concatenateModules: true,
    emitOnErrors: true,
    nodeEnv: 'production',
    usedExports: true,
    providedExports: true,
    sideEffects: true,
    splitChunks: {
      chunks: 'all',
      minSize: 100e3,
      maxSize: 500e3,
      minChunks: 1,
    },
  },
  target: 'node',
  devtool: false,
  cache: true,
  performance: {
    hints: 'warning',
    maxEntrypointSize: 1e7,
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)$/,
        exclude: /node_modules/,
        use: ['babel-loader'],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.VERSION': JSON.stringify(package.version),
    }),
  ],
  experiments: {
    topLevelAwait: true,
  },
};
