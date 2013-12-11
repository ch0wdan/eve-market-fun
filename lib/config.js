var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var convict = require('convict');

var conf = convict({
    env: {
        doc: "The application environment.",
        format: ["production", "development", "test"],
        default: "development",
        env: "NODE_ENV",
        arg: "node-env"
    },
    silent: {
        doc: "Silence informational and debug output",
        format: Boolean,
        default: false
    },
    ip: {
        doc: "The IP address to bind.",
        format: "ipaddress",
        default: "127.0.0.1",
        env: "IP_ADDRESS",
    },
    port: {
        doc: "The port to bind.",
        format: "port",
        default: 3000,
        env: "PORT"
    },
    database: {
        doc: "Main database connection details",
        format: "*",
        default: {
            "client": "sqlite",
            "connection": {
                "filename": "data/main.sqlite"
            }
        }
    },
    eve_sqlite: {
        doc: 'Path to an uncompressed SQLite export of EVE static data - i.e. https://www.fuzzwork.co.uk/dump/sqlite-latest.sqlite.bz2',
        default: './data/eve.sqlite',
        format: '*'
    },
    marketlogs_path: {
        doc: 'Path to exported market logs',
        default: './marketlogs',
        format: '*'
    },
    keyID: {
        doc: 'EVE API key ID',
        default: '',
        format: '*'
    },
    vCode: {
        doc: 'EVE API verification code',
        default: '',
        format: '*'
    },
    userID: {
        doc: 'Temporary user ID to use until auth works',
        default: '',
        format: '*'
    },
    username: {
        doc: 'Temporary username to use until auth works',
        default: '',
        format: '*'
    }
});

var env = conf.get('env');
var files = [
    path.join(process.cwd(), 'config', env + '.json'),
    path.join(process.cwd(), 'config', 'local.json'),
]
for (var i=0, file; file=files[i]; i++) {
    if (fs.existsSync(file)) {
        conf.loadFile(file);
    }
}
conf.validate();

// HACK: This just happens to work with Knex
conf.database = conf.get('database');

module.exports = conf;
