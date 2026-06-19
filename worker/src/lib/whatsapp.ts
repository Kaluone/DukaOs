import axios from 'axios'

const GRAPH_URL = 'https://graph.facebook.com/v18.0'
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!

interface TextMessagePayload {
  to: string
  text: string
}

export async function sendWhatsAppText({ to, text }: TextMessagePayload): Promise<{ messageId: string }> {
  const phone = to.replace(/\D/g, '').replace(/^0/, '255')

  const res = await axios.post(
    `${GRAPH_URL}/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { preview_url: false, body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  )

  return { messageId: res.data.messages?.[0]?.id ?? 'unknown' }
}

export async function sendSMSFallback(to: string, text: string): Promise<void> {
  // Placeholder for SMS aggregator (e.g. Africa's Talking, Bonga SMS)
  // Implement when SMS_API_KEY and SMS_SENDER_ID are configured
  const apiKey = process.env.SMS_API_KEY
  if (!apiKey) return

  await axios.post(
    process.env.SMS_API_URL ?? 'https://api.africastalking.com/version1/messaging',
    new URLSearchParams({
      username: process.env.SMS_USERNAME ?? 'sandbox',
      to,
      message: text,
      from: process.env.SMS_SENDER_ID ?? 'DukaOS',
    }),
    {
      headers: {
        apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )
}
