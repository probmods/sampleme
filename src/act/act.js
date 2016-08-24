'use strict';

const _ = require('lodash');
const bodyParser = require('body-parser');
const express = require("express");
const sendPostRequest = require('request').post;

const app = express();
const port = 3001;

var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
var sgMail = require('sendgrid').mail;

var CronJob = require('cron').CronJob;


function notify(uid, question) {

  var perceiveURL = "file:///Users/rxdh/Repos/sampleme/src/perceive/perceive.html?question=" + question,
      from_email = new sgMail.Email('mail@sampleme.io'),
      to_email = new sgMail.Email('hawkrobe@gmail.com'),
      subject = '[SampleMe]: ' + question,
      content = new sgMail.Content('text/plain', perceiveURL),
      mail = new sgMail.Mail(from_email, subject, to_email, content);

  var request = sg.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: mail.toJSON()
  });

  sg.API(request, function(error, response) {
    console.log(response.statusCode);
    console.log(response.body);
    console.log(response.headers);
  });
}


function requestHandler(request, response) {
  var url = request.url;

  var urlSplit = url.split("/?");
  if (urlSplit.length == 1) {
    response.end('no action taken');
  } else {
    var paramsString = _.last(urlSplit),
        params = _.object(_.map(paramsString.split("&"),
                                function(s) { return s.split("=") }));

    // convert uid and time to integers
    params.uid = parseInt(params.uid);
    params.time = parseInt(params.time);

    if (params.delta) {
      params.delta = parseInt(params.delta);
      params.time = _.now() + params.delta * 1000;
    }

    console.log(params);
    response.end('scheduled notification');

    var job = new CronJob({
      cronTime: new Date(params.time),
      onTick: function() {
        console.log('[act] asking user ' + params.uid + ' question ' + params.question);
        notify(params.uid, params.question);
      },
      startNow: true, /* Start the job right now */
      timeZone: 'America/Los_Angeles'
    });
  }
}

// Note: this can be factored out w/ data as a param
function registerActionHandler() {
  const data = {
    callbackURL: 'http://127.0.0.1:3001/handle-action',
    collection: 'actions'
  };
  sendPostRequest(
    'http://localhost:4000/register-handler',
    { json: data },
    (error, res, body) => {
      if (!error && res.statusCode === 200) {
        console.log('[act] successfully registered action handler');
      } else {
        console.error(`[act] failed to register action handler, will try again`);
        setTimeout(registerActionHandler, 2000);
      }
    }
  );
}

function serve() {
  if (process.env.SENDGRID_API_KEY === undefined) {
    console.error('[act] ERROR: environment key SENDGRID_API_KEY not found; try running "source act/sendgrid.env" first');
    return
  }

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  registerActionHandler();
  
  app.post('/handle-action', (request, response) => {
    const data = request.body;    
    if (!data.ops || data.ops.length != 1) {
      return failure(response, "can't handle act: ${data}");
    }
    const newAction = data.ops[0];
    console.log('[act] observed new action', newAction);
    
    return success(response, 'successfully received action');
  });
  
  app.listen(port, (err) => {
    if (err) {
      return console.log('[act] something bad happened', err)
    }

    console.log(`[act] running at http://localhost:${port}`)
  })

}


if (require.main === module) {
  serve();
}

module.exports = {
  serve
};
