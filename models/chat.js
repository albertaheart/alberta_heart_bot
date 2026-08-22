const mongoose = require('mongoose');

// allows flexible queurying
mongoose.set('strictQuery', false);

// get meta data for each question and response, and store in a document with the user id, timestamp, the parent mongo object ID, and the parent thread ID for each message
const chatSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true 
  },
  question: { 
    type: String, 
    required: true 
  },
  response: {
    type: String,
    required: true
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  parentObjectId: {
    type: String,
    ref: 'Chat'
  },
  parentThreadId: {
    type: String,
  }
}, { timestamps: true });

// transform the returned object to include an id field instead of _id, and remove __v
chatSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('Chat', chatSchema);