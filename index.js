const express = require('express');
const bodyParser = require('body-parser');
const { WebClient } = require('@slack/web-api');
const axios = require('axios');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// Salesforce Auth
async function authenticateSalesforce() {
  const res = await axios.post('https://login.salesforce.com/services/oauth2/token', null, {
    params: {
      grant_type: 'password',
      client_id: process.env.SF_CLIENT_ID,
      client_secret: process.env.SF_CLIENT_SECRET,
      username: process.env.SF_USERNAME,
      password: process.env.SF_PASSWORD + process.env.SF_SECURITY_TOKEN,
    },
  });
  return res.data.access_token;
}

async function updateSalesforce(name, email) {
  const token = await authenticateSalesforce();
  await axios.post(
    `${process.env.SF_INSTANCE_URL}/services/data/v52.0/sobjects/Lead`, // or Contact
    {
      FirstName: name.split(' ')[0],
      LastName: name.split(' ')[1] || 'Unknown',
      Email: email,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

app.post('/slack/update', async (req, res) => {
  const { user_id, text } = req.body;
  const [name, email] = text.split(',').map(s => s.trim());

  try {
    await updateSalesforce(name, email);
    await slackClient.chat.postMessage({
      channel: user_id,
      text: `✅ Info updated in Salesforce: *${name}*, *${email}*`,
    });
  } catch (error) {
    await slackClient.chat.postMessage({
      channel: user_id,
      text: `❌ Failed to update Salesforce: ${error.message}`,
    });
  }

  res.status(200).send();
});

app.listen(3000, () => console.log('Slack bot running on port 3000'));
