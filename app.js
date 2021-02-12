'use strict'

const serverLocation = "http://localhost:8080";

//SELECTORS
const switcher = document.querySelector('.btn');
const addChargerButton = document.querySelector('.add-btn');
var chargersAttached = 0;
const chargers = [];

const NUM_BATTERIES = 16;


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

    /*

    //now create the display used for each charger
    var chargerDisplay = document.createElement("div");
    chargerDisplay.id = 'charger-' + chargersAttached; //give each element a unique id
    chargersAttached++;
    
    var charger = document.createElement("p");
    charger.id = "hi";
    charger.textContent = ipAddress;
    chargerDisplay.appendChild(charger);

    //add this to the div display
    var divToAddTo = document.getElementById("body");
    divToAddTo.appendChild(chargerDisplay);

    if (chargersAttached == 3) {
        var display = document.getElementById("charger-1").querySelector("hi");
        //display.style.color = "#00FF00";
        console.log(display.id);
    }

    */
    

    var charger = createChargerObject(ipAddress);
    createChargerDisplay(charger);
    chargers.push(charger);
    
}

function createChargerObject(ipAddress) {
    var charger = new Object();
    charger.ipAddress = ipAddress;
    charger.batteries = [];
    return charger;
}

function createChargerDisplay(charger) {

    //first create the large container for the full charger display
    var chargerContainer = document.createElement("div");
    chargerContainer.className = "charger-div";

    //create the status container (and add it to the chargerContainer)
    createChargerStatusDisplay(charger, chargerContainer);

    //create the live display (and add it to the chargerContainer)
    createWholeBatteryDisplay(charger, chargerContainer);

    //finally append the whole thing to the large list of chargers
    var outsideContainer = document.getElementById("chargers-container");
    outsideContainer.appendChild(chargerContainer);
}

/**
 * create the status display for a given charger
 * @param charger - the charger we are creating the display for
 * @param aboveContainer - the container to place this in
 */
function createChargerStatusDisplay(charger, aboveContainer) {
    //create the status container first
    var statusContainer = document.createElement("div");
    statusContainer.className = "charger-status-div";

    //then create the title
    var title = document.createElement("h4");
    title.className = "charger-display-title";
    title.innerHTML = "Charger: " + charger.ipAddress;
    statusContainer.appendChild(title);

    aboveContainer.appendChild(statusContainer);
}
/**
 * 
 * @param charger - the charger to create the display for
 * @param aboveContainer - the container to place this in
 */
function createWholeBatteryDisplay(charger, aboveContainer) {
    var index = 0; //index used for each of the batteries

    //create the first half of the display
    var leftDisplay = document.createElement("div");
    leftDisplay.className = "charger-live-display-div-left";
    while (index < NUM_BATTERIES/2) {
        charger.batteries.push(createIndividualBatteryDisplay(index + 1));
        leftDisplay.appendChild(charger.batteries[index])
        index++;
    }
    var rightDisplay = document.createElement("div");
    rightDisplay.className = "charger-live-display-div-right";
    while (index < NUM_BATTERIES) {
        charger.batteries.push(createIndividualBatteryDisplay(index + 1));
        rightDisplay.appendChild(charger.batteries[index]);
        index++;
    }
    aboveContainer.appendChild(leftDisplay);
    aboveContainer.appendChild(rightDisplay);
}


/**
 * Create a display for an individual battery
 * @param index - the index of the battery, i.e the number to display
 * @param aboveContainer - the container to place this display in
 */
function createIndividualBatteryDisplay(index) {
    //start by creating the full container
    var container = document.createElement("div");
    container.className = "single-battery";

    //then create the battery number display and add it
    var numberDisplay = document.createElement("p");
    numberDisplay.className = "battery-number";
    numberDisplay.innerHTML = index;
    container.appendChild(numberDisplay);

    //then create the progress display and add it, start all progress bars at 0
    var batteryDisplay = document.createElement("progress");
    batteryDisplay.className = "battery-display";
    batteryDisplay.value = 12; //CHANGE TO ZERO
    batteryDisplay.max = 100;
    container.appendChild(batteryDisplay);

    //final create the status section for each one
    var statusDisplay = document.createElement("p");
    statusDisplay.className = "battery-status";
    statusDisplay.innerHTML = "Status: Not Started";
    container.appendChild(statusDisplay);

    return container;
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
