# Copyright 2015-2016 IBM Corporation
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# This is the action to send an email with slack history to OpenWhisk dev list.
# This is the last action in a sequence of three actions.
# Details are on cwiki:
# https://cwiki.apache.org/confluence/display/OPENWHISK/Slack+Chat+Bot+for+OpenWhisk+Dev+List
#
# main() will be invoked when you run this action.
#
# @param whisk actions accept a single parameter,
#        which must be a JSON object with following keys.
#
# @param {string} gmail_user        - gmail username
# @param {string} gmail_password    - gmail password
# @param {string} from              - email address of sender
# @param {string} recipient         - email address of receiver
# @param {string} subject           - Subject of the email
# @parm  {string} text              - email message
#
# In this case, the params variable looks like:
#     {
#         "gmail_user":     "xxxx",
#         "gmail_password": "xxxx",
#         "from":           "xxxx",
#         "recipient":      "xxxx",
#         "subject":        "xxxx",
#         "text":           "xxxx",
#     }
#
# @return which must be a JSON object. It will be the output of this action.

import sys

def main(args):

    gmail_user = args.get("gmail_user")
    gmail_password = args.get("gmail_password")
    FROM = args.get("from")
    recipient = args.get("recipient")
    to = recipient if type(recipient) is list else [recipient]
    subject = args.get("subject")
    text = args.get("text")
    
#    print (gmail_user)
#    print (gmail_password)
#    print (FROM)
#    print (recipient)
#    print (to)
#    print (subject)
#    print (text)

    # Import smtplib for the actual sending function
    import smtplib
    import socket
    # Import the email modules we'll need
    from email.mime.text import MIMEText

    # Prepare actual message
    msg = MIMEText(text, 'html', "utf-8")
#    msg = MIMEText(text, _charset="UTF-8")
    msg['From'] = FROM
    msg['To'] = ", ".join(to)
    msg['Subject'] = subject

    server = smtplib.SMTP("smtp.gmail.com", 587)
    
    try:
        server.ehlo()
        server.starttls()
        server.ehlo()
    except:
        print ('!! Could not connect to email host! Check internet connection! !!')
        return {error: "could not connect"}
    else:
        print('>> Connected to email host! Attempting secure login via SMTP...')
        try:
            server.login(gmail_user, gmail_password)
        except:
            print('!! Could not secure connection! Stopping! !!')
            return {error: "could not secure connection"}
        else:
            print ('>> Login succeeded! Attempting to send message...')
            try:
                server.sendmail(FROM, to, msg.as_string())
            except TypeError as e:
                print e
                print('Error!:', sys.exc_info()[0])
                print('!! Could not send message! Check internet connection! !!')
                return {error: "could not send message"}
            else:
                server.quit()
                print 'successfully sent the mail'
                return {'result':'done'}

#    except socket.error as e:
#        logging.error ("Could not connect to server - is it listening / up?")
#    except smtplib.SMTPException:
#        print('Error')
#    except:
#        print "Unknown error:", sys.exc_info()[0]
#    finally:
#        if server != None:
#            server.quit()
