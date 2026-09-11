interface SM8Event {
  eventName: string;
  eventArgs: { jobUUID?: string; [key: string]: unknown };
  auth: { accessToken: string };
}

export const handler = async (event: SM8Event) => {
  if (event.eventName === "init_addon") {
    return showMainMenu(event);
  } else if (event.eventName === "request_job_data_event") {
    //Fetch Job Data from ServiceM8 API
    const jobUUID = event.eventArgs.jobUUID;
    const accessToken = event.auth.accessToken;
    return showJobData(jobUUID, accessToken);
  }

  return {};
};

function showMainMenu(event) {
  var strHTMLResponse =
    `
	<!doctype html>
	<html lang="en">
	<head>
	    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SM8 DocuSign AddOn</title>
	    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB" crossorigin="anonymous">
		<link rel="stylesheet" href="https://platform.servicem8.com/sdk/1.0/sdk.css">
        <script src="https://kit.fontawesome.com/c23365d52f.js" crossorigin="anonymous"></script>
    	<script src="https://platform.servicem8.com/sdk/1.0/sdk.js"></script>
		<script type="text/javascript">
			var client = SMClient.init();
			
			//Resize Addon Window
			//client.resizeWindow(750, 900);
			
			function getJobData(strJobUUID) {
			
			    //Use the ServiceM8 Client SDK 'invoke' method to pass our request to our server-side function
				client.invoke('request_job_data_event', {
					jobUUID: strJobUUID
				}).then(function(message) {		
					document.getElementById('EventData').innerHTML = '<pre>' + message + '</pre>';	
				});
			
			}
      }
			
		</script>
		<style>
			
			#EventData {
				display: none;
			}
			
		</style>
    </head>
    <body>
	<div class="container-fluid" id="mainContainer">
	<header class="p-3 mb-3 border-bottom"> <div class="container"> <div class="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start"> 
	<a href="/" class="d-flex align-items-center mb-2 mb-lg-0 link-body-emphasis text-decoration-none"> 
	<svg class="bi me-2" width="40" height="32" role="img" aria-label="Bootstrap">
	<use xlink:href="#bootstrap"></use></svg> </a> 
	<ul class="nav col-12 col-lg-auto me-lg-auto mb-2 justify-content-center mb-md-0"> 
		<li><a href="#" class="nav-link px-2 link-secondary">Overview</a></li> 
		<li><a href="#" class="nav-link px-2 link-body-emphasis">Inventory</a></li> 
		<li><a href="#" class="nav-link px-2 link-body-emphasis">Customers</a></li> 
		<li><a href="#" class="nav-link px-2 link-body-emphasis">Products</a></li> </ul> 
		 
		<div class="dropdown text-end"> <a href="#" class="d-block link-body-emphasis text-decoration-none dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false"> 
		<img src="https://github.com/sudhirke.png" alt="mdo" width="32" height="32" class="rounded-circle"> </a> 
		<ul class="dropdown-menu text-small"> <li><a class="dropdown-item" href="#">New project...</a></li> <li><a class="dropdown-item" href="#">Settings</a></li> 
		<li><a class="dropdown-item" href="#">Profile</a></li> <li><hr class="dropdown-divider"></li> <li><a class="dropdown-item" href="#">Sign out</a></li> </ul> 
		</div> </div> </div> 
		</header>


	    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js" integrity="sha384-FKyoEForCGlyvwx9Hj09JcYn3nv7wiPVlz7YYwJrWVcXK/BmnVDxM+D2scQbITxI" crossorigin="anonymous"></script>

		<h1> Docusign Integration v1.0.0</h1>
		<p>The addon showcase demonstrates the client side capabilities of addons using the Job Action.</p>		
		<p>You have launched addon showcase from job <b>` +
    event.eventArgs.jobUUID +
    `</b></p>			
		<button class="btn btn-primary rounded-pill px-3" type="button" onClick="document.getElementById('EventData').style.display = 'block';">Show Event Data</button>
								
		<button class="btn btn-secondary rounded-pill px-3" type="button" onClick="getJobData('` +
    event.eventArgs.jobUUID +
    `');">Load Job Data</button>

    <button class="btn btn-secondary rounded-pill px-3" type="button" onClick="listAllocationWindows();">List Allocation Windows</button>
		
		<div id="EventData">
			<pre>` +
    JSON.stringify(event, null, 2) +
    `</pre>
		</div>
			
		<div id="JobData"></div>
	</div>		
	</body>
</html>
`;

  //Return Response
  return {
    eventResponse: strHTMLResponse,
  };
}

async function showJobData(jobUUID: string, accessToken: string) {
  var strHTMLResponse =
    `
	<!doctype html>
	<html lang="en">
	<head>
	    <meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>SM8 DocuSign AddOn</title>
	    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB" crossorigin="anonymous">
		<link rel="stylesheet" href="https://platform.servicem8.com/sdk/1.0/sdk.css">
		<script src="https://kit.fontawesome.com/c23365d52f.js" crossorigin="anonymous"></script>
		<script src="https://platform.servicem8.com/sdk/1.0/sdk.js"></script>
	</head>
	<body>
	<div class="container-fluid" id="mainContainer">
</div>
		<h1> Job Details</h1>
		<p>The addon showcase demonstrates the client side capabilities of addons using the Job Action.</p>		
		<p>You have launched addon showcase from job <b>` +
    jobUUID +
    `</b></p>			
		<div id="JobData">
			<pre>` +
    JSON.stringify({ jobUUID, accessToken }, null, 2) +
    `</pre>
		</div>
		</body>
	</html>
	`;

  //Return Response
  return {
    eventResponse: strHTMLResponse,
  };
}
