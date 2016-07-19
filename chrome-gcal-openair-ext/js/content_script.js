addOpenAirButtonToPage// variable to hold the email address retrieved from the background page
var email = "to be replaced";

// listen for the hash in the window's URL changing
window.addEventListener("hashchange", function () {

    // the substring at the end of the window title of a particular event page
	var eventWindowTitle = 'Event Details';

	if (document.title.endsWith(eventWindowTitle)) {
    //if (window.location.hash.indexOf(hashSubstring) > -1) {

        // inject custom scripts into the page so we can get the information we need
        injectScript(chrome.extension.getURL('js/getEventId.js'), 'body');

        // check if the user's email address is a MuleSoft one
        var muledomain = "@mulesoft.com";
        if (email.indexOf(muledomain, email.length - muledomain.length) !== -1) {
            // add the "Add to OpenAir" button to the page
            addOpenAirButtonToPage();
        }

        // add a listener to the "Add to OpenAir" button we just created.
        // When the button is pressed we will send a message to the background
        // script telling it to open the popup.
        document.getElementById("addToOpenAirBtn").addEventListener("click", function () {
            chrome.runtime.sendMessage({
                type: "popup",
            });
            // disable the "Add to OpenAir" button so it can't be clicked again until this window is closed
            document.getElementById("addToOpenAirBtn").disabled = true;
        });
    }
}, false);

// listen to messages from the background page
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        // if the connection to the popup has been closed
        if (request.type == "closed") {
            // enable the "Add to OpenAir" button again
            document.getElementById("addToOpenAirBtn").disabled = false;
        }
    }
);

// get the email address from the background script
chrome.runtime.sendMessage({type: "email"}, function(reply) {
    email = reply;
});

// add a listener that will listen for the event triggered in the getEventId script
document.addEventListener("retrieveEventId", function(e) {
    chrome.extension.sendMessage({
        type: "eid",
        eid: e.detail
    });
});

// adds the "Add to OpenAir" button to the page
function addOpenAirButtonToPage() {
    var div = document.getElementsByClassName("ep-ea");
    var newSave = document.createElement("INPUT");
    newSave.setAttribute("type", "submit");
    newSave.setAttribute("id", "addToOpenAirBtn");
    newSave.setAttribute("value", "Add to OpenAir");
    div[0].appendChild(newSave);
}

// inject a javascript file into the page
function injectScript(file, node) {
    var th = document.getElementsByTagName(node)[0];
    var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('src', file);
    th.appendChild(s);
}
