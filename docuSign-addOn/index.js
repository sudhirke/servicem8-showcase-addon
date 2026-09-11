"use strict";

import { handleListAllocationWindows } from "./src/allocationWindows";

/**
 * exports.handler is called for every event, determine which event was called, and route to function for handling
 *
 * Note: event.eventName is always lower-case.
 */
exports.handler = async (event) => {
  //Route Event based on event name
  if (event.eventName == "showcase_main_menu") {
    //Showcase_Main_Menu was defined in the manifest.json as the event to run on Job Action Popup
    return showMainMenu(event);
  } else if (event.eventName == "request_job_data_event") {
    //request_job_data_event is called from the client-side client.invoke() function on the main menu event
    return requestJobData(event);
  } else if (event.eventName == "list_allocation_windows") {
    //list_allocation_windows is called from the client-side client.invoke() function on the main menu event
    return handleListAllocationWindows(event);
  }

  return {};
};

/**
 * Job Action Main Menu
 *
 * Simple functions can render HTML content into a Job/Client Action popup window. This could be simple static HTML, or dynamic by using the event data context about the currently open job card.
 * If you wish to make event requests after the initial event has loaded, make sure to include the ServiceM8 Client SDK in your HTML, so you can use the invoke function to pass data back to your server-side Simple Function.
 */
function showMainMenu(event) {
  var strHTMLResponse =
    `
<html>
	<head>
		<link rel="stylesheet" href="https://platform.servicem8.com/sdk/1.0/sdk.css">
        <script src="https://kit.fontawesome.com/c23365d52f.js" crossorigin="anonymous"></script>
    	<script src="https://platform.servicem8.com/sdk/1.0/sdk.js"></script>
		<script type="text/javascript">
			var client = SMClient.init();
			
			//Resize Addon Window
			client.resizeWindow(650, 650);
			
			function getJobData(strJobUUID) {
			
			    //Use the ServiceM8 Client SDK 'invoke' method to pass our request to our server-side function
				client.invoke('request_job_data_event', {
					jobUUID: strJobUUID
				}).then(function(message) {
				
					document.getElementById('EventData').innerHTML = '<pre>' + message + '</pre>';
				
				});
			
			}

      function listAllocationWindows() {
        client.invoke('list_allocation_windows', {}).then(function (message) {
          console.log("Allocation Windows:", message);
          document.getElementById('JobData').innerHTML = '<pre>' + message + '</pre>';

        });
      }
			
		</script>
		<style>
			
			#EventData {
				display: none;
			}
			
		</style>
    </head>
    <body>
		<h1><i class="fa-solid fa-thumbs-up"></i> Showcas v1.0.0</h1>
		<p>The addon showcase demonstrates the client side capabilities of addons using the Job Action.</p>
			
		<p>You have launched addon showcase from job <b>` +
    event.eventArgs.jobUUID +
    `</b></p>			
		<button onClick="document.getElementById('EventData').style.display = 'block';">Show Event Data</button>
					
		<button onClick="client.resizeWindow((Math.random() * 500) + 250, (Math.random() * 500) + 250);">Random Resize Window</button>
			
		<button onClick="getJobData('` +
    event.eventArgs.jobUUID +
    `');">Load Job Data</button>

    <button onClick="listAllocationWindows();">List Allocation Windows</button>
		
		<div id="EventData">
			<pre>` +
    JSON.stringify(event, null, 2) +
    `</pre>
		</div>
			
		<div id="JobData"></div>
			
	</body>
</html>
`;

  //Return Response
  return {
    eventResponse: strHTMLResponse,
  };
}

/**
 * This event is invoked from the main menu 'Load Job Data' button using the invoked event 'request_job_data_event'.
 *
 * We're able to request job data from the API because each event is issued with a temporary accessToken (event.auth.accessToken), and know the job UUID because we passed it from the main menu event (event.eventArgs.jobUUID)
 */
async function requestJobData(event) {
  var options = {
    method: "GET",
    url:
      "https://api.servicem8.com/api_1.0/job/" +
      event.eventArgs.jobUUID +
      ".json",
    auth: {
      bearer: event.auth.accessToken,
    },
  };

  //Make Request to ServiceM8 API
  var response;
  try {
    response = await requestAsync(options);
  } catch (error) {
    throw new Error(
      "Unable to retrieve job [" +
        event.eventArgs.jobUUID +
        "] [" +
        error +
        "]",
    );
  }

  //Parse Job Data
  var jobData = JSON.parse(response.body);

  //Success - Return Job JSON as the Response
  return {
    eventResponse: JSON.stringify(jobData, null, 2),
  };
}

function requestAsync(options) {
  var headers = {};
  if (options.auth && options.auth.bearer) {
    headers.Authorization = "Bearer " + options.auth.bearer;
  }

  return fetch(options.url, { headers }).then(async (response) => {
    return {
      response: { statusCode: response.status },
      body: await response.text(),
    };
  });
}
