const { MongoClient } = require('mongodb');
const twilio = require('twilio');

module.exports = handleRequest;

async function handleRequest(context, cb) {
  const {
    DB_URL: dbUrl,
    TWILIO_SID: twilioSid,
    TWILIO_AUTH_TOKEN: twilioAuthToken,
    TWILIO_PHONE_NUMBER: twilioPhoneNumber
  } = context.secrets;

  const collection = await getDbCollection(dbUrl);
  const reminders = await getReminders(collection);

  for (const reminder of reminders) {
    try {
      await sendReminder(reminder, twilioPhoneNumber, twilioSid, twilioAuthToken);
      await markReminderSent(collection, reminder);
    } catch(e) {
      console.log(e);
    }
  }

  cb(null, 'Done');
}

async function getDbCollection(dbUrl) {
  const mongoClient = await MongoClient.connect(dbUrl);
  const db = mongoClient.db('reminders');
  const collection = db.collection('reminders');
  
  return collection;
}

async function getReminders(collection) {
  const reminders = await collection.find({
    deliveryDate: {
      $lte: new Date()
     },
    sent: false
  });
  
  return reminders.toArray();
}

async function markReminderSent(collection, reminder) {
  return collection.update({
    _id: reminder._id
  },
  {
    $set: {
      sent: true
    }
  });
}

async function sendReminder(reminder, fromPhone, sid, authToken) {
  const client = twilio(sid, authToken);

  const result = await client.messages.create({
    body: reminder.message,
    to: reminder.phoneNumber,
    from: fromPhone,
  });

  return result;
}
