exports.up = function(knex, Promise) {
  return knex.schema.table('Characters', function (t) {

    // info
    t.string('accountBalance');
    t.string('skillPoints');
    t.string('nextTrainingEnds');
    t.string('shipName');
    t.string('shipTypeID');
    t.string('shipTypeName');
    t.string('corporationDate');
    t.string('allianceDate');
    t.string('lastKnownLocation');
    t.string('securityStatus');
    t.json('employmentHistory');

    // sheet
    t.string('homeStationID');
    t.string('DoB');
    t.string('race');
    t.string('bloodLineID');
    t.string('bloodLine');
    t.string('ancestryID');
    t.string('ancestry');
    t.string('gender');
    t.string('cloneTypeID');
    t.string('cloneName');
    t.string('cloneSkillPoints');
    t.string('freeSkillPoints');
    t.string('freeRespecs');
    t.string('cloneJumpDate');
    t.string('lastRespecDate');
    t.string('lastTimedRespec');
    t.string('remoteStationDate');
    t.json('jumpClones');
    t.json('jumpCloneImplants');
    t.string('jumpActivation');
    t.string('jumpFatigue');
    t.string('jumpLastUpdate');
    t.json('implants');
    t.json('attributes');
    t.json('skills');
    t.json('certificates');
    t.json('corporationRoles');
    t.json('corporationRolesAtHQ');
    t.json('corporationRolesAtBase');
    t.json('corporationRolesAtOther');
    t.json('corporationTitles');

  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('Characters', function (t) {

    // info
    t.dropColumn('accountBalance');
    t.dropColumn('skillPoints');
    t.dropColumn('nextTrainingEnds');
    t.dropColumn('shipName');
    t.dropColumn('shipTypeID');
    t.dropColumn('shipTypeName');
    t.dropColumn('corporationDate');
    t.dropColumn('allianceDate');
    t.dropColumn('lastKnownLocation');
    t.dropColumn('securityStatus');
    t.dropColumn('employmentHistory');

    // sheet
    t.dropColumn('homeStationID');
    t.dropColumn('DoB');
    t.dropColumn('race');
    t.dropColumn('bloodLineID');
    t.dropColumn('bloodLine');
    t.dropColumn('ancestryID');
    t.dropColumn('ancestry');
    t.dropColumn('gender');
    t.dropColumn('corporationName');
    t.dropColumn('corporationID');
    t.dropColumn('cloneTypeID');
    t.dropColumn('cloneName');
    t.dropColumn('cloneSkillPoints');
    t.dropColumn('freeSkillPoints');
    t.dropColumn('freeRespecs');
    t.dropColumn('cloneJumpDate');
    t.dropColumn('lastRespecDate');
    t.dropColumn('lastTimedRespec');
    t.dropColumn('remoteStationDate');
    t.dropColumn('jumpClones');
    t.dropColumn('jumpCloneImplants');
    t.dropColumn('jumpActivation');
    t.dropColumn('jumpFatigue');
    t.dropColumn('jumpLastUpdate');
    t.dropColumn('implants');
    t.dropColumn('attributes');
    t.dropColumn('skills');
    t.dropColumn('certificates');
    t.dropColumn('corporationRoles');
    t.dropColumn('corporationRolesAtHQ');
    t.dropColumn('corporationRolesAtBase');
    t.dropColumn('corporationRolesAtOther');
    t.dropColumn('corporationTitles');

  });
};
