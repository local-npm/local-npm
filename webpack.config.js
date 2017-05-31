const webpack = require('webpack');
const path = require('path');

const config = {
    entry: './src/app.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'build.js'
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
        loaders: [{
                test: /\.css$/,
                loaders: ['style-loader', 'css-loader']
            }, {
                test: /.jsx?$/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                query: {
                    presets: ['es2015', 'react']
                }
            }, {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: "url-loader"
            },
            {
                test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: "url-loader"
            }
        ]
    }
};

if (process.env.NODE_ENV == 'production') {
    config.plugins = [
        new webpack.DefinePlugin({
            'process.env': {
                'NODE_ENV': JSON.stringify('production')
            }
        }),
        new webpack.ContextReplacementPlugin(/moment[\\\/]locale$/, /^\.\/(en)$/),
        new webpack.optimize.UglifyJsPlugin({
            comments: false,
            compress: {
                unused: true,
                dead_code: true,
                warnings: false,
                drop_debugger: true,
                conditionals: true,
                evaluate: true,
                sequences: true,
                booleans: true,
            }
        }),
        new webpack.optimize.AggressiveMergingPlugin(),
    ];
}

module.exports = config;
