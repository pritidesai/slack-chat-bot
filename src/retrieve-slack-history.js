/*
 * Copyright 2015-2016 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
  * This is the action to retrieve slack history so that it can be posted on
  * OpenWhisk dev list. This is the first action in a sequence of three actions.
  * Details are on cwiki:
  * https://cwiki.apache.org/confluence/display/OPENWHISK/Slack+Chat+Bot+for+OpenWhisk+Dev+List
  *
  * main() will be invoked when you run this action.
  *
  * @param whisk actions accept a single parameter,
  *        which must be a JSON object with following keys.
  *
  * @param {string} url     - Slack webhook url
  * @param {string} token   - Slack token
  * @param {string} channel - Slack team channel
  *
  * In this case, the params variable looks like:
  *     {
  *         "url": "xxxx",
  *         "token": "xxxx",
  *         "channel": "xxxx",
  *     }
  *
  * @return which must be a JSON object. It will be the output of this action.
  *
  */

var request = require('request');

function main(params) {

    // validate parameters
    var errorMsg = validateParams(params);

    if (errorMsg) {
        return { error: errorMsg };
    }

    var requestBody = {
        token: params.token,
        inclusive: true,
    };

    if (params.url === undefined) {
        url = "https://slack.com/api/";
    } else {
        url = params.url;
    }

    if (params.oldest) {
        var date = new Date(params.oldest);
        if (date instanceof Date && !isNaN(date.valueOf())) {
            requestBody.oldest = params.oldest;
        } else {
            errorMsg = "You have specified invalid value in oldest. Please specify a valid timestamp.";
            console.error(errorMsg);
            return { error: errorMsg };
        }
    }

    if (params.latest) {
        var date = new Date(params.latest);
        if (date instanceof Date && !isNaN(date.valueOf())) {
            requestBody.latest = params.latest;
        } else {
            errorMsg = "You have specified invalid value in latest. Please specify a valid timestamp.";
            console.error(errorMsg);
            return { error: errorMsg };
        }
    }

    return promise = new Promise(function (resolve, reject) {
        // retrieve a list of slack channels
        // slack channel history can only be retrieved with channel ID
        // so to get the history, we need to first get the channel ID from name
        request.post({
            url: url + "channels.list",
            formData: requestBody
        }, function (error, response, body) {
            // check if POST returned a failure
            if (error) {
                console.error("Failed to get a list of slack channels");
                console.error(error);
                reject(error);
            // now confirm that HTTP response code is 200
            // HTTP POST request was succesfull but check
            // if the request returned any error in request body
            } else if (response.statusCode == 200 && JSON.parse(body).error) {
                console.error("Failed to get a list of slack channels");
                console.error(body)
                reject(body);
            } else {
                console.log("Successfully retrieve a list of slack channels");
                // console.log(body)
                resolve(JSON.parse(body).channels);
            }
        });
    })
    .then (function (channels) {
        channelFound = false;
        return new Promise(function (resolve, reject) {
            // iterate through all channels to find the channel ID
            channels.forEach(function(channel) {
                if (channel.name == params.channel) {
                    console.log("Channel ID is", channel.id);
                    channelFound = true;
                    resolve(channel.id);
                }
            });
            if (!channelFound) {
                // return failure as the provided channel is not a valid slack channel
                console.error("The channel you provided is not a valid slack channel", params.channel);
                reject();
            }
        });
    })
    .then (function (channelID) {
        return new Promise(function (resolve, reject) {
            requestBody.channel = channelID;
            request.post({
                url: url + "channels.history",
                formData: requestBody
            }, function (error, response, body) {
                // check if POST returned a failure
                if (error) {
                    console.error("Failed to get the slack channel history of ", params.channel);
                    console.error(error);
                    reject({error: error});
                }
                console.log("Successfully retrieved channel history of ", params.channel);
                // console.log(body)
                resolve({messages: JSON.parse(body).messages});
            });
        });
    })
/*    .then (function (messages) {
        messages.forEach(function(message) {
            console.log("message is:");
            console.log(message);
        })
    })
    .then (function () {
        return {message: "done"};
    })*/
    // catch handler
    .catch(function (err) {
        console.error('Error: ', err);
        return {error: err};
    });
}

/**
 *  Checks if all required params are set.
 *  Required parameters are:
 *      token
 *      channel
 */
function validateParams(params) {
    if (params.token === undefined) {
        return ('No token provided, please specify slack token.');
    }
    else if (params.channel === undefined) {
        return ('No channel provided, please specify slack channel.');
    }
    else {
        return undefined;
    }
}

