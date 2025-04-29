import request from "request"
import { addLog } from "@/helper/functions"
import logConstants from "@/constants/log"

async function sendWhatsappMessageWithContent(
  phoneNumber,
  message,
  replaceLineBreak = false
) {
  try {
    var finalphonenumber = phoneNumber.replace(/^\+/, "")
    if (replaceLineBreak) {
      message = message.replaceAll(`\n`, "\r")
    }
    console.log(message, "message")
    var options = {
      method: "POST",
      url: `https://graph.facebook.com/${process.env.FB_API_VERSION}/${process.env.FB_WHATSAPP_PHONE_NUMBER_ID}/messages`,
      headers: {
        Authorization: `Bearer ${process.env.FB_WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        // { "messaging_product": "whatsapp", "to": finalphonenumber, "type": "template", "template": { "name": "aircity_message_with_content", "language": { "code": "en" } , "components": [ { "type": "body", "parameters": [ { "type": "text", "text": message } ] } ] }}
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: finalphonenumber,
          type: "template",
          template: {
            name: "mtc_content_messages",
            language: {
              code: "en_GB",
            },
            components: [
              {
                type: "header",
                parameters: [],
              },
              { type: "body", parameters: [{ type: "text", text: message }] },
            ],
          },
        }
      ),
    }

    request(options, function (error, response) {
      if (error) {
        console.log("fail")
        addLog(
          null,
          null,
          "whatsapp",
          null,
          logConstants.REQUEST_SEND_WHATSAPP_SMS,
          "Whatsapp send SMS failed: " + error?.message
        )
        return
      } else {
        console.log("done")
        console.log(response.body)
        addLog(
          null,
          null,
          "whatsapp",
          null,
          logConstants.REQUEST_SEND_WHATSAPP_SMS,
          "Request send whatsapp SMS success.",
          response.body
        )
        return
      }
    })
  } catch (error) {
    console.log(error)
    addLog(
      null,
      null,
      "whatsapp",
      null,
      logConstants.REQUEST_SEND_WHATSAPP_SMS,
      "Whatsapp send SMS failed: " + error?.message
    )
  }
}

export default {
  sendWhatsappMessageWithContent,
}
