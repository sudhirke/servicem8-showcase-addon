/**
 * ServiceM8 "Send for Signature" Add-on — envelope send handler
 * ----------------------------------------------------------------
 * Flow:
 *  1. Mark/an engineer clicks "Send for Signature" on a Job card.
 *  2. ServiceM8 POSTs a signed JWT to this endpoint (action callback),
 *     identifying the job + company that triggered it.
 *  3. We fetch the Job and Client from the ServiceM8 API.
 *  4. We create + send a DocuSign envelope from a pre-built template,
 *     pre-filling tabs with job address / description / value.
 *  5. We write a Note back to the Job Diary and return a small
 *     confirmation page to the modal ServiceM8 opened.
 *
 * Auth model: DocuSign JWT Grant (server-to-server). One-time admin
 * consent is required per DocuSign account before this will work —
 * see the "One-time setup" note at the bottom of this file.
 */

const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const {
  SM8_APP_SECRET,               // ServiceM8 Add-on App Secret (verifies inbound action JWT)
  SM8_API_KEY,                  // ServiceM8 API key/OAuth token for our own calls back to ServiceM8
  DOCUSIGN_INTEGRATION_KEY,     // DocuSign Integration Key (client_id)
  DOCUSIGN_USER_ID,             // GUID of the DocuSign user the envelope is sent "as"
  DOCUSIGN_ACCOUNT_ID,          // DocuSign API Account ID
  DOCUSIGN_RSA_PRIVATE_KEY,     // RSA private key registered against the Integration Key
  DOCUSIGN_TEMPLATE_ID,         // Template ID for the job sign-off document
  DOCUSIGN_BASE_URL = "https://na3.docusign.net/restapi", // per-account base URI (fetched at auth time in production)
  DOCUSIGN_AUTH_SERVER = "account.docusign.com",
} = process.env;

// ---------------------------------------------------------------
// 1. Verify the inbound ServiceM8 action JWT and pull job context
// ---------------------------------------------------------------
function verifyServiceM8Action(rawJwt) {
  // ServiceM8 signs action-button callbacks with the Add-on's App Secret (HS256)
  const payload = jwt.verify(rawJwt, SM8_APP_SECRET, { algorithms: ["HS256"] });
  // payload contains: eventKey, jobUUID, companyUUID, staffUUID, accountUUID
  return payload;
}

// ---------------------------------------------------------------
// 2. Pull the job + client contact details we need for the envelope
// ---------------------------------------------------------------
async function getJobAndContact(jobUUID) {
  const jobRes = await fetch(`https://api.servicem8.com/api_1.0/job/${jobUUID}.json`, {
    headers: { Authorization: `Bearer ${SM8_API_KEY}` },
  });
  const job = await jobRes.json();

  const contactRes = await fetch(
    `https://api.servicem8.com/api_1.0/jobcontact.json?%24filter=job_uuid%20eq%20'${jobUUID}'%20and%20type%20eq%20'JOB'`,
    { headers: { Authorization: `Bearer ${SM8_API_KEY}` } }
  );
  const [contact] = await contactRes.json();

  if (!contact?.email) {
    throw new Error("Job has no contact email on file — cannot send for signature.");
  }

  return {
    jobAddress: job.job_address,
    jobDescription: job.job_description,
    jobUUID,
    contactName: `${contact.first} ${contact.last}`.trim(),
    contactEmail: contact.email,
  };
}

// ---------------------------------------------------------------
// 3. DocuSign JWT Grant — get (and cache) an access token
// ---------------------------------------------------------------
let cachedToken = null; // { token, expiresAt }

async function getDocuSignAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const assertion = jwt.sign(
    {
      iss: DOCUSIGN_INTEGRATION_KEY,
      sub: DOCUSIGN_USER_ID,
      aud: DOCUSIGN_AUTH_SERVER,
      scope: "signature impersonation",
    },
    DOCUSIGN_RSA_PRIVATE_KEY,
    { algorithm: "RS256", expiresIn: "1h" }
  );

  const res = await fetch(`https://${DOCUSIGN_AUTH_SERVER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    // If consent hasn't been granted yet, DocuSign returns consent_required —
    // surface this clearly rather than a generic 401.
    const body = await res.text();
    throw new Error(`DocuSign auth failed: ${body}`);
  }

  const { access_token, expires_in } = await res.json();
  cachedToken = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

// ---------------------------------------------------------------
// 4. Build + send the envelope from a template
// ---------------------------------------------------------------
async function sendEnvelope({ jobAddress, jobDescription, jobUUID, contactName, contactEmail }) {
  const accessToken = await getDocuSignAccessToken();

  // Template approach (recommended): the template itself holds the fixed
  // contract text and the signature tab. We only supply the signer and the
  // values for the merge/text tabs already defined on the template.
  const envelopeDefinition = {
    status: "sent",
    templateId: DOCUSIGN_TEMPLATE_ID,
    emailSubject: "Please sign: Job confirmation and terms",
    templateRoles: [
      {
        roleName: "Customer",              // must match the role name configured on the template
        name: contactName,
        email: contactEmail,
        tabs: {
          textTabs: [
            { tabLabel: "JobAddress", value: jobAddress },
            { tabLabel: "JobDescription", value: jobDescription },
            { tabLabel: "JobReference", value: jobUUID },
          ],
        },
      },
    ],
    // Custom field lets the DocuSign Connect webhook (see below) match the
    // completed envelope back to the originating ServiceM8 job.
    customFields: {
      textCustomFields: [{ name: "servicem8_job_uuid", value: jobUUID, show: false, required: false }],
    },
  };

  const res = await fetch(`${DOCUSIGN_BASE_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(envelopeDefinition),
  });

  if (!res.ok) {
    throw new Error(`DocuSign createEnvelope failed: ${await res.text()}`);
  }

  return res.json(); // { envelopeId, status, statusDateTime, uri }
}

// ---------------------------------------------------------------
// 5. Write a note back to the Job Diary so the send is visible in ServiceM8
// ---------------------------------------------------------------
async function writeJobNote(jobUUID, text) {
  await fetch(`https://api.servicem8.com/api_1.0/note.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SM8_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      related_object: "job",
      related_object_uuid: jobUUID,
      note: text,
    }),
  });
}

// ---------------------------------------------------------------
// Entry point — this is what your Add-on action callback URL hits
// ---------------------------------------------------------------
exports.handleSendForSignature = async function (req, res) {
  try {
    const { jobUUID } = verifyServiceM8Action(req.body.actionToken);
    const context = await getJobAndContact(jobUUID);
    const envelope = await sendEnvelope(context);

    await writeJobNote(
      jobUUID,
      `DocuSign envelope sent to ${context.contactName} (${context.contactEmail}) for signature. Envelope ID: ${envelope.envelopeId}`
    );

    // Small HTML confirmation shown inside the ServiceM8 modal
    res.status(200).send(`
      <html><body style="font-family:sans-serif;padding:24px;text-align:center">
        <h3>Sent ✓</h3>
        <p>Signature request sent to ${context.contactName}.</p>
      </body></html>
    `);
  } catch (err) {
    res.status(200).send(`
      <html><body style="font-family:sans-serif;padding:24px;text-align:center;color:#a4262c">
        <h3>Couldn't send</h3>
        <p>${err.message}</p>
      </body></html>
    `);
  }
};

/**
 * One-time setup (per DocuSign account, done once, not per-envelope):
 * 1. Create an Integration Key in the DocuSign Admin console, generate an
 *    RSA keypair for it, and store the private key in Key Vault.
 * 2. Grant consent once by opening, as the sending user:
 *    https://account.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation
 *      &client_id={DOCUSIGN_INTEGRATION_KEY}&redirect_uri={any registered URI}
 *    This authorises JWT Grant impersonation for that user going forward —
 *    no further user interaction needed after this.
 * 3. Build the contract template in DocuSign (web console), name the
 *    signer role "Customer", and add text tabs labelled JobAddress,
 *    JobDescription, JobReference wherever those values should appear.
 */
