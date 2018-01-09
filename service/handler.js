'use strict';

const http = require('http');
require('isomorphic-fetch');
const Twitter = require('twitter');

const token = process.env.REQUEST_TOKEN;
const searchTerm = encodeURIComponent(process.env.SEARCH_TERM);

const twitterParams = {
  consumer_key: process.env.T_CONSUMER_KEY,
  consumer_secret: process.env.T_CONSUMER_SECRET
};

const encodedConsumer = new Buffer(`${twitterParams.consumer_key}:${twitterParams.consumer_secret}`).toString('base64');

module.exports.checkTweets = (event, context, callback) => {

  //check for token

  const inboundToken = event.headers.Authorization || '';
  const clientPointer = event.queryStringParameters ?
   event.queryStringParameters.pointer || '' :
   '';

  if (inboundToken !== token) {
    console.log('unauthorized request token', event.headers, inboundToken, token);
    return callback(null, {
      statusCode: 403,
      body: JSON.stringify({
        message: 'unauthorized request'
      })
    });
  }

  //check twitter
  fetch('https://api.twitter.com/oauth2/token', {
    method: 'post',
    headers: {
      'User-Agent': 'tweet watcher v0.0.1',
      'Authorization': `Basic ${encodedConsumer}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: 'grant_type=client_credentials'
  }).then(response => {
    if (response.status !== 200) {
      const error = new Error(response.statusText);
      error.consumer = encodedConsumer;
      error.response = response;
      throw error;
    }

    return response.json();
  }).then(responseJson => {

    Object.assign(twitterParams, { bearer_token: responseJson.access_token});
    const twitter = new Twitter(twitterParams);
    const params = {'q': searchTerm, count: 2};

    return new Promise((resolve, reject) => {
      return twitter.get('search/tweets', params, (error, tweets, response) => {
        if (error) {
          console.log('error from twitter api', twitterParams, params, responseJson);
          reject(error);
        } 

        return resolve(tweets);
      });
    });

  }).then(tweets => {

    if (tweets.statuses.length === 0) {
      return false;
    }

    const firstTweet = tweets.statuses.shift();
    if (clientPointer && firstTweet.id === parseInt(clientPointer)) {
      console.log('no new tweets', clientPointer, firstTweet.id);
      return callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          message: 'no new tweet',
          tweet: firstTweet.text,
          new: false,
          pointer: clientPointer,
          previous_pointer: clientPointer
        })
      });
      
    }

    console.log('new tweet', firstTweet.text, firstTweet.id);

      return callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          message: 'new tweet',
          tweet: firstTweet.text,
          new: true,
          pointer: firstTweet.id,
          previous_pointer: clientPointer
        })
      });


  }).catch(error => {
    console.log('titter fetch error', error);
    return callback(null, {
      statusCode: 500,
      body: JSON.stringify({
        message: 'error talking to twitter',
        pointer: clientPointer
      })
    });
  });

};
