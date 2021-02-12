'use strict'

const serverLocation = "http://localhost:8080";

//SELECTORS
const switcher = document.querySelector('.btn');
const addChargerButton = document.querySelector('.add-btn');
var chargersAttached = 0;


/**
 * new IP address added
 */
function newIpAdded(event) {
    
    //we will need to send a request to check that there is a charger at the given IP
    var whoAmIReq = new XMLHttpRequest();
    //get the requested IP and change it to a url for the who_am_i request
    whoAmIReq.enteredIp = document.getElementById("ipentry").value;
    whoAmIReq.url = "http://" + whoAmIReq.enteredIp + "/api/who_am_i";
    whoAmIReq.onload = whoAmIResponse; //the response will be handled in the whoAmIResponse function
    whoAmIReq.onerror = function() {
        failedChargerAdd(this.enteredIp, "failed to connect to server at " + serverLocation);
    }
    whoAmIReq.open("POST", serverLocation);
    whoAmIReq.setRequestHeader("Content-Type", "application/json");

    //construct the body, we just need to send a get request to who_am_i
    var httpBody = new Object();
    httpBody.url = whoAmIReq.url;
    httpBody.type = "GET";

    //send the request, this goes to the Python server
    whoAmIReq.send(JSON.stringify(httpBody));

    console.log('process started');
}

/**
 * function called when a successful who_am_i request is received from the given IP
 * @param ipAddress - the ip address of the charger
 * @param version - the firmware version of the charger
 */
function newChargerFound(ipAddress, version) {
    console.log("who_am_i successful from " + ipAddress)
    //update the status bar
    var statusBar = document.getElementById("enter-status");
    statusBar.style.visibility = "visible";
    statusBar.textContent = "MegaCell charger at IP " + ipAddress + " with " + version + " added";

    //now create the display used for each charger
    var chargerDisplay = document.createElement("div");
    chargerDisplay.id = 'charger-' + chargersAttached; //give each element a unique id
    chargersAttached++;
    
    var charger = document.createElement("p");
    charger.id = "hi";
    charger.textContent = ipAddress;
    chargerDisplay.appendChild(charger);

    //add this to the div display
    var divToAddTo = document.getElementById("update-grid");
    divToAddTo.appendChild(chargerDisplay);

    if (chargersAttached == 3) {
        var display = document.getElementById("charger-1").getElementById("hi");
        //display.style.color = "#00FF00";
        console.log(display.id);
    }

}

/**
 * Function for displaying that the charger failed to add
 */
function failedChargerAdd(ipAddress, reason) {
    console.log("unsuccessful ip address addition of " + ipAddress)
    //update the status bar
    var statusBar = document.getElementById("enter-status");
    statusBar.style.visibility = "visible";
    statusBar.textContent = reason;
}

/**
 * Handles the response to the who am i request if it is loaded (i.e successfully connects to Python server)
 */
function whoAmIResponse() {
    if (this.readyState === 4) {
        if (this.status == 200) { //OK RESPONSE
            var response = JSON.parse(this.responseText);
            //also confirm we were supplied a version
            //could add some versioning checks in here
            if (response.McC != null) {
                newChargerFound(this.enteredIp, response.McC);
            } else {
                failedChargerAdd(this.enteredIp, "address " + this.enteredIp + " did not respond to who_am_i request");
            }
        } else if (this.status == 404) { //send back 404 if we made connection to the server but it could not contact the charger
            failedChargerAdd(this.enteredIp, "no charger found at " + this.enteredIp);
        } else {
            failedChargerAdd(this.enteredIp, "unexpected status response: " + this.status + " at " + this.enteredIp);
        }
    }
}

//EVENTS
addChargerButton.addEventListener('click', newIpAdded, false);
