// get variables from the background page
var bg = chrome.extension.getBackgroundPage();
var email = bg.email;
var eid = bg.eid;
var exists = false;
var start;
var end;
var dateFormat = "date";
var openAirBaseURL = "https://sandbox.openair.com"

/* API base URLs */
// API deployed in CH
var baseURL = "http://services-openair-api.cloudhub.io/api";

/* authentication parameters */
// var clientId = 'f268fe3d3cd14bc9a1bbb4fe0082a16d';
// var clientSecret = '4d3217e5f75e455b971A9E3E2B768257';

// open up the port between the background page and this page
var port = chrome.runtime.connect({name: "eventpopup"});

var access_token_deferred = $.Deferred();

$(document).ready(function() {
	console.log("doc ready");
    // replace the "SC" greeting text with the SC's email address
    document.getElementById("email").innerHTML = email;

    // set the value of the hidden eid field in the form to the event ID
    $("#eid").val(eid);

    // check that the user's auth token is still valid, if not then refresh
    authStatus();

    $.when(access_token_deferred).done(function(authStatusResponse) {
    	access_token = authStatusResponse;
		
		// Poluate form from Google Event and wait for response to call OpenAir Timesheet (Mule API)
		var eventDatePromise = populateFormFromEvent();
        eventDatePromise.done(function(date){
			console.log("PROMISED DATE RECEIVED!! " + date);
			populateFormFromTimesheet(date);
        });
		
        // Populate select lists from OpenAir (Mule API)
        setSelectLists();
    });

    // when the form submit button is clicked
    $("#addEventToOpenAir").click(function() {

        // change to the button's loading state so the user has feedback
        var $btn = $(this).button('loading');

        // validate the form
        $("#addToOpenAirForm").validate({

            ignore: ".ignore",

            // apply validation rules to the form
            rules: {
				Timesheet: {
                    required: true
                },
                Project: {
                    required: true
                },
                Task: {
                    required: true
                },
                EventNotes: {
                    required: true
                },
                EventDate: {
                    required: true
                },
                Hours: {
                    required: true
                }
            },

            errorElement: 'span',
            errorClass: 'help-block',
            errorPlacement: function(error, element) {
                if (element.parent('.input-group').length) {
                    error.insertAfter(element.parent());
                } else {
                    error.insertAfter(element);
                }
            },

            // if validation fails
            invalidHandler: function(event, validator) {

                // reset the submit button back to its default state from the loading state
                $btn.button('reset');
            },

            // if validation has passed then invoke the submit handler
            submitHandler: function(form) {

                // serialise the form data ready to send to the web service
				var payload = {
					"email": email,
					"date": $("#EventDate").val(),
					"decimal_hours": $("#Hours").val(),
					"timesheetid": $("#TimesheetId").val(),
					"timesheet": $("#Timesheet").val(),
					"projecttaskid": $("#Task").val(),
					"projecttask": $("#Task").children(":selected").text(),
					"projectid": $("#Project").val(),
					"project": $("#Project").children(":selected").text(),
					"notes": $("#EventNotes").val(),
					"eid" : $("#eid").val()
                }

				console.log("SENDING POST: " + JSON.stringify(payload));
                // call the web service via ajax
                $.ajax({
                    type: "POST",
                    url: baseURL + "/projects/tasks/time",
                    data: JSON.stringify(payload),
                    dataType: "json",
                    contentType: "application/json; charset=UTF-8",
                    headers: {
                        Accept: "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },

                    // on success load a different page in the modal confirming that the action completed successfully
                    success: function(resp) {

                        // put the submitted data in a variable to make it easier to use later on
                        var dataToServer = this.data;

                        // replace the contents of the body with the success form
                        $("body").load("success.html", dataToServer, function () {

                            // serialise the submitted form data so it is easier to reference
                            var jsonDataToServer = jQuery.parseJSON(dataToServer);
                            updateOpenAirFormWith(jsonDataToServer);

                            // include a link to view the Timesheet in OpenAir
                            document.getElementById("AddEventLink").href = openAirBaseURL + "/timesheet.pl?app=ta;action=grid;timesheet_id=" + payload.timesheetid;

                            // add our javascript file to the page - we can't include it in the html using <script>
                            // directly since it will violate the Chrome extension security policy
                            var th = document.getElementsByTagName('head')[0];
                            var s = document.createElement('script');
                            s.setAttribute('type', 'text/javascript');
                            s.setAttribute('src', '../js/success.js');
                            th.appendChild(s);
                        });

                        var startData = {};
                        startData[dateFormat] = start;
                        var endData = {};
                        endData[dateFormat] = end;

                        // update the event using the Google Calendar API to include the icon
                        $.ajax({
                            type: "PATCH",
                            url: "https://www.googleapis.com/calendar/v3/calendars/" + email + "/events/" + eid,
                            data: JSON.stringify({
                                access_token: access_token,
                                "start": startData,
                                "end": endData,
                                "gadget": {
                                    "title": "Event linked to OpenAir",
                                    "iconLink": "https://www.mulesoft.com/sites/default/files/anypoint_icon.png",
                                    "display": "chip",
									"preferences": {
										"taskId": resp.id
									}
                                }
                            }),
                            contentType: "application/json",
                            dataType: "json",
                            headers: {
                                Authorization: "OAuth " + access_token,
                            },
                            // if the API call was unsuccessful
                            error: function(error) {
                                // log the error to the browser console
                                console.error(error);
                                //alert("There was a problem calling the Google Calendar API:\n\n" + error.status + ": " + error.statusText + "\n\nCheck the browser console for more details.");
                            }
                        });

                    },

                    // if the API call was unsuccessful
                    error: function(error) {

                        // log the error to the browser console
                        console.error(error);
                        //alert("There has been a problem calling the Mule API:\n\n" + error.status + ": " + error.statusText + "\n\nCheck the browser console for more details.");

                        // reset the submit button back to its default state from the loading state
                        $btn.button('reset');
                    }
                });
            }
        });
    });

    // close the modal when the button is clicked
    $("#closePopup").click(function(event) {
        event.preventDefault();
        window.close();
    });

});

//TODO: ADD HIDDEN FIELD FOR TIMESHEET TEXT Value
function updateOpenAirFormWith(data) {
    $("#Timesheet").val(data["timesheet"]);
    $("#Project").val(data["project"]);
    $("#Task").val(data["projecttask"]);
    $("#EventNotes").val(data["notes"]);
    $("#EventDate").val(data["date"]);
    $("#Hours").val(data["decimal_hours"]);
    $("#TimesheetId").val(data["timesheetid"]);
    $("#eid").val(data["eid"]);
}

var timesheetStatusLookup = {
	"O": "Open",
	"S": "Submitted",
	"A": "Approved",
	"R": "Rejected"
}

// function to retrieve the timesheet associated to the event date
function populateFormFromTimesheet(date) {
    // call the web service via ajax
    return $.ajax({
        type: "GET",
        url: baseURL + "/timesheets?date=" + date + "&email=" + email,
        // data: {
//             eid: eid,
//             client_id: clientId,
//             client_secret: clientSecret
//         },
        dataType: "json",
        headers: {
           Accept: "application/json",
           "Access-Control-Allow-Origin": "*"
           //Authorization: "Bearer " + access_token
        },
        success: function(getTimesheetResponse) {
          var timesheet = (typeof getTimesheetResponse.timesheet != "undefined") ? getTimesheetResponse.timesheet : null;
          // if the timesheet exists for the given date
          if (timesheet != null) {
            var isOpen = (timesheet.status === "O");
            if (isOpen == true) {
				$("#Timesheet").val(timesheet.period);
				$("#TimesheetId").val(timesheet.id);
            } else {
				alert("Timesheet associated with the event date is on status: " + timesheetStatusLookup[timesheet.status] + ". You can only add time to Open timesheets.");
            }
          }
        },
        // if the API call was unsuccessful
        error: function(error) {

            // if there is no SC Action then the ajax request will execute this error function, because the request
            // is expecting a JSON response and instead there is no response.  Therefore we need to check that the
            // HTTP status code returned != 200 before we act on an error
            if (error.status != 200) {
                // log the error to the browser console
                console.error(error);
                //alert("There has been a problem calling the Mule API:\n\n" + error.status + ": " + error.statusText + "\n\nCheck the browser console for more details.");
            }
        }
    });
}

// function to populate the select lists in the form from the Mule API that gets the values from SFDC
function setSelectLists() {
    $.ajax({
        type: "GET",
        url: baseURL + "/projects/tasks?email=" + email,
        // data: {
//             client_id: clientId,
//             client_secret: clientSecret
//         },
        dataType: "json",
        headers: {
           Accept: "application/json",
           "Access-Control-Allow-Origin": "*"
           //Authorization: "Bearer " + access_token
        },

        // if the API call was successful
        success: function(data) {

            // if we got the list of options back
            if (!jQuery.isEmptyObject(data)) {

                // to make it easier to read put the list of items in a variable
                var projects = data.projects;

                // populate the select list
				console.log(JSON.stringify(projects));
				$("#Project").append($("<option></option>").text("--").val(""));
				$("#Task").append($("<option></option>").text("--").val(""));
                $.each(projects, function (index, p) {
                    $("#Project").append($("<option></option>").text(p.project.name).val(p.project.id));
	                $.each(p.tasks, function (index, task) {
	                   $("#Task").append($("<option></option>").attr("class",p.project.id).text(task.name).val(task.id));
	                })
                })
				$("#Task").chained("#Project");
            }
        },

        // if the API call was unsuccessful
        error: function(error) {

            // log the error to the browser console
            console.error(error);
            //alert("There has been a problem calling the Mule API:\n\n" + error.status + ": " + error.statusText + "\n\nCheck the browser console for more details.");
        }
    });

}

function populateFormFromEvent() {
	var deferred = $.Deferred();
    $.ajax({
        type: "GET",
        url: "https://www.googleapis.com/calendar/v3/calendars/" + email + "/events/" + eid,
        data: {
            access_token: access_token
        },
        dataType: "json",
        headers: {
            Accept: "application/json",
            "Access-Control-Allow-Origin": "*"
        },

        // if the API call was successful
        success: function(eventResponse) {

            // we need to check for both date and datetime as properties on the response object because if the
            // event spans multiple days then we will just have a start and end date rather than datetime
			console.log("******" + JSON.stringify(eventResponse));
			
			$("#EventNotes").val(eventResponse.summary);
			
            if (eventResponse.start.hasOwnProperty("dateTime")) {
                start = eventResponse.start.dateTime;
                end = eventResponse.end.dateTime;
                dateFormat = "dateTime";
            }
            else if (eventResponse.start.hasOwnProperty("date")) {
                start = eventResponse.start.date;
                end = eventResponse.end.date;
            }

            // calculate the length of the event
            var startDate = new Date(start);
            var endDate = new Date(end);
            var duration = (endDate - startDate) / (1000 * 60 * 60);
        
            // set the delivery time to be the calculated event length
			$("#Hours").val(Math.round(duration * 100) / 100);

            // format the start date of the event so it matches the date format yyyy-mm-dd used in the form
            var startDay = startDate.getDate();
            var startMonth = startDate.getMonth() + 1;
            var startYear = startDate.getFullYear();
            if (startDay < 10) startDay = '0' + startDay;
            if (startMonth < 10) startMonth = '0' + startMonth;
            // now set the Due Date form field to the date of the event
			$("#EventDate").val(startYear + "-" + startMonth + "-" + startDay);
			deferred.resolve(startYear + "-" + startMonth + "-" + startDay);
        },

        // if the API call was unsuccessful
        error: function(error) {
            //alert('cal error: ' + JSON.stringify(error, null, 4));
            // log the error to the browser console
            console.error(error);
			deferred.reject("HTTP error: " + xhr.status);
			
            // if the error was 401
            if (error.status == 401) {

                alert("Your Google access token isn't valid.  Try refreshing your token.\n\nYou can continue to use this app but event lengths will not be calculated automatically.");
            }
            // otherwise check the console and report
            else {
                alert("There has been a problem calling the Google Calendar API.  Check the browser console.");
            }
        }
    });
	return deferred.promise();
}

// see if the OAuth token is still valid, if not then remove it from the cache and refresh
function authStatus() {
    var retry = true;
    chrome.identity.getAuthToken({interactive: true}, function (token) {
        if (chrome.runtime.lastError) {
            alert(chrome.runtime.lastError.message);
            return;
        }
        var xhr = new XMLHttpRequest();
		console.log("requesting token");
		console.log(">> token: " + token);
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=' + token);
        xhr.addEventListener('load',function(){
			console.log(">> load event: " + xhr.status);
			if(xhr.status === 200){
			  console.log(">> yay!!!");
		      // 3.1) RESOLVE the DEFERRED (this will trigger all the done()...)
		      access_token_deferred.resolve(token);
		    } else if (xhr.status === 401 && retry){
		      // 3.2) REJECT the DEFERRED (this will trigger all the fail()...)
				retry = false;
                chrome.identity.removeCachedAuthToken({ 'token': token });
                return;
		    } else {
		    	access_token_deferred.reject("HTTP error: " + xhr.status);
		    }
		  },false) 
		xhr.send();
		return access_token_deferred.promise();
    });
}
