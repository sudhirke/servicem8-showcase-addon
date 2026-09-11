import { sm8Client } from "./lib/serviceM8";
import * as errors from "servicem8/models/errors";

import * as dotenv from "dotenv";
dotenv.config();

exports.handleListAllocationWindows = async function (event) {
  try {
    const result = await sm8Client.jobs.listJobs();
    console.log(result);
    return (
      `<div id="JobData">
			<pre>` +
      JSON.stringify(result, null, 2) +
      `</pre>
		</div>`
    );
  } catch (error) {
    // The base class for HTTP error responses
    if (error instanceof errors.ServiceM8Error) {
      console.log(error.message);
      console.log(error.statusCode);
      console.log(error.body);
      console.log(error.headers);

      // Depending on the method different errors may be thrown
      if (error instanceof errors.ErrorT) {
        console.log(error.data$.errorCode); // number
        console.log(error.data$.message); // string
      }
    }
  }
};

//run();
