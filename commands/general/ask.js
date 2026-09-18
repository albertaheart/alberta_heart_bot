const { SlashCommandBuilder } = require('discord.js');
const { request } = require('../../util/openai');
const Chat = require('../../models/chat'); 
const crypto = require('crypto');
const MODEL_INPUT_COST_PER_1M_TOKENS = 0.25 / 1000000; // $0.25 per 1M tokens for gpt-5-mini input
const MODEL_OUTPUT_COST_PER_1M_TOKENS = 2.00 / 1000000; // $2.00 per 1M tokens for gpt-5-mini output
const DISCORD_MESSAGE_LIMIT = 1999; // discord rejects anything over 2000, stay one under
const QUESTION_ECHO_LIMIT = 100; // the echoed question can be 2000 chars on its own, dont let it eat the answer

// cut at the last word boundary that fits so we never end mid word
const clamp = (text, max) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
};

// the prompt asks the model to stay under 1800 chars, this makes going over impossible
const formatReply = (question, answer) => {
  const header = 'Question: ' + clamp(question, QUESTION_ECHO_LIMIT) + '\n\n';
  return header + clamp(answer, DISCORD_MESSAGE_LIMIT - header.length);
};

// tracks the last exchange in each thread so the AI can reconstruct the convo
// discord thread ID -> { openaiResponseId, chatId }
const latestExchangeByThread = new Map();

// the map only lives as long as the process, so a restart or a cleanup event makes an ongoing thread look
// brand new. fall back to the newest exchange saved for that thread and pick the conversation back up
const getLatestExchange = async (discordThreadId) => {
  const cached = latestExchangeByThread.get(discordThreadId);
  if (cached) return cached;

  try {
    const lastChat = await Chat.findOne({ discordThreadId }).sort({ createdAt: -1 });
    if (!lastChat?.openaiResponseId) return null;

    const exchange = {
      openaiResponseId: lastChat.openaiResponseId,
      chatId: lastChat.id,
    };
    latestExchangeByThread.set(discordThreadId, exchange); // warm the map so the next question skips the query
    return exchange;
  } catch (error) {
    // a failed lookup just means we lose context, not the answer, so carry on as a new conversation
    console.error('Error looking up thread history:', error);
    return null;
  }
};

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
    let parentExchange = null; // a thread we just made has no history to look up
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
      // get the last exchange in this thread, null if this query is the root
      parentExchange = await getLatestExchange(thread.id);
    }
    const parentOpenaiResponseId = parentExchange ? parentExchange.openaiResponseId : null;
    const parentChatId = parentExchange ? parentExchange.chatId : null;
    // make the request to openai and get the response
    const aiResponse = await request(question, parentOpenaiResponseId);
    // make a new chat document for each question and response
    const chat = new Chat({
      userId: crypto.createHash('sha256').update(interaction.user.id).digest('hex'),
      discordThreadId: thread.id,
      openaiResponseId: aiResponse.id,
      question: question,
      response: aiResponse.output_text,
      parentChatId: parentChatId,
      parentOpenaiResponseId: parentOpenaiResponseId
    });
    console.log('PARENT EXCHANGE: ', parentExchange);

    // save the chat document to the database
    let savedChat = null;
    try {
      savedChat = await chat.save();
      console.log(savedChat);
    } catch (error) {
      console.error('Error saving chat to database:', error);
    }
      
    console.log(aiResponse);
    console.log('Used tokens:', aiResponse.usage.total_tokens);
    console.log('Total cost: $', 
      ((MODEL_INPUT_COST_PER_1M_TOKENS * aiResponse.usage.input_tokens) 
                + (MODEL_OUTPUT_COST_PER_1M_TOKENS * aiResponse.usage.output_tokens))
        .toFixed(6));

    latestExchangeByThread.set(thread.id, {
      openaiResponseId: aiResponse.id,
      chatId: savedChat ? savedChat.id : null,
    });
    if (!interaction.channel.isThread()){
      await interaction.editReply('Conversation started in the attached thread!');
      await thread.send(formatReply(question, aiResponse.output_text));
    }
    else{
      await interaction.editReply(formatReply(question, aiResponse.output_text));
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
  latestExchangeByThread
};