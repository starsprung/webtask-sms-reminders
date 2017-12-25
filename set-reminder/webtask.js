const formBody = require('body/form');
const { parse, toSeconds } = require('iso8601-duration');
const { MongoClient } = require('mongodb');
const twilio = require('twilio');
const { promisify } = require('util');

const formBodyAsync = promisify(formBody);

module.exports = function (context, req, res) {
  const dbUrl = context.data.DB_URL;

  const body = await(formBodyAsync(req));
  const {From: phoneNumber, Body: smsBody} = body;
  const parsedMessage = parseMessage(smsBody);

  if (parsedMessage.durationMillis > 0) {
    const deliveryDate = new Date(Date.now() + parsedMessage.durationMillis).toISOString();
    
    const client = await MongoClient.connect(dbUrl);
    const db = client.db('reminders');
    const result = await db.collection('reminders').insertOne({
      deliveryDate,
      message: parsedMessage.messageText,
      sent: false
    });
    client.close();

    const response = createResponse(`Reminder will be delivered at ${deliveryDate}`);
    res.writeHead(200, { 'Content-Type': 'text/xml'});
    res.end(response);
  } else {
    const response = createResponse('Err: first token must be a non-zero duration in ISO8601 format, e.g. P1M2D or PT1H30M. ' + 
                                    'See http://bit.ly/2DEJ3UN for details.');
    res.writeHead(200, { 'Content-Type': 'text/xml'});
    res.end(response);
  }
};

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

function createResponse(message) {
  const response = new twilio.twiml.MessagingResponse();
  response.message(message);
  const responseString = response.toString();

  return responseString;
}
