

const {Events, ActivityType} = require('discord.js');

const readyEvent = (client) => {
  client.user.setActivity('Use /ask for AB Heart help', { type: ActivityType.Watching });
  console.log(`Ready! Logged in as ${client.user.tag}`);
};

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute: readyEvent,
};