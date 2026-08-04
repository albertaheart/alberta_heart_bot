const { Events, MessageFlags } = require('discord.js');
const abhServerChannel = '1418946574737866933';
const testServerChannel = '1452078412280889523';
const allowedChannel = [abhServerChannel, testServerChannel]; // channel IDs where commands are allowed

const interactionCreateEvent = async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // gets the command from the collection, and if it doesnt exist, logs an error
  const command = interaction.client.commands.get(interaction.commandName);

  const isAllowedChannel = allowedChannel.includes(interaction.channelId);
  const isAllowedThread = interaction.channel.isThread() && allowedChannel.includes(interaction.channel.parentId);;

  // if the command isnt used in the allowed channel, reply with a message and return
  if (!isAllowedChannel && !isAllowedThread) {
    interaction.reply({
      content: `Please use commands in <#${allowedChannel}>.`,
      ephemeral: true,
    });
    return;
  }

  // if no command found, log an error
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error while executing this command!',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};

module.exports = {
  name: Events.InteractionCreate,
  execute: interactionCreateEvent,
};