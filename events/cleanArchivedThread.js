const { threadResponseIds } = require('../commands/general/ask');
const { Events } = require('discord.js');
// Creates an event listener to delete entries from the Map "responseThreadIds" in ask.js whenever a archived thread is updated
module.exports = {
  name: Events.ThreadUpdate,      
  execute: (oldThread, newThread) => {
    if (newThread.archived) {
      threadResponseIds.delete(newThread.id);
    }
  },
};