const webpack = require('webpack');
const path = require('path');

const MinifyPlugin = require('babel-minify-webpack-plugin');

const config = {
    entry: ['@babel/polyfill','./src/app.js'],
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js'
    },
    devServer: {
        port: 5000,
        proxy: {
            "/**": "http://localhost:5080",
            "/_browse/**": "http://localhost:5080",
            "/_skimdb/**": "http://localhost:5080"
        },
        contentBase: 'dist',
        inline: true,
        historyApiFallback: true
    },
    module: {
        rules: [{
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }, {
                test: /.jsx?$/,
                use: ['babel-loader'],
                exclude: /node_modules/
            }, {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                use: ["url-loader"]
            },
            {
                test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                use: ["url-loader"]
            }
        ]
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          commons: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env': {
          'NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
        }
      }),
      new webpack.ContextReplacementPlugin(/moment[\\\/]locale$/, /^\.\/(en)$/), // eslint-disable-line
      new webpack.optimize.AggressiveMergingPlugin()
    ]
};

if(process.env.NODE_ENV === 'production') {
  config.plugins.push(new MinifyPlugin());
}

module.exports = config;
