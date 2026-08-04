const { threadResponseIds } = require('../commands/general/ask');
const { Events } = require('discord.js');

module.exports = {
  name: Events.ThreadUpdate,      
  execute: (oldThread, newThread) => {
    if (newThread.archived) {
      threadResponseIds.delete(newThread.id);
    }
  },
};