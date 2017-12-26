const formBody = require('body/form');
const { parse, toSeconds } = require('iso8601-duration');
const { MongoClient } = require('mongodb');
const twilio = require('twilio');
const { promisify } = require('util');

const formBodyAsync = promisify(formBody);

module.exports = handleRequest;
  
async function handleRequest(context, req, res) {
  const dbUrl = context.secrets.DB_URL;

  const body = await(formBodyAsync(req));
  const {From: phoneNumber, Body: smsBody} = body;
  const parsedMessage = parseMessage(smsBody);

  if (parsedMessage.durationMillis > 0) {
    const deliveryDate = new Date(Date.now() + parsedMessage.durationMillis);
    
    try {
      await saveReminder(dbUrl, deliveryDate, parsedMessage.messageText);

      sendResponse(res, `Reminder will be delivered at ${deliveryDate.toISOString()}.`);
    } catch (e) {
      console.log(e);

      sendResponse(res, 'Err: something went wrong, try again later.');
    }
  } else {
    sendResponse(res, 'Err: first token must be a non-zero duration in ISO8601 format, e.g. P1M2D or PT1H30M. ' + 
                 'See http://bit.ly/2DEJ3UN for details.');
  }
}

function parseMessage(message) {
  const [duration, ...tail] = message.split(' ');
  let durationMillis = 0;
  try {
    durationMillis = toSeconds(parse(duration.toUpperCase())) * 1000;
  } catch (e) {
    console.log(e);
  }

  const messageText = tail.join(' ');

  return {
    durationMillis,
    messageText
  };
}

async function saveReminder(dbUrl, deliveryDate, message) {
  const client = await MongoClient.connect(dbUrl);
  //TODO: extract hardcoded values
  const db = client.db('reminders');
  const collection = db.collection('reminders');

  await collection.insertOne({
    deliveryDate,
    message,
    sent: false
  });

  client.close();
}

function createTwiml(message) {
  const response = new twilio.twiml.MessagingResponse();
  response.message(message);
  const responseString = response.toString();

  return responseString;
}

function sendResponse(res, message) {
  const response = createTwiml(message);
  res.writeHead(200, { 'Content-Type': 'text/xml'});
  res.end(response);
}
