/**
 * DocuSign Connect webhook handler
 * ----------------------------------------------------------------
 * DocuSign Connect (configured once in the Admin console, or via the
 * eventNotification block on the envelope itself) POSTs a JSON payload
 * to this endpoint whenever a subscribed envelope changes status —
 * sent, delivered, completed, declined, voided.
 *
 * On "completed", we download the signed PDF and attach it to the
 * originating Job's Diary in ServiceM8, using the servicem8_job_uuid
 * custom field we set when the envelope was created.
 */

const { SM8_API_KEY, DOCUSIGN_BASE_URL, DOCUSIGN_ACCOUNT_ID } = process.env;

exports.handleDocuSignConnect = async function (req, res) {
  // Acknowledge immediately — DocuSign retries if it doesn't get a fast 200.
  res.status(200).send("OK");

  const event = req.body; // JSON eventNotification payload
  const status = event?.data?.envelopeSummary?.status;
  const envelopeId = event?.data?.envelopeId;
  const customFields = event?.data?.envelopeSummary?.customFields?.textCustomFields || [];
  const jobUUID = customFields.find((f) => f.name === "servicem8_job_uuid")?.value;

  if (!jobUUID) return; // not one of ours, or field missing — ignore

  if (status === "completed") {
    await attachSignedDocument(jobUUID, envelopeId);
    await writeJobNote(jobUUID, `Signed document received back from DocuSign (envelope ${envelopeId}).`);
  } else if (status === "declined" || status === "voided") {
    await writeJobNote(jobUUID, `DocuSign envelope ${envelopeId} was ${status} — signature not obtained.`);
  }
};

async function attachSignedDocument(jobUUID, envelopeId) {
  const accessToken = await getDocuSignAccessToken(); // reuse from send-envelope-handler.js

  // Combined PDF (contract + signing certificate) — documentId "combined"
  const docRes = await fetch(
    `${DOCUSIGN_BASE_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes/${envelopeId}/documents/combined`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const pdfBuffer = Buffer.from(await docRes.arrayBuffer());

  // ServiceM8 attachment flow: create the attachment record, then PUT the bytes
  const createRes = await fetch("https://api.servicem8.com/api_1.0/Attachment.json", {
    method: "POST",
    headers: { Authorization: `Bearer ${SM8_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      related_object: "job",
      related_object_uuid: jobUUID,
      attachment_name: `Signed-Agreement-${envelopeId}.pdf`,
      file_type: ".pdf",
    }),
  });
  const location = createRes.headers.get("x-record-uuid") || (await createRes.json()).uuid;

  await fetch(`https://api.servicem8.com/api_1.0/Attachment/${location}.file`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SM8_API_KEY}`, "Content-Type": "application/pdf" },
    body: pdfBuffer,
  });
}

async function writeJobNote(jobUUID, text) {
  await fetch("https://api.servicem8.com/api_1.0/note.json", {
    method: "POST",
    headers: { Authorization: `Bearer ${SM8_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ related_object: "job", related_object_uuid: jobUUID, note: text }),
  });
}
