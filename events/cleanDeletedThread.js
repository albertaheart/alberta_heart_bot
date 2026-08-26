const { threadResponseIds } = require('../commands/general/ask');
const { Events } = require('discord.js');
// Creates an event listener to delete entries from the Map "responseThreadIds" in ask.js whenever a thread is deleted
module.exports = {
  name: Events.ThreadDelete,
  execute: (thread) => {
    threadResponseIds.delete(thread.id);
  }
};