# Slack Chat Bot for OpenWhisk Dev List

The Slack Chat Bot is a serverless, event-driven bot designed using the OpenWhisk open source project.

This bot is designed to post [slack](https://openwhisk-team.slack.com/messages) messages to OpenWhisk dev list (dev@openwhisk.incubator.apache.org) on a daily basis so that OpenWhisk developers receives a daily digest of conversation, one digest per slack channel. A daily digest will bring one whole day worth of updates in a single email on dev list and are archived on dev list for reference purposes. A daily digest contains filtered and formatted slack messages in easy to read and searchable format. The messages like someone joining a channel or leaving the channel, status updates, etc are filtered to create a meaningful and concise digest.

## Proposed Architecture

The Slack Chat Bot is designed with a sequence of three dependent actions (like microservices) which is invoked by an internal OpenWhisk alarm trigger (similar to a cron job). Here is what action sequence does with its triggered flow.

### Invoked once a day by an Alarm Trigger
 
The sequence of actions is invoked by Alarm trigger, which then starts a chain of microservices to retrieve slack history, filter and format the slack history, and compose email message which is sent to OpenWhisk dev list.

* **Retrieve Slack History** - An action that is invoked every 24 hours with OpenWhisk slack domain and a particular channel, retrieves a bunch of messages and sends them to next action in sequence:

```
{
     "type": "message",
     "user": "XYZ",
     "text": "Did my email about Slack made it to the dev list?",
     "ts": "1484957540.000002"
 },
```

* **Format Slack History** -  An action invoked by _retrieve slack history_ action. It takes a list of slack messages and runs them through a filtration system to drop messages with "subtype" of "channel_join" and "subtype" of "channel_leave". It then runs messages through message builder for basic formatting such as replacing user ID with user name and some advanced restructuring of messages including grouping parent messages and replies together.
 
* **Send Email to Dev List** - An action invoked by _format slack history_ action, receives formatted slack messages and sends email to dev list.


![Slack Chat Bot](https://github.com/pritidesai/slack-chat-bot/blob/master/docs/images/slack-chat-bot.png "Slack Chat Bot")
