var util = require('util');
var _ = require('underscore');

exports.coerceArray = function (data) {
    return _.isArray(data) ? data : [data];
}
