process.env.NODE_ENV = 'test';

var util = require('util');
var _ = require('underscore');
var async = require('async');
var assert = require('chai').assert;
var expect = require('chai').expect;
var Knex = require('knex');
var Bookshelf = require('bookshelf');

var logger = require('winston');

var conf = require('../lib/config');
var testUtils = require(__dirname + '/lib/index.js');

describe("Play", function () {

});
