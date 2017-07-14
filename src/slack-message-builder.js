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
  * This is the action to format slack messages for:
  *     replace user ID with username for readability purposes
  *     replace Unix epoch timestamp with human readable date and time format
  *     group parent messages and replies together
  *
  * This action is part of Slack Chat Bot application, which is documented here:
  * https://cwiki.apache.org/confluence/display/OPENWHISK/Slack+Chat+Bot+for+OpenWhisk+Dev+List
  *
  * This action is invoked by another action "retrieve-slack-history" and not
  * meant for stand alone invocation.
  *
  * main() will be invoked when you run this action.
  *
  * @param whisk actions accept a single parameter,
  *        which must be a JSON object with following keys.
  *
  * @param {string} url     - Slack webhook url
  * @param {string} token   - Slack token
  * @param {string} messages - Slack messages 
  *
  * In this case, the params variable looks like:
  *     {
  *         "url":      "xxxx",
  *         "token":    "xxxx",
  *         "channel":  "xxxx",
  *         "messages": [
  *             {
  *                 "text": "xxxx",
  *                 "ts":   "xxxx",
  *                 "type": "xxxx",
  *                 "user": "xxxx"
  *             },
  *             ...
  *         ]
  *     }
  *
  * @return which must be a JSON object. It will be the output of this action.
  *
  */

var request = require('request');
var moment = require("moment");

function main(params) {

    // validate parameters
    var errorMsg = validateParams(params);

    if (errorMsg) {
        return { error: errorMsg };
    }

    var requestBody = {
        token: params.token,
    };

    if (params.url === undefined) {
        url = "https://slack.com/api/";
    } else {
        url = params.url;
    }

    var messages = params.messages;
    // slack history contains newest messages first which is not really
    // readable, imaging reading reply from someone first before reading
    // a question/concern therefore reverse the list of messages to send 
    // oldest to newest conversation
    messages.reverse();

    // maintain users map with user id to username
    var usersMap = {};
    // var emailMessage = "\n\n";
    var emailMessage = "<html><head></head><body>";

    var subject = "OpenWhisk Slack Daily Digest - Channel #" + params.channel
    subject += " - " + moment().format("MMM Do YYYY")

    return promise = new Promise(function (resolve, reject) {
        // retrieve a list of slack users 
        // slack messages contain user ID which is not human readable
        // so we are going to replace user ID with username
        // a slack message can have user ID in two places:
        // (1) in user field {user: XYZ} (2) in text "thank you <@XYZ> .." 
        request.post({
            url: url + "users.list",
            formData: requestBody
        }, function (error, response, body) {
            // check if POST returned a failure
            if (error) {
                console.error("Failed to get a list of slack users");
                console.error(error);
                reject(error);
            // now confirm that HTTP response code is 200
            // HTTP POST request was succesfull but check
            // if the request returned any error in request body
            } else if (response.statusCode == 200 && JSON.parse(body).error) {
                console.error("Failed to get a list of slack users");
                console.error(body)
                reject(body);
            } else {
                console.log("Successfully retrieved a list of slack users");
                // console.log(body)
                resolve(JSON.parse(body).members);
            }
        });
    })
    .then (function (users) {
        return new Promise(function (resolve, reject) {
            // iterate through all the users to build a map of user ID and username
            // console.log("users list", users);
            users.forEach(function(user) {
                console.log("user ID is", user.id)
                var userID = user.id;
                usersMap[userID] = user.name;
            });
            console.log("Finished creating users map with user ID and username");
            //console.log(usersMap);

            // update messages to replace user ID with username in user field
            // and text
            messages.forEach(function(message) {
                // replace user ID in message.user
                var userID = message.user;
                message.user = usersMap[userID];
                // now replace user ID in slack messages
                // message text has user ID in the form of "<@XYZ>"
                var text = message.text;
                var re = new RegExp('<\@(.*)>');
                var r = text.match(re);
                if (r) {
                    userID = r[1];
                    if (usersMap[userID]) {
                        text = text.replace(userID, usersMap[userID]);
                        message.text = text;
                    }
                }
            }); 
            // return success
            resolve(messages);
        });
    })
    .then (function (messages) {
        return new Promise(function (resolve, reject) {
            messages.forEach(function(message) {
                if (message["type"] === "message") {
                    // ignore message if it has a subtype of "channel_join" or
                    // it has a subtype of "channel_leave"
                    // we want to limit the kind of messages goes into a daily digest
                    if (message["subtype"]) {
                        if (message["subtype"] === "channel_join" ||
                                message["subtype"] === "channel_leave")
                        {
                            return;
                        }
                    }
                    // identify whether you are dealing with threaded messages
                    // any message with thread_ts attribute is part of a thread
                    // find out number of replies
                    if (message.thread_ts) {
                        // this threaded message is a parent as its
                        // ts and threaded_ts are equal
                        if (message.thread_ts === message.ts) {
                            // compose a message of the parent of a thread
                            emailMessage += "<p><br>"
                            emailMessage += new Date(message.ts * 1000);
                            emailMessage += " <b>" + message.user + "</b>: ";
                            emailMessage += message.text;
                            emailMessage += "</p>"
                            emailMessage += "<p>This thread has " + message.reply_count + " replies.</p>";
                            // iterate through all the messages to find out its children 
                            // children are replies with thread_ts equal to parent's ts
                            messages.forEach(function(replyText) {
                                // since we are iterating over the list of messages again,
                                // we might encounter the parent of a thread which is
                                // already addressed so we have to ignore it
                                if (replyText.ts === message.ts) {
                                    return;
                                } else if (replyText.thread_ts === message.ts) {
                                    emailMessage += "<p>REPLY:<br>"
                                    emailMessage += new Date(replyText.ts * 1000);
                                    emailMessage += " <b>" + replyText.user + "</b>: ";
                                    emailMessage += replyText.text;
                                    emailMessage += "</p>"              
                                }
                            })
                        } else {
                            // the message is a reply and part of thread but
                            // we already included in our email body so ignore it now
                            return;
                        }
                    } else {
                        emailMessage += "<p><br>"
                        emailMessage += new Date(message.ts * 1000);
                        emailMessage += " <b>" + message.user + "</b>: ";
                        emailMessage += message.text;
                        emailMessage += "</p>"
                    }
                }
            })
            emailMessage += "</body></html>";
            resolve(emailMessage);
        });
    })
    .then (function (emailMessage) {
        return {text: emailMessage, subject: subject};
    })
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
 *      messages 
 */
function validateParams(params) {
    if (params.token === undefined) {
        return ('No token provided, please specify slack token.');
    }
    else if (params.channel === undefined) {
        return ('No channel provided, please specify slack channel.')
    }
    else if (params.messages === undefined) {
        return ('No messages are provided, please specify slack history messages.');
    }
    else {
        return undefined;
    }
}

