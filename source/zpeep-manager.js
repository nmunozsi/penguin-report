'use strict';
/**
 * @file ZPeep related services
 * @copyright Zemoga Inc
 */

import requestURL from 'request-promise';
import {parseString} from 'xml2js';
import lodash from 'lodash';
import map from 'lodash/fp/map';
import flatten from 'lodash/fp/flatten';
//import util from 'util';
import cheerio from 'cheerio';
import Promise from 'bluebird';
import CONFIG from './config';

const { PERSON_NAME, PERSON_ID } = CONFIG;
const ADMIN_USER_ID = '870268';
const HIDDEN_PROJECT_NAME = 'Zemoga-Directors Team';

const ZPeepManager = {

  Z_PEEPS_COLLECTION_NAME: 'zpeeps',

  getAdminId () {
    return ADMIN_USER_ID;
  },

  getAdminHiddenProject () {
    return HIDDEN_PROJECT_NAME;
  },

  //TODO: IDs should be retrieved from people.xml
  //take into account that it will retrieve every z-peep from given company and
  //there is not such thing like filter by UI dept
  peopleIds: [
    {[PERSON_NAME]: 'Katherine Renteria', [PERSON_ID] : '10285578', hours: 0},
    {[PERSON_NAME]: 'David Alvarez', [PERSON_ID] : '7303296', hours: 0},
    {[PERSON_NAME]: 'Paola Gonzalez', [PERSON_ID] : '4056246', hours: 0},
    {[PERSON_NAME]: 'Vivian Garzon', [PERSON_ID] : '12131306', hours: 0},
    {[PERSON_NAME]: 'Jose Ignacio', [PERSON_ID] : '12003619', hours: 0},
    {[PERSON_NAME]: 'Nicolas Muñoz', [PERSON_ID]: '12224662', hours: 0},
    {[PERSON_NAME]: 'David Jurado', [PERSON_ID]: '12296211', hours: 0}
  ],

  /**
   * Add a new z-peep for push notification registry
   * @param {Object}   db       Mongo DB Object
   * @param {Function} callback A function object that will be fired once command is completed
   * @returns {void}
   */
  addZPeep (db, {personid, registrationid, personname}, callback) {
    db.collection(ZPeepManager.Z_PEEPS_COLLECTION_NAME).insertOne({
      'person-id': personid,
      'person-name': personname,
      'registration-id': registrationid
    }, (err, results) => {
      console.log('Inserted a zpeep!!', personid, personname, registrationid);
      db.close();
      callback(results);
    });
  },

  /**
   * [findZPeep description]
   * @param  {string} personid Person ID identifier
   * @param  {Object} db Database object
   * @param  {Function} callback Function to call once DB returned data
   * @return {void}          Number of zpeeps
   */
  getZPeepCount (personid, db, callback) {
    const cursor = db.collection(ZPeepManager.Z_PEEPS_COLLECTION_NAME).find(
        {'person-id': personid}
      );

    cursor.count((err, count) => {
      callback(count || 0);
    });
  },

  /**
   * Get all registration IDs and format the request for push notification
   * @param  {Object}   db           Reference to the Mongo DB
   * @param  {Array}   pinguinedIds Array containing person-ids to search for
   * @param  {Function} callback     Fires once data is retrieved
   * @returns {void}
   */
  getZPeepsRegistry (db, pinguinedIds, callback) {
    console.log('pinguinedIds', pinguinedIds);
    const requestBody = {'registration_ids': []};
    const cursor = db.collection(ZPeepManager.Z_PEEPS_COLLECTION_NAME).find(
      {$or: pinguinedIds}
    );

    cursor.each((err, doc) => {
      if (doc !== null) {
        requestBody['registration_ids'].push(doc['registration-id']);
      } else {
        db.close();
        callback(requestBody);
      }
    });
  },

  /**
   * Update current registered zpeep
   * @param  {Object}   db                     Reference to Mongo DB
   * @param  {string}   options.personid       The zpeep id
   * @param  {string}   options.registrationid The new registration id
   * @param  {Function} callback               Fires once update is achieved
   * @returns {void}
   */
  syncZPeep (db, {personid, registrationid}, callback) {
    console.log('time to sync');
    db.collection(ZPeepManager.Z_PEEPS_COLLECTION_NAME).updateOne(
    {'person-id': personid},
    {$set: {'registration-id': registrationid}},
    (err, results) => {
      console.log('Updated a zpeep!!', personid, registrationid);
      db.close();
      callback(results);
    });
  },

  /**
   * Get timesheet reports and format data for proper rendering
   * @param  {string}   reportDate A string representing a date 'YYYYMMDD'
   * @param  {Function} callback   Triggers once data is retrieved
   * @returns {void}
   */
  getZPeepsTimeReport (reportDate, callback) {

    //Initialize Object with time report data
    let timeEntries = null;
    const REQUEST_USER_AGENT_HEADER = 'Andres Garcia Reports (andres@zemoga.com)';

    console.log('env vars: ', CONFIG.BASECAMP_PROTOCOL);

    //Call to Basecamp reports
    const requestTimeReport =
      {uri: `${CONFIG.BASECAMP_PROTOCOL}${CONFIG.BASECAMP_TOKEN}@${CONFIG.BASECAMP_DOMAIN}${CONFIG.BASECAMP_PATH}`,
        qs: {from: reportDate, to: reportDate},
        headers: {'User-Agent': REQUEST_USER_AGENT_HEADER}
      };

    console.log('report URL: ' + requestTimeReport.uri + '?from=' + reportDate + '&to=' + reportDate);

    requestURL(requestTimeReport)
      .then((body) => {

        parseString(body, (parseError, parseResult) => {
          timeEntries = parseResult['time-entries']['time-entry'];

          //TODO: Refactor > I want a final dataset in the way of:
          // [{'person-id': xxxxx,
          // 'person-name': 'xxxxx',
          // 'total-hours': 'xx.xx',
          // 'reports': [{'description': 'xx', ..}, ...]}];
          // this can be acomplished with less lodash involvement, less code and vanilla js.

          // Basically I'm filtering reports.xml so discarding users non in peopleIds (UI team)
          //PD: Sorry for the long line
          timeEntries =
          lodash.filter(
            timeEntries, (entry) =>
              ZPeepManager.peopleIds.map((el) =>
                el[PERSON_ID]).indexOf(entry[PERSON_ID][0]._) !== -1
          );

          //Normalize some ugly data
          lodash.forEach(timeEntries, (entry) => {
            //console.log(util.inspect(entry, false, null));
            //console.log('todo: ' + entry['todo-item-id'][0]._);
            entry[PERSON_ID] = entry[PERSON_ID][0]._;
            entry.hours = +entry.hours[0]._;
            entry.projectName = '';
            entry.todoName = '';

            //Sometimes, empty descriptions are parsed by xml2js coms as weird { '$': { nil: 'true' } } objects.
            //So normalizing to empty string
            entry.description = entry.description[0];
            if (typeof entry.description === 'object') {
              entry.description = '';
            }

            entry[PERSON_NAME] = entry[PERSON_NAME].toString();
          });

          //Grouping allows me to easily sumarize each report because reports are not sorted by each z-peep
          timeEntries = lodash.groupBy(timeEntries, PERSON_ID);

          //If 0 reports, the user will not be present in the reports API
          //so as calling People.xml is pending, I'm completing the info
          //from harcoding users in peopleIds
          ZPeepManager.peopleIds.forEach((person) => {
            const thisPersonId = person[PERSON_ID];
            let isAvailable = false;

            lodash.forOwn(timeEntries, (entryValue, entryKey) => {
              if (thisPersonId === entryKey) {
                isAvailable = true;
              }
            });
            if (!isAvailable) {
              timeEntries[thisPersonId] = [person];

              person.projectName = '';
              person.todoName = '';
            }
          });

          //Just to sort by total hours :( Thinking on refactoring
          lodash.forOwn(timeEntries, (value, key) => {
            let totalHours = 0;
            let personName = '';

            lodash.forEach(value, (timeEntryValue) => {
              personName = timeEntryValue[PERSON_NAME];
              totalHours += timeEntryValue.hours;
            });
            timeEntries[key] = {[PERSON_ID]: key, [PERSON_NAME]: personName, totalHours, report: value};
          });
          timeEntries = lodash.sortBy(timeEntries, ['totalHours']);

          let currentTimeEntry = 0;
          //Get the total number of time entry records
          const timeEntriesCount = lodash.flow(
            map('report'),
            flatten)(timeEntries).length;

          //Additional report data (Project name and todo name)
          //@TODO: Making requests x each entry is not cool. We need mem Cache for project info.
          lodash.forEach(timeEntries, (entry) => {

            lodash.forEach(entry.report, (report) => {

              const projectId = report['project-id'];
              const todoItemId = report['todo-item-id'];
              const requests = [];

              if (projectId) {
                //Gets the project info:
                const requestProjectInfo = {
                  url: `${CONFIG.BASECAMP_PROTOCOL}${CONFIG.BASECAMP_TOKEN}@${CONFIG.BASECAMP_DOMAIN}/projects/${projectId[0]._}.xml`,
                  headers: {'User-Agent': REQUEST_USER_AGENT_HEADER}
                };
                //console.log(requestProjectInfo.url);

                requests.push(requestURL(requestProjectInfo));
              }

              if (todoItemId && todoItemId[0] && todoItemId[0]._) {
                //Gets the todo item name
                const requestTodoInfo = {
                  url: `${CONFIG.BASECAMP_PROTOCOL}${CONFIG.BASECAMP_TOKEN}@${CONFIG.BASECAMP_DOMAIN}/todo_items/${todoItemId[0]._}.xml`,
                  headers: {'User-Agent': REQUEST_USER_AGENT_HEADER}
                };
                //console.log(requestTodoInfo.url);

                requests.push(requestURL(requestTodoInfo));
              }

              if (requests.length) {
                Promise.all(requests)
                    .spread((responseProjectInfo, responseTodoInfo) => {

                      const projectName = cheerio.load(responseProjectInfo).root().find('project > name').text();

                      report.projectName = projectName;

                      if (typeof responseTodoInfo !== 'undefined') {
                        const todoName = cheerio.load(responseTodoInfo).root().find('todo-item > content').text();

                        report.todoName = todoName + ': ';
                      }
                    }).catch((err) => {
                      console.log('Error occured when requesting additional entry information:' + err);
                    }).finally(() => {
                      currentTimeEntry++;
                      //All requests made, so calling callback to continue the rendering process
                      if (currentTimeEntry === timeEntriesCount) {
                        //Returns array of formalized data
                        //console.log(currentTimeEntry);
                        //console.log(timeEntries[20].report[0]);
                        callback(timeEntries);
                      }
                    });
              } else {
                currentTimeEntry++;
                //All requests made, so calling callback to continue the rendering process
                if (currentTimeEntry === timeEntriesCount) {
                  //Returns array of formalized data
                  //console.log(timeEntries);
                  callback(timeEntries);
                }
              }
            });
          });
        });
      }).catch((err) => {
        console.log('error >>>>> ' + err);
      });
  }
};

export {ZPeepManager};
