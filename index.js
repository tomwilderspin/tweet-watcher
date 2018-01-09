// written for my pi node version 0.12.4

var https = require('https');

var Gpio = require('onoff').Gpio;

var led = new Gpio(17, 'out');

var serviceHost = process.env.SERIVCE_HOST;
var servicePath = process.env.SERVICE_PATH;

var token = process.env.TOKEN;

var timeoutDuration = 4000; 

var refresh = function(pointer) {

    var pollTweets = checkForNewTweet(pointer);

    pollTweets(function(data) {

        if (!data) {
            console.log('no data so setting refresh timer');
            return setTimeout(refresh, timeoutDuration);
        }

        if(data.new === true) {
            //console.log('new tweet '+ data.tweet);
            led.writeSync(1); // lit!
        } else {
            led.writeSync(0); // not lit
        }

        setTimeout(function(){refresh(data.pointer)}, timeoutDuration);
    });
}

function checkForNewTweet(pointer) {

    var pointer = pointer ? pointer : null;

    return function(callback) {
        console.log('getting twitter data');
        var requestParams = {
            hostname: serviceHost,
            path: '/'+ servicePath + (pointer ? '?pointer=' + pointer : ''),
            method: 'GET',
            headers: {
                Authorization: token
            }
        };

        var responseBody = "";

        var request = https.request(requestParams, function(res){

            res.setEncoding('utf8');
            res.on('data', function (chunk) {
             responseBody = responseBody + chunk;
            });

            res.on('end', function() {

                //console.log('res body raw ', responseBody);

                var jsonResponse = responseBody ? JSON.parse(responseBody) : null;

                callback(jsonResponse);
            });
        });

        request.on('error', function(e) {
            console.log('problem with tweet check request: ' + e.message);
        });

        request.end();
    }
}

//init
refresh();

//shutdown
process.on('SIGINT', function () {
    led.unexport();
  });