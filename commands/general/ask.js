const { SlashCommandBuilder } = require('discord.js');
const { request } = require('../../util/openai');
const Chat = require('../../models/chat'); 
const crypto = require('crypto');
const MODEL_INPUT_COST_PER_1M_TOKENS = 0.25 / 1000000; // $0.25 per 1M tokens for gpt-5-mini input
const MODEL_OUTPUT_COST_PER_1M_TOKENS = 2.00 / 1000000; // $2.00 per 1M tokens for gpt-5-mini output

// each response ID builds and tracks the previously used ID, this lets AI reconstruct the convo
const threadResponseIds = new Map(); // threadId -> latest response ID

// command data for the ask command
const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask the Alberta Heart Bot a question!')
  .addStringOption(option =>
    option
      .setName('question')
      .setDescription('The question you want to ask')
      .setRequired(true)
      .setMaxLength(2000)
  );

// function that runs when the command is called
const askCommand = async (interaction) => {
  // lets us edit the response because openai takes arbitrary time
  await interaction.deferReply();

  try {
    let thread;
    const question = interaction.options.getString('question');

    // if command was used in a thread, respond in that thread, otherwise make a thread
    if (!interaction.channel.isThread()){
      // fetch the starting message, create a thread and anchor the thread to it
      const anchorMessage = await interaction.fetchReply();
      thread = await interaction.channel.threads.create({
        name: question.slice(0, 50),
        startMessage: anchorMessage,
        autoArchiveDuration: 60,
      });
    }
    else {
      thread = interaction.channel; // already in a thread, just use it
    }
    // get the ids of the parent response, null if this query is the root
    const previousResponseIds = threadResponseIds.get(thread.id) ?? null;
    const parentResponseId = previousResponseIds ? previousResponseIds.responseId : null;
    const parentDbObjectId = previousResponseIds ? previousResponseIds.chatObjectId : null;
    console.log('PREVIOUS RESPONSE ID: ', previousResponseIds);
    // make the request to openai and get the response
    const aiResponse = await request(question, parentResponseId);
    // make a new chat document for each question and response
    const chat = new Chat({
      userId: crypto.createHash('sha256').update(interaction.user.id).digest('hex'),
      question: question,
      response: aiResponse.output_text,
      parentObjectId: parentDbObjectId,
      parentThreadId: parentResponseId
    });

    // save the chat document to the database
    let dbResponse = null;
    try {
      dbResponse = await chat.save();
      console.log(dbResponse);
    } catch (error) {
      console.error('Error saving chat to database:', error);
    }
      
    console.log(aiResponse);
    console.log('Used tokens:', aiResponse.usage.total_tokens);
    console.log('Total cost: $', 
      ((MODEL_INPUT_COST_PER_1M_TOKENS * aiResponse.usage.input_tokens) 
                + (MODEL_OUTPUT_COST_PER_1M_TOKENS * aiResponse.usage.output_tokens))
        .toFixed(6));

    threadResponseIds.set(thread.id, {
      responseId: aiResponse.id,
      chatObjectId: dbResponse ? dbResponse.id : null,
    });
    if (!interaction.channel.isThread()){
      await interaction.editReply('Conversation started in the attached thread!');
      await thread.send('Question: ' + question + '\n\n' + aiResponse.output_text);
    }
    else{
      await interaction.editReply('Question: ' + question + '\n\n' + aiResponse.output_text);
    }
  } catch (error) {
    // log the error and inform the user
    console.error('openai error: ', error);
    await interaction.editReply('Sorry, there was an error processing your request.');
  }
};

module.exports = {
  data,
  execute: askCommand,
  threadResponseIds
};