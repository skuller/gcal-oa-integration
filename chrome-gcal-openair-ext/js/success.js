// javascript to attach to the page shown when the form is successfully submitted
$(document).ready(function() {

    // close the SC Action form when the link is followed to view the SC Action in Salesforce
    $("#AddEventLink").click(function() {
        window.close();
    });

    // close the modal when the button is clicked
    $("#closePopup").click(function(event) {
        event.preventDefault();
        window.close();
    });

});