'use strict';

const _ = require('lodash');
const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const mongodb = require('mongodb');
const path = require('path');
const sendPostRequest = require('request').post;
const colors = require('colors/safe');

const app = express();
const MongoClient = mongodb.MongoClient;
const port = 4000;
const mongoURL = 'mongodb://localhost:27017/sampleme';
const handlers = {};


function makeMessage(text) {
  return `${colors.blue('[store]')} ${text}`;
}

function log(text) {
  console.log(makeMessage(text));
}

function error(text) {
  console.error(makeMessage(text));
}

function failure(response, text) {
  const message = makeMessage(text);
  console.error(message);
  return response.status(500).send(message);
}

function success(response, text) {
  const message = makeMessage(text);
  console.log(message);
  return response.send(message);
}


function mongoConnectWithRetry(delayInMilliseconds, callback) {
  MongoClient.connect(mongoURL, (err, db) => {
    if (err) {
      console.error(`Error connecting to MongoDB: ${err}`);
      setTimeout(() => mongoConnectWithRetry(delayInMilliseconds, callback), delayInMilliseconds);
    } else {
      log('connected succesfully to mongodb');
      callback(db);
    }
  });
}


function addFixtures(db) {
  const fixturePath = path.join(__dirname, 'fixtures.json');
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  _.forEach(fixtures, (entries, collectionName) => {
    const collection = db.collection(collectionName);
    collection.count((err, count) => {
      if (!err && count === 0) {
        log(`inserting fixtures into ${collectionName}`);
        collection.insertMany(entries);
      }
    });
  });
}


function serve() {

  mongoConnectWithRetry(2000, (database) => {

    addFixtures(database);

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    app.post('/register-handler', (request, response) => {
      if (!request.body) {
        return failure(response, 'register-handler needs post request body');
      }
      const collection = request.body.collection;
      const callbackURL = request.body.callbackURL;
      if (!collection) {
        return failure(response, 'register-handler needs collection');
      }
      if (!callbackURL) {
        return failure(response, 'register-handler needs callbackURL');
      }
      if (handlers[collection] === undefined) {
        handlers[collection] = [];
      }
      if (_.includes(handlers[collection], callbackURL)) {
        return success(response, `handler for ${collection} already registered: ${callbackURL}`);
      }
      handlers[collection].push(callbackURL);
      return success(response, `added handler for ${collection}: ${callbackURL}`);
    });

    app.post('/db/findOne', (request, response) => {
      if (!request.body) {
        return failure(response, '/db/findOne needs post request body');
      }
      const collectionName = request.body.collection;
      if (!collectionName) {
        return failure(response, '/db/findOne needs collection');
      }
      const query = request.body.query || {};
      const projection = request.body.projection;
      const collection = database.collection(collectionName);
      log(`got request to findOne in ${collectionName} with` +
          ` query ${JSON.stringify(query)} and projection ${JSON.stringify(projection)}`);
      collection.findOne(query, projection).then((data) => {
        response.json(data);
      });
    });

    app.post('/db/find', (request, response) => {
      if (!request.body) {
        return failure(response, '/db/find needs post request body');
      }
      const collectionName = request.body.collection;
      if (!collectionName) {
        return failure(response, '/db/find needs collection');
      }
      const query = request.body.query || {};
      const projection = request.body.projection;
      const collection = database.collection(collectionName);
      log(`got request to find in ${collectionName} with` +
          ` query ${JSON.stringify(query)} and projection ${JSON.stringify(projection)}`);
      collection.find(query, projection).toArray().then((data) => {
        response.json(data);
      });
    });

    app.post('/db/insert', (request, response) => {
      if (!request.body) {
        return failure(response, '/db/insert needs post request body');
      }
      const collectionName = request.body.collection;
      if (!collectionName) {
        return failure(response, '/db/insert needs collection');
      }
      log(`got request to insert into ${request.body.collection}`);
      const collection = database.collection(collectionName);
      const data = _.omit(request.body, ['collection']);
      log(`inserting data: ${JSON.stringify(data)}`);
      collection.insert(data, (err, result) => {
        if (err) {
          return failure(response, `error inserting data: ${err}`);
        } else {
          // Success
          if (handlers[collectionName]) {
            // Call handlers that watch this collection
            handlers[collectionName].forEach((callbackURL) => {
              log(`calling ${collectionName} handler: ${callbackURL}`);
              sendPostRequest(callbackURL, { json: result }, (err2, res, body) => {
                if (!err2 && res.statusCode === 200) {
                  log(`successfully notified handler ${callbackURL}`);
                } else {
                  error(`[store] error notifying ${callbackURL}: ${err2} ${body}`);
                }
              });
            });
          }
          return success(response, `successfully inserted data. result: ${JSON.stringify(result)}`);
        }
      });
    });

    app.listen(port, () => {
      log(`running at http://localhost:${port}`);
    });

  });

}

if (require.main === module) {
  serve();
}

module.exports = {
  serve
};
