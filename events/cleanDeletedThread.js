const { latestExchangeByThread } = require('../commands/general/ask');
const { Events } = require('discord.js');
// Creates an event listener to delete entries from the Map "latestExchangeByThread" in ask.js whenever a thread is deleted
module.exports = {
  name: Events.ThreadDelete,
  execute: (thread) => {
    latestExchangeByThread.delete(thread.id);
  }
};