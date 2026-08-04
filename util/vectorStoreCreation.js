require('dotenv').config();
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.CHATGPT_API_KEY,
});

const main = async () => {
  const date = new Intl.DateTimeFormat('en-CA').format(new Date());

  const vs = await openai.vectorStores.create({
    name: 'ABH Info 1.2',
    description: `Contains all Alberta Heart Bot information, created on ${date}.`
  });

  console.log(vs);
};

main();