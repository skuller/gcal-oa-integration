// define variables for which we will fill their values later in this file
var email = "to be replaced";
var eid = "eid not found";
var access_token = "to be replaced";

// authenticate the currently logged in user so we can use the Google APIs
chrome.identity.getAuthToken({
    interactive: true
}, function(token) {
    if (chrome.runtime.lastError) {
        alert(chrome.runtime.lastError.message);
        return;
    }
    var x = new XMLHttpRequest();
    x.open('GET', 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=' + token);
    x.onload = function() {
        var resp = JSON.parse(x.response);
        email = resp['email'];
    };
    x.send();
    access_token = token;
});

// add a listener so that we can react to events triggered in other javascript files
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        // if someone has clicked on the SC Action button then a message is sent saying to open the popup
        if (request.type == "popup") {
            chrome.tabs.create({
                url: chrome.extension.getURL('html/addToOpenAirForm.html'),
                active: false
            }, function(tab) {
                // after the tab has been created, open a window to inject the tab
                chrome.windows.create({
                    tabId: tab.id,
                    type: 'popup',
                    focused: true,
                    width: 770,
                    height: 650
                });
            });
        }
        // if the event ID has been extracted from the page then a message is sent containing it
        else if (request.type == "eid") {
            eid = request.eid;
        }
        // if the email address has been requested from the content script then send it on
        else if (request.type == "email") {
            sendResponse(email);
            return;
        }
    }
);

// set up a connection to the scripts so we can detect when the popup has been closed
chrome.runtime.onConnect.addListener(function(port) {
    // if the connection has been closed
    port.onDisconnect.addListener(function() {
        // send a message to the content script so we can re-enable the SC Action button
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
            chrome.tabs.sendMessage(tabs[0].id, {type: "closed"}, function(response) {});
        });
    });
});