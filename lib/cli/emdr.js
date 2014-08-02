var util = require('util');
var zmq = require('zmq');
var zlib = require('zlib');
var sock = zmq.socket('sub');

var blessed = require('blessed');

var _ = require('underscore');
var async = require('async');

var models = require('../models');
var eveData = require('../eveData');

var logger = require('winston');
var Winston_Transport = require('winston/lib/winston/transports/transport').Transport;
var Winston_Common = require('winston/lib/winston/common');

var ct = { emdr: 0, margins: 0, history: 0, leads: 0 };
var ctWindow = { emdr: 0, margins: 0, history: 0, leads: 0 };
var ctBoxes = {};
var t_start, t_window, screen, root;

var WINDOW_DURATION = (1000 * 60 * 5);

module.exports = function (prog, init) {
    prog.command('marketorders:emdr')
        .description('Import market orders from the EMDR stream')
        .action(init(cmdMarketOrdersEMDR));
};

function cmdMarketOrdersEMDR () {
    setupGui();
    setInterval(renderGui, 100);
    connectEMDR();
}

function connectEMDR () {
    sock.connect('tcp://relay-us-central-1.eve-emdr.com:8050');
    sock.subscribe('');
    sock.on('message', function (msg) {
        zlib.inflate(msg, function (err, market_json) {
            queues.emdr.push(JSON.parse(market_json));
        });
    });
    sock.on('disconnect', function (msg) {
        logger.error("EMDR socket disconnected");
        exit();
    });
}

function setupGui () {
    t_start = Date.now();
    t_window = t_start;

    screen = blessed.screen();

    root = blessed.box({
        top: 'center', left: 'center',
        width: '100%', height: '100%',
        border: { type: 'line' },
        autoPadding: true,
        padding: 1,
        label: 'EVEMF EMDR processing',
        style: { fg: 'white', bg: 'black' }
    });
    screen.append(root);

    var hpos = 0;
    var flds = _.keys(ct);
    var width = (100 / flds.length);
    flds.forEach(function (name) {
        ctBoxes[name] = blessed.box({
            top: 1,
            left: hpos + '%',
            width: width + '%',
            height: '20%',
            border: { type: 'line' },
            padding: 1,
            align: 'center',
            label: name
        });
        hpos += (width);
        root.append(ctBoxes[name]);
    });

    var errLogBox = blessed.scrollablebox({
        top: '20%', left: 0,
        width: '100%', height: '40%',
        label: 'errors',
        border: { type: 'line' },
        padding: 0,
        align: 'left',
        scrollable: true
    });
    root.append(errLogBox);

    var outLogBox = blessed.scrollablebox({
        top: '60%', left: 0,
        width: '100%', height: '40%',
        label: 'log',
        border: { type: 'line' },
        padding: 0,
        align: 'left',
        scrollable: true
    });
    root.append(outLogBox);

    logger.remove(logger.transports.Console);
    logger.add(LogBoxTransport, {
        outLogBox: outLogBox,
        errLogBox: errLogBox,
        history: 50,
        level: 'silly',
        colorize: true,
        timestamp: true
    });

    // Quit on Escape, q, or Control-C.
    screen.key(['escape', 'q', 'C-c'], function(ch, key) {
        process.exit();
    });
}

function renderGui () {
    var t_duration = Date.now() - t_start;
    var t_window_duration = Date.now() - t_window;

    if (t_window_duration > WINDOW_DURATION) {
        t_window = Date.now();
        t_window_duration = 1;
        _.each(ct, function (amt, name) {
            ctWindow[name] = ct[name];
        });
    }

    var t_minutes = t_window_duration / (1000 * 60);

    root.setLabel('EVEMF EMDR processing (Uptime: ' + 
        Math.round(t_duration / 1000) + 's)');

    _.each(ct, function (amt, name) {
        ctBoxes[name].setContent([
            queues[name].length() + ' queued',
            amt + ' processed',
            Math.round((amt - ctWindow[name]) / t_minutes) + ' per min'        
        ].join("\n"));
    });

    screen.render();
}

var queues = {};

queues.emdr = async.queue(function (task, next) {
    models.MarketDataRaws.forge()
    .updateFromEMDR(task) //, {regions: prog.regions})
    .then(function (updates) {
        ct.emdr++;
        updates.forEach(function (update) {
            var task = update.pick('resultType', 'typeID', 'regionID');
            logger.debug("EMDR " + util.inspect(task) + " " + queues.emdr.length());
            var result_type = update.get('resultType');
            if ('orders' === result_type) {
                queues.margins.push(task);
            } else if ('history' === result_type) {
                queues.history.push(task);
            }
        });
    })
    .catch(function (e) { logger.error("EMDR ERROR " + e); })
    .finally(function () { return next(); });
});

queues.history = async.queue(function (task, next) {
    models.MarketHistoryAggregates.forge()
    .updateFromMarketData(task.typeID, task.regionID)
    .then(function (history) {
        ct.history++;
        logger.debug("History for " + util.inspect(task));
    })
    .catch(function (e) { logger.error("History ERROR " + e); })
    .finally(function () { return next(); });
});

queues.margins = async.queue(function (task, next) {
    models.MarketMargins.forge()
    .updateFromMarketData(task.typeID, task.regionID)
    .then(function (margins) {
        ct.margins++;
        logger.debug("Margins for " + util.inspect(task));
        if (false && margins.length > 0) {
            queues.leads.push(task);
        }
    })
    .catch(function (e) { logger.error("Margins ERROR " + e); })
    .finally(function () { return next(); });
}, 1);

queues.leads = async.queue(function (task, next) {
    models.MarketTradeLeads.forge()
    .updateFromMarketData(task.typeID, task.regionID)
    .then(function (results) {
        ct.leads++;
        logger.debug("Leads for " + util.inspect(task));
    })
    .catch(function (e) { logger.error("Leads ERROR " + e); })
    .finally(function () { return next(); });
}, 1);

var LogBoxTransport = function (options) {
    Winston_Transport.call(this, options);
    options = options || {};

    this.out = [];
    this.err = [];

    this.outLogBox   = options.outLogBox   || false;
    this.errLogBox   = options.errLogBox   || false;
    this.history     = options.history     || 10;

    this.json        = options.json        || false;
    this.colorize    = options.colorize    || false;
    this.prettyPrint = options.prettyPrint || false;
    this.timestamp   = typeof options.timestamp !== 'undefined' ? options.timestamp : false;
    this.label       = options.label       || null;

    if (this.json) {
        this.stringify = options.stringify || function (obj) {
            return JSON.stringify(obj, null, 2);
        };
    }
};

util.inherits(LogBoxTransport, Winston_Transport);

LogBoxTransport.prototype.log = function (level, msg, meta, callback) {
    var self = this, output;

    if (self.silent) { return callback(null, true); }

    output = Winston_Common.log({
        level:       level,
        message:     msg,
        meta:        meta,
        colorize:    self.colorize,
        json:        self.json,
        stringify:   self.stringify,
        timestamp:   self.timestamp,
        prettyPrint: self.prettyPrint,
        raw:         self.raw,
        label:       self.label
    });

    var msgs = (level === 'error') ? this.err : this.out;
    var box = (level === 'error') ? this.errLogBox : this.outLogBox;

    msgs.push(output);
    if (msgs.length > self.history) { msgs.shift(); }
    box.setContent(msgs.join("\n"));
    box.scrollTo(box.getScrollHeight());

    self.emit('logged');
    callback(null, true);
};
