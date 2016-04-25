export default function (program, init) {
  program.command('scanmarket')
    .description('scan market for orders and history')
    .option('-c, --character <name>', 'character for CREST authentication')
    .option('-r, --regions <name,name,name>', 'regional market for scan', list)
    .option('-g, --groups <id,id,...,id>', 'market group for items', list)
    .option('-O, --orders', 'use regions and types found in orders')
    .option('-C, --concurrency <number>',
            'CREST fetch concurrency (default: ' + DEFAULT_CONCURRENCY + ')')
    .option('-R, --retries <number>',
            'Number of retries for failed CREST requests (default: ' + DEFAULT_RETRIES + ')')
    .option('-t, --timeout <number>',
            'Time out for CREST requests in milliseconds (default: ' + DEFAULT_TIMEOUT + ')')
    .option('-A, --age <number>',
            'Maximum age (in ms) for cached CREST data (default: ' + DEFAULT_MAX_AGE + ')')
    .action(init(cmd));
};

const list = val => val.split(/,/g);

import _ from 'lodash';
import async from 'async';
import Promise from 'bluebird';

const request = Promise.promisify(require('request'));

import eveData from '../eveData';
import config from '../../config';

import {Character, Characters, MarketType} from '../models';

const DEFAULT_RETRIES = 3;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_TIMEOUT = 7000;
const DEFAULT_MAX_AGE = 30 * 60 * 1000;

const DEFAULT_GROUPS = [
  'Ships', 'Ship Equipment', 'Ammunition & Charges', 'Drones',
  'Ship Modifications'
];

function cmd (args, options, shared) {
  const logger = shared.logger;

  const timeout = parseInt(options.timeout || DEFAULT_TIMEOUT);
  const retries = parseInt(options.retries || DEFAULT_RETRIES);
  const concurrency = parseInt(options.concurrency || DEFAULT_CONCURRENCY);
  const max_age = parseInt(options.age || DEFAULT_MAX_AGE);

  let regions, marketGroups, types, tasksTotal, refreshToken, accessToken,
      character, startedAt, duration, remainingTasks, runningTasks, perType,
      expectedDuration, remainingDuration, tasksProcessed;

  const scanQueue = async.queue((task, next) => MarketType
    .forge({
      typeID: task.typeID,
      regionID: task.regionID,
      marketGroupID: task.marketGroupID
    })
    .createOrUpdate()
    .then(marketType => marketType.update(character, {timeout, max_age}))
    .then(marketType => {
      duration = Date.now() - startedAt;
      runningTasks = scanQueue.running();
      remainingTasks = scanQueue.length() + runningTasks;
      tasksProcessed = tasksTotal - remainingTasks;
      perType = duration / tasksProcessed;
      expectedDuration = tasksTotal * perType;
      remainingDuration = expectedDuration - duration;

      logger.info([
        parseInt(( tasksProcessed / tasksTotal ) * 100),
        '% (', runningTasks, ' / ', remainingTasks, ' / ', tasksTotal, ')',
        ' ', parseInt(remainingDuration / 1000 / 60), ' / ',
             parseInt(expectedDuration / 1000 / 60),' min est'
      ].join(''));
    })
    .catch(err => {
      task.tries++;
      if (task.tries < retries) {
        logger.error("ERROR (retrying):", err);
        scanQueue.push(task);
      } else {
        logger.error("ERROR (failed):", err);
      }
    })
    .finally(() => next()));

  scanQueue.concurrency = concurrency;

  scanQueue.drain = () => {
    logger.debug('Queue drained, exiting.');
    shared.exit();
  };

  Character.forge({
    CharacterName: options.character
  }).fetch().then(result => {
    if (result == null) { throw 'Character not found'; }

    character = result;
    logger.info('Authenticated as ' + character.get('characterName') +
                ' (' + character.get('characterID') + ')');

    return Promise.props({
      authorize: character.authorizeCrest(),
      lookup: options.orders ?
        fetchRegionsAndTypesViaOrders() :
        fetchRegionsAndTypesViaOptions(options)
    });
  }).then(function (result) {
    regions = result.lookup.regions;
    types = result.lookup.types;

    logger.verbose("Scanning " + regions.length + " regions");
    logger.verbose("Scanning " + types.length + " types");

    types.forEach(type => {
      regions.forEach(region => {
        scanQueue.push({
          tries: 0,
          typeID: type.typeID,
          typeName: type.typeName,
          marketGroupID: type.marketGroupID,
          regionID: region.regionID,
          regionName: region.regionName
        })
      })
    });

    startedAt = Date.now();
    tasksTotal = scanQueue.length();

    logger.verbose("Total tasks = " + tasksTotal);
  });
}

function fetchRegionsAndTypesViaOptions (options) {
  if (!options.groups || options.groups.length === 0) {
    options.groups = DEFAULT_GROUPS;
  }
  return eveData.invMarketGroups({shallow:true}).then(function (result) {
    const marketGroups = _.chain(result).filter(function (group, groupID) {
      if (!options.groups) { return true; }
      return options.groups.indexOf(group.marketGroupName) !== -1;
    }).map(function (group) {
      return group.marketGroupID;
    }).value();
    return Promise.props({
      types: eveData.invTypes({ marketGroupID: marketGroups }),
      regions: eveData.mapRegions({ regionName: options.regions })
    });
  });
}

function fetchRegionsAndTypesViaOrders (options) {
  return models.Order.find({ orderState: 0 }).then(function (orders) {
    const stationIDs = _.chain(orders).pluck('stationID').uniq().value();
    const typeIDs = _.chain(orders).pluck('typeID').uniq().value();
    return Promise.props({
      types: eveData.invTypes({ typeID: typeIDs }),
      regions: eveData.lookupRegions({ stationID: stationIDs })
    });
  });
}
