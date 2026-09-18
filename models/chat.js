const mongoose = require('mongoose');

// allows flexible queurying
mongoose.set('strictQuery', false);

// one document per question and response, with the metadata needed to rebuild the conversation chain
const chatSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  // the discord thread this exchange happened in, lets us rebuild the chain after the in memory map is gone
  discordThreadId: {
    type: String
  },
  // this exchange's own openai response ID, the next question in the thread continues from it
  openaiResponseId: {
    type: String
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
  // the mongo _id of the exchange this one answers, keeps the real chain even if two people ask at once
  parentChatId: {
    type: String,
    ref: 'Chat'
  },
  // the openai response ID this exchange continued from, ie the parent's openaiResponseId
  parentOpenaiResponseId: {
    type: String,
  }
}, { timestamps: true });

// index the filter and the sort key together so lookups of a thread's newest exchanges skip the scan
chatSchema.index({ discordThreadId: 1, createdAt: -1 });

// transform the returned object to include an id field instead of _id, and remove __v
chatSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('Chat', chatSchema);