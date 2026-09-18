const { latestExchangeByThread } = require('../commands/general/ask');
const { Events } = require('discord.js');
// Creates an event listener to delete entries from the Map "latestExchangeByThread" in ask.js whenever a archived thread is updated
module.exports = {
  name: Events.ThreadUpdate,
  execute: (oldThread, newThread) => {
    if (newThread.archived) {
      latestExchangeByThread.delete(newThread.id);
    }
  },
};