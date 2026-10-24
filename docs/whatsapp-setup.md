# WhatsApp Business Cloud API setup

Kisan Sahayak works without WhatsApp: farmer chats stay in the portal and show a "Demo conversation" chip. Once the variables below are set, the assistant's replies and offer cards also go out over WhatsApp. Messages that farmers send on WhatsApp come into the same conversation.

## 1. Meta app and phone number

1. Go to developers.facebook.com, choose **Create app**, then **Business**, and add the **WhatsApp** product.
2. In **WhatsApp → API Setup**, copy the **Phone number ID**. You can use Meta's test number, or register your own business number.
3. While the app is in development, add the farmers' numbers as **test recipients**. Only those numbers can receive messages.
4. Create a **permanent access token**: in Business Settings, add a System User, give it the `whatsapp_business_messaging` and `whatsapp_business_management` permissions, and generate a token. The temporary token on the API Setup page expires after 24 hours.
5. In **App settings → Basic**, copy the **App secret**.

## 2. Environment variables (server-only)

| Variable | Value |
|---|---|
| `WHATSAPP_TOKEN` | Permanent system-user access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID from API Setup |
| `WHATSAPP_VERIFY_TOKEN` | Any random string you choose; you enter the same string in Meta |
| `WHATSAPP_APP_SECRET` | App secret, used to check `X-Hub-Signature-256` |
| `WHATSAPP_API_VERSION` | Optional. Graph API version; the default is `v23.0` |

Never put any of these in `NEXT_PUBLIC_*` variables.

## 3. Webhook

1. In **WhatsApp → Configuration → Webhook**, set:
   - **Callback URL:** `https://<your-host>/api/webhooks/whatsapp`
   - **Verify token:** the value of `WHATSAPP_VERIFY_TOKEN`
2. Click **Verify and save**. Meta sends a `GET` request with `hub.mode`, `hub.verify_token` and `hub.challenge`, and the app echoes the challenge back.
3. Under **Webhook fields**, subscribe to **`messages`**. This one field carries both inbound messages and delivery and read statuses.

## How it works

- **Signature check.** Every `POST` is checked with HMAC-SHA256 over the raw body using the app secret, compared in constant time. If the signature is bad you get `401`. If `WHATSAPP_APP_SECRET` isn't set you get `503`.
- **Fast acknowledgement.** The webhook returns `200` straight away. Processing runs afterwards through `after()`.
- **Matching the farmer.** The sender's phone number (digits only) is matched to `Farmer.phone`. Numbers that don't match any farmer are audited as `whatsapp.unknown_sender` and get no reply.
- **What happens to each message type:**
  - **text:** goes to the assistant, and the reply is sent back over WhatsApp.
  - **image:** downloaded through the Graph media API, then sent to crop-photo analysis.
  - **audio:** downloaded, then goes through the voice pipeline (speech-to-text, then the assistant).
- **Delivery statuses.** `sent`, `delivered`, `read` and `failed` update `Message.status`. A status never moves backwards.
- **Duplicates.** Every message ID and status event is recorded in `WebhookEvent` (provider `whatsapp`). When Meta retries the same event, it's skipped. If processing fails, the record is released so the next retry can try again.

## Testing locally

1. Run `npm run dev`. Then expose the dev server with a tunnel, for example `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`.
2. Use the tunnel URL as the callback URL.
3. Message the business number from a farmer's phone that matches a seeded farmer (for example Ramesh, `919800000001`), or edit a farmer's phone number to your own.
4. Automated tests (`tests/integration/whatsapp.test.ts`) cover:
   - verification
   - signature rejection
   - the text → reply round trip with a mocked Graph API
   - duplicate deliveries
   - status ordering
   - unknown senders

## Verified vs not verified

- **Verified by automated tests with a mocked Graph API:** signature check, verification handshake, duplicate handling, status updates, and the inbound text flow end to end.
- **Not verified against Meta** (no credentials were available):
  - real sends
  - media download URLs
  - the default Graph version (`v23.0`)

  The request shapes follow the documented Cloud API (`POST /{phone-number-id}/messages`, `GET /{media-id}` then a GET with a bearer token). Check them once with real credentials.
- **Free-form text limit.** Free-form text can only be sent within 24 hours of the farmer's last message. Messages that start the conversation, such as offer cards to farmers who haven't written recently, need an approved **message template**. Templates aren't implemented yet.
