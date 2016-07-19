// get the encoded event ID from the page
var dataEidEncoded = document.getElementsByClassName('ep')[0].getAttribute("data-eid");
if (dataEidEncoded !== undefined) {
    var decoded = atob(dataEidEncoded);
    var eid = decoded.split(/[\s]/)[0];
    // fire an event so that the listener can retrieve the eid from here
    document.dispatchEvent(new CustomEvent('retrieveEventId', {
        detail: eid
    }));
}
