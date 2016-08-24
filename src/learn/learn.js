'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const webppl = require('webppl');
const sendPostRequest = require('request').post;

const port = 3004;


function log(x) {
  console.log(`[learn] ${x}`);
}

function initLearner() {
  log('compiling webppl code');
  const learnerCodePath = path.join(__dirname, 'learner.wppl');
  const learnerCode = fs.readFileSync(learnerCodePath, 'utf8');
  const compiledModel = webppl.compile(learnerCode, {
    verbose: true,
    debug: true
  });
  return compiledModel;
}

function loadUserData(callbacks) {
  log('reading user data from db');
  sendPostRequest(
    'http://127.0.0.1:4000/db/find',
    { json: { collection: 'percepts' } },
    (error, res, body) => {
      if (!error && res && res.statusCode === 200) {
        log('successfully read user data from db');
        callbacks.success(body);
      } else {
        log(`failed to read user data from db: ${res ? res.statusCode : ''} ${error}`);
        callbacks.failure();
      }
    });
}

function loadParameters(callbacks) {
  log('reading current model parameters from db');
  sendPostRequest(
    'http://127.0.0.1:4000/db/find',
    { json: { collection: 'parameters' } },
    (error, res, body) => {
      if (!error && res && res.statusCode === 200) {
        log('successfully read parameters from db');
        let newParameters = {};
        if (body.length === 0) {
          // no parameters stored yet
          log('no parameters found, starting with empty parameter set');
        } else if (body.length === 1) {
          if (!body[0].params) {
            console.error(`[learn] expected params document to have single params key`);
            callbacks.failure();
          }
          newParameters = body[0].params;
        } else {
          console.error(`[learn] expected to find single parameters doc, got ${body.length}`);
          return callbacks.failure();
        }
        callbacks.success(newParameters);
      } else {
        log(`failed to read user data from db: ${res ? res.statusCode : ''} ${error}`);
        callbacks.failure();
      }
    });
}

function updateParameters(options, callbacks) {
  log('running webppl model to update parameters');
  const prepared = webppl.prepare(
    options.model,
    (s, value) => {
      const newParameters = value.newParameters;
      const output = value.output;
      log(`webppl: ${output}`);
      callbacks.success(newParameters)
    },
    { initialStore: { userData: options.userData, params: options.params } }
  );
  prepared.run();
}

function storeParameters(params, callbacks) {
  log('storing new model parameters in db');
  // TODO
  callbacks.success();
}

function runLearner(model) {
  function failure() {
    log('learner failed to complete iteration, starting over');
    setTimeout(() => runLearner(model), 2000);
  }
  loadUserData({
    success: (userData) => {
      loadParameters({
        success: (params) => {
          updateParameters({ params, userData, model }, {
            success: (newParams) => {
              storeParameters(newParams, {
                success: () => {
                  log('successfully completed learner iteration');
                  setTimeout(() => runLearner(model), 1000);
                },
                failure
              });
            },
            failure
          });
        },
        failure
      });
    },
    failure
  });
}


function serve() {

  const server = http.createServer((request, response) => {
    // optionally do something (maybe report on inference progress?)
  });

  const compiledModel = initLearner();

  runLearner(compiledModel);

  server.listen(port, (err) => {
    if (err) {
      return log('something bad happened', err);
    }
    log(`running at http://localhost:${port}`);
  });

}


if (require.main === module) {
  serve();
}

module.exports = {
  serve
};
