export default function (program, init) {
  program.command('scanmarket')
    .description('scan market for orders and history')
    .option('-c, --character <name>', 'character for CREST authentication')
    .option('-r, --regions <name,name,name>', 'regional market for scan', list)
    .option('-g, --groups <id,id,...,id>', 'market group for items', list)
    .option('-O, --orders', 'use regions and types found in orders')
    .option('-C, --concurrency <number>', 'CREST fetch concurrency (default: 4)')
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

const DEFAULT_CONCURRENCY = 4;

const DEFAULT_GROUPS = [
  'Ships', 'Ship Equipment', 'Ammunition & Charges', 'Drones',
  'Ship Modifications'
];

function cmd (args, options, shared) {
  const logger = shared.logger;

  const concurrency = options.concurrency || DEFAULT_CONCURRENCY;

  let regions, marketGroups, types, typesTotal, typesProcessed, refreshToken,
      accessToken, character, startedAt;

  Character.forge({CharacterName: options.character}).fetch()
    .then(result => {
      if (result == null) { throw 'Character not found'; }
      character = result;
    })
    .then(result => character.authorizeCrest())
    .then(result => character.whoamiCrest())
    .then(result => {
      logger.info('Authenticated as ' + character.get('CharacterName') +
                  ' (' + character.get('CharacterID') + ')');
      if (options.orders) {
        return fetchRegionsAndTypesViaOrders();
      } else {
        return fetchRegionsAndTypesViaOptions(options);
      }
    })
    .then(function (result) {
      startedAt = Date.now();
      regions = result.regions;
      types = result.types;
      typesTotal = types.length;
      typesProcessed = 0;

      logger.verbose("Scanning " + regions.length + " regions");
      logger.verbose("Scanning " + typesTotal + " types");
      return types;
    })
    .map(type => Promise.map(regions, region =>
      MarketType.forge({typeID: type.typeID, regionID: region.regionID})
        .createOrUpdate()
        .then(obj => obj.fetchCRESTData(character))
        .then(obj => obj.calculateSummaries())
        .then(function (results) {
          typesProcessed++;

          var duration = Date.now() - startedAt;
          var perType = duration / typesProcessed;
          var expectedDuration = typesTotal * perType;
          var remainingDuration = expectedDuration - duration;

          logger.info([
            parseInt(( typesProcessed / typesTotal ) * 100),
            '% (', typesProcessed, ' / ', typesTotal, ')',
            ' ', parseInt(remainingDuration / 1000 / 60), ' / ',
                 parseInt(expectedDuration / 1000 / 60),' min est'
          ].join(''));

          return results;
        })
    ), {concurrency: concurrency})
    .catch(err => logger.error(err))
    .finally(() => shared.exit());
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
