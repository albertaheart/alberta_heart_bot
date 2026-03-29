const { threadResponseIds } = require('../commands/general/ask');
const { Events } = require('discord.js')

module.exports = {
  name: Events.ThreadDelete,
  execute: (thread) => {
    threadResponseIds.delete(thread.id);
  }
};