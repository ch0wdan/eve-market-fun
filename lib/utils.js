var util = require('util');
var _ = require('underscore');

exports.coerceArray = function (data) {
    if (typeof data == 'undefined') {
        return [];
    }
    return _.isArray(data) ? data : [data];
}
