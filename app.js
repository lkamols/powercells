'use strict'

const serverLocation = "http://localhost:8080";

//SELECTORS
const switcher = document.querySelector('.btn');
const addChargerButton = document.querySelector('.add-btn');

const chargers = [];
const NUM_BATTERIES = 16;

//configuration constants
const configuration = {
    MaV: 4.2, //max voltage
    StV: 3.7, //store voltage
    MiV: 3.2, //min voltage
    DiR: 500, //max discharge?
    MaT: 40, //max temperature
    DiC: 1, //discharge cycles
    ChC: false, //?????????????
    McH: 240, //?????????????
    LcR: 1000, //?????????????
    LmR: 90, //??????????????
    CcO: 1, //charge correction factor
    DcO: 1, //discharge correction factor
    LmV: 0.3, //????????????
    LcV: 3.6, //low capacitance recovery voltage??
    LmD: 1.1 //????????????
}

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

    console.log('who_am_i request sent to ' + whoAmIReq.enteredIp);
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
                //who_am_i request successful, now send a configuration request
                setConfigInfo(this.enteredIp, response.McC);
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

/**
 * function called when a successful who_am_i request is received from the given IP and a set_config_info request is successful
 * @param ipAddress - the ip address of the charger
 * @param version - the firmware version of the charger
 */
function newChargerFound(ipAddress, version) {
    console.log("who_am_i and set_config_info successful from " + ipAddress)

    //update the status bar
    var statusBar = document.getElementById("enter-status");
    statusBar.style.visibility = "visible";
    statusBar.textContent = "MegaCell charger at IP " + ipAddress + " with " + version + " added";

    //now create the object for the charger and its display
    var charger = createChargerObject(ipAddress);
    createChargerDisplay(charger);
    chargers.push(charger);
}

/**
 * Send a set_config_info request to the charger to ensure it has the correct settings
 * @param ipAddress - the ip address of the charger
 * @param version - the version of the charger
 */
function setConfigInfo(ipAddress, version) {
    
    var setConfigReq = new XMLHttpRequest();
    //add the ip address and version to the request so they can be recovered in the response
    setConfigReq.ipAddress = ipAddress;
    setConfigReq.version = version;
    //now construct the actual request
    setConfigReq.url = "http://" + ipAddress + "/api/set_config_info";
    setConfigReq.onload = setConfigResponse; //the response will be handled by this function
    setConfigReq.onerror = function() {
        failedChargerAdd(this.enteredIp, "Failed to connect to server at " + serverLocation);
    }
    setConfigReq.open("POST", serverLocation);
    setConfigReq.setRequestHeader("Content-Type", "application/json");

    //construct the body
    var httpBody = new Object();
    httpBody.url = setConfigReq.url;
    httpBody.type = "POST";
    httpBody.body = JSON.stringify(configuration);

    //send off the request
    setConfigReq.send(JSON.stringify(httpBody));
    console.log('set config request sent to ' + setConfigReq.ipAddress);
}

/**
 * Handles the set_config_info response
 */
function setConfigResponse() {
    if (this.readyState === 4) {
        if (this.status == 200) { //OK RESPONSE
            newChargerFound(this.ipAddress, this.version);
        } else if (this.status == 404) { //send back 404 if we made connection to the server but it could not contact the charger
            failedChargerAdd(this.enteredIp, "no charger found at " + this.enteredIp);
        } else {
            failedChargerAdd(this.enteredIp, "unexpected status response: " + this.status + " at " + this.enteredIp);
        }
    }    
}


/**
 * Function for reading and updating the values, needs to be called with a bind to a charger
 */
function getCellsInfo() {
    var cellsInfoReq = new XMLHttpRequest();
    //use the known IP address to create the url
    cellsInfoReq.url = "http://" + this.ipAddress + "/api/get_cells_info";
    cellsInfoReq.charger = this; //pass through all the information about which charger we are dealing with
    cellsInfoReq.onload = returnedCellsInfo;
    cellsInfoReq.onerror = function() {
        updateChargerStatus(cellsInfoReq.charger, "Error communicating with server");
    }
    
    //cellsInfoReq.onerror TODO ADD THIS
    cellsInfoReq.open("POST", serverLocation);
    cellsInfoReq.setRequestHeader("Content-Type", "application/json");

    //construct the body of the request we want to send, this is the info sent to the server
    var httpBody = new Object();
    httpBody.url = cellsInfoReq.url;
    httpBody.type = "POST";
    httpBody.body = JSON.stringify({"settings": [{"charger_id" : this.number}]})

    //send it off
    cellsInfoReq.send(JSON.stringify(httpBody));
    console.log('cells info request sent to' + cellsInfoReq.url);
}

/**
 * function for a response to a get_cells_info call
 */
function returnedCellsInfo() {
    if (this.readyState === 4) {
        if (this.status == 200) { //OK RESPONSE
            var charger = this.charger; //required to pass the value into the anonymous function
            var response = JSON.parse(this.responseText);
            var info = response["cells"]; //unpack the first layer of the returned json
            //go through all of the batteries and update their display
            for (var i = 0; i < NUM_BATTERIES; i++) {
                //all info is returned as an array, to be safe, don't assume they are ordered, so go through them all
                //until we find a "CiD" with the correct number, inefficient but safer to updates
                response["cells"].forEach(function(entry) {
                    if (entry["CiD"] == i) {
                        //update the status
                        charger.batteries[i].querySelector(".battery-status").innerHTML = "Status: " + entry["status"];
                        //also update the progress display
                        updateBatteryDisplay(charger.batteries[i].querySelector(".battery-display-foreground"), entry["voltage"]);
                        return;
                    }
                })
            }
            updateChargerStatus(charger, "Charger Working");
        } else {
            updateChargerStatus(charger, "Error communicating with charger");
        }
    }
}

/**
 * update the battery display
 * @param battery - the battery we are updating
 * @param voltageReading - the voltage reading for the battery
 */
function updateBatteryDisplay(battery, voltageReading) {
    //first determine the percentage of the battery being full
    var percentage =  Math.max(0, Math.min(100, (voltageReading - configuration.MiV)/(configuration.MaV - configuration.MiV)*100));
    battery.style.width = percentage + "%";
    //cause colours are fun, gradient from red to green
    var red = Math.floor(255 * (Math.min(100, 200 - 2*percentage)) / 100);
    var green = Math.floor(255 * (Math.min(100, 2*percentage)) / 100);
    battery.style.backgroundColor = `rgb(${red},${green},0)`;
}

////////////////////////////////////////DISPLAY CODE/////////////////////////////////////////


/**
 * Create a object for the charger at the given ip address
 * @param ipAddress - the ip address of the charger to be created
 */
function createChargerObject(ipAddress) {
    var charger = new Object();
    charger.ipAddress = ipAddress;
    charger.batteries = [];
    charger.number = chargers.length; //index it
    return charger;
}

/**
 * Create a new display for the charger and add it to the list of displays
 * @param charger - the charger object to create the display for
 */
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

    charger.container = outsideContainer; //add the full container to the charger object
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

    //create the 'read chargers' button
    var readButton = document.createElement("button");
    readButton.className = "read-btn";
    readButton.innerHTML = "Get Battery Status";
    readButton.addEventListener("click", getCellsInfo.bind(charger), false);
    statusContainer.appendChild(readButton);

    //create the 'status' area to use if needed to give updates about an individual charger
    var status = document.createElement('p');
    status.className = "charger-status";
    statusContainer.appendChild(status);

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
    /*
    var batteryDisplay = document.createElement("progress");
    batteryDisplay.className = "battery-display";
    batteryDisplay.value = 0;
    batteryDisplay.max = 100;
    container.appendChild(batteryDisplay);
    */
    var batteryDisplayBackground = document.createElement("div");
    batteryDisplayBackground.className = "battery-display-background";
    
    var batteryDisplayForeground = document.createElement("div");
    batteryDisplayForeground.className = "battery-display-foreground";
    container.appendChild(batteryDisplayBackground);
    batteryDisplayBackground.appendChild(batteryDisplayForeground);
    

    //final create the status section for each one
    var statusDisplay = document.createElement("p");
    statusDisplay.className = "battery-status";
    statusDisplay.innerHTML = "Status: Not Started";
    container.appendChild(statusDisplay);

    return container;
}

/**
 * display a message on the charger status
 * @param charger the charger to change the status of
 * @param message the text to put as the charger status
 */
function updateChargerStatus(charger, message) {
    var status = charger.container.querySelector(".charger-status");
    status.style.visibility = "visible";
    status.innerHTML = message;
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






///////////////////////////////////////EVENTS/////////////////////////////////////
addChargerButton.addEventListener('click', newIpAdded, false);
