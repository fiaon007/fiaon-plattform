import Retell from 'retell-sdk';

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || 'key_7febe5c6d13ec377587f37b5f754',
});

export const retell = {
  async createCall(phoneNumber: string) {
    return await retellClient.call.createPhoneCall({
      from_number: process.env.RETELL_PHONE_NUMBER || '+41445054333',
      to_number: phoneNumber,
      override_agent_id: process.env.RETELL_AGENT_ID || 'agent_757a5e73525f25b5822586e026',
    });
  },

  async getCall(callId: string) {
    return await retellClient.call.retrieve(callId);
  },

  async listCalls() {
    return await retellClient.call.list();
  }
};

export default retell;
