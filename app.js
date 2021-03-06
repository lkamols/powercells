'use strict'

const serverLocation = "http://localhost:";
const portList = [8080, 57923, 54782, 63342, 50124]
var serverPort = -1; //-1 means we haven't found a port yet

//SELECTORS
const addChargerButton = document.querySelector('#add-btn');
const portChangeButton = document.querySelector('#port-btn');
const portSearchButton = document.querySelector('#search-port-btn');
const ipSearchButton = document.querySelector("#search-ip-btn");

const chargers = [];
const NUM_BATTERIES = 16;

const IP_ADDRESSES_FILENAME = "ipAddresses.txt";

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
 * a new ip address has been entered by the user
 */
function ipAddressEntered() {
    var ipEntry = document.getElementById("ipentry");
    var ipAddress = ipEntry.value;
    ipEntry.value = ""; //clear the entry field
    var ipStatus = document.getElementById("enter-status");
    ipStatus.innerHTML = "testing new IP: " + ipAddress;
    testNewIp(ipAddress, false);
}

/**
 * search through all IP addresses in the range 192.168.0.0 - 192.168.0.255
 */
function searchIpAddresses() {
    var ipStatus = document.getElementById("enter-status");
    ipStatus.innerHTML = "searching for new chargers, this may take a few minutes";
    //test each of the IP addresses in the range. start them all, they will be handled when the responses come in
    for (var i = 0; i < 256; i++) {
        testNewIp("192.168.0." + i, true);
    }
    //send a dummy end one to tell when the search is complete, this will always fail
    testNewIp("finish", true);
}

/**
 * function for testing if a new IP address.
 * @param ipAddress - the ip address to test
 * @param searching - whether we are currently doing a mass search, if we are searching, don't update the status
 */
function testNewIp(ipAddress, searching) {
    
    //we will need to send a request to check that there is a charger at the given IP
    var whoAmIReq = new XMLHttpRequest();
    //get the requested IP and change it to a url for the who_am_i request
    whoAmIReq.ipAddress = ipAddress;
    whoAmIReq.searching = searching; //save this to use in the onload function
    whoAmIReq.url = "http://" + whoAmIReq.ipAddress + "/api/who_am_i";
    whoAmIReq.onload = whoAmIResponse; //the response will be handled in the whoAmIResponse function
    whoAmIReq.onerror = function() {
        failedChargerAdd(this.ipAddress, "failed to connect to server at " + serverLocation + serverPort, searching);
    }
    whoAmIReq.open("POST", serverLocation + serverPort);
    whoAmIReq.setRequestHeader("Content-Type", "application/json");

    //construct the body, we just need to send a get request to who_am_i
    var httpBody = new Object();
    httpBody.location = whoAmIReq.url;
    httpBody.type = "GET";

    //send the request, this goes to the Python server
    whoAmIReq.send(JSON.stringify(httpBody));

    console.log('who_am_i request sent to ' + whoAmIReq.ipAddress);
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
                setConfigInfo(this.ipAddress, response.McC, this.searching);
            } else {
                failedChargerAdd(this.ipAddress, "address " + this.ipAddress + " did not respond to who_am_i request", this.searching);
            }
        } else if (this.status == 404) { //send back 404 if we made connection to the server but it could not contact the charger
            failedChargerAdd(this.ipAddress, "no charger found at " + this.ipAddress, this.searching);
        } else {
            failedChargerAdd(this.ipAddress, "unexpected status response: " + this.status + " at " + this.ipAddress, this.searching);
        }
    }
}

/**
 * read from a file on the server, returns a promise for reading a file
 * @param filename - the filename of the file on the server to read from
 */
function readFromFile(filename) {
    //we want to wait for this to return, so make it a promise
    var promise = new Promise(function(resolve, reject) {
        var readReq = new XMLHttpRequest();
        //now construct the actual request
        readReq.onload = function() {
            console.log(readReq.responseText);
            console.log("READ: " + JSON.parse(readReq.responseText));
            if (readReq.status == 200) {
                resolve(JSON.parse(readReq.responseText));
            } else {
                reject(readReq.statusText);
            }
        }
        readReq.onerror = function() {
            reject("connecting to server");
        }
        readReq.open("POST", serverLocation + serverPort);
        readReq.setRequestHeader("Content-Type", "application/json");

        //construct the body
        var httpBody = new Object();
        httpBody.location = filename;
        httpBody.type = "READ";

        //send off the request
        readReq.send(JSON.stringify(httpBody));
        console.log('read from ' + filename + ' sent');
    });
    return promise;
}

/**
 * Read the ip addresses stored in the server and add any that exist
 */
function readIpAddresses() {
    readFromFile(IP_ADDRESSES_FILENAME).then(function(data){
        if (data.ipAddresses != null) {
            for (var i = 0; i < data.ipAddresses.length; i++) {
                testNewIp(data.ipAddresses[i], true);
            }
        }
    }, function(error) {
        console.log("Error trying to gather ip addresses from server: " + error);
    })
}

/**
 * write to a file on the server
 * @param filename - the filename to write to
 * @param data - the data to send, as a javascript object, which will be converted to a json
 */
function writeToFile(filename, data) {
    var writeReq = new XMLHttpRequest();
    //now construct the actual request
    writeReq.onload = function() {
        console.log("write to " + filename + " succeeded"); //FLESH THIS OUT TO UPDATE AN ERROR STATUS ETC
    }
    writeReq.onerror = function() {
        console.log("write to " + filename + " failed"); //FLESH THIS OUT TO UPDATE AN ERROR STATUS ETC
    }
    writeReq.open("POST", serverLocation + serverPort);
    writeReq.setRequestHeader("Content-Type", "application/json");

    //construct the body
    var httpBody = new Object();
    httpBody.location = filename;
    httpBody.type = "WRITE";
    httpBody.body = JSON.stringify(data);

    //send off the request
    writeReq.send(JSON.stringify(httpBody));
    console.log('write to ' + filename + ' sent');
}

/**
 * save the ip addresses to a file stored on the server
 */
function saveIpAddresses() {
    var dict = new Object();
    dict.ipAddresses = [];
    //add all the IP addresses
    for (var i = 0; i < chargers.length; i++) {
        dict.ipAddresses.push(chargers[i].ipAddress);
    }
    writeToFile(IP_ADDRESSES_FILENAME, dict);
}

/**
 * function called when a successful who_am_i request is received from the given IP and a set_config_info request is successful
 * @param ipAddress - the ip address of the charger
 * @param version - the firmware version of the charger
 */
function newChargerFound(ipAddress, version, searching) {
    console.log("who_am_i and set_config_info successful from " + ipAddress);

    //check that the charger being found is a new one
    for (var i = 0; i < chargers.length; i++) {
        if (chargers[i].ipAddress == ipAddress) {
            console.log("charger at IP " + ipAddress + " already stored");
            return; //already there, exit
        }
    }

    //update the status bar
    if (!searching) {
        var statusBar = document.getElementById("enter-status");
        statusBar.textContent = "MegaCell charger at IP " + ipAddress + " with " + version + " added";
    }
    //now create the object for the charger and its display
    var charger = createChargerObject(ipAddress);
    createChargerDisplay(charger);
    chargers.push(charger);
    saveIpAddresses();
}

/**
 * Send a set_config_info request to the charger to ensure it has the correct settings
 * @param ipAddress - the ip address of the charger
 * @param version - the version of the charger
 * @param searching - whether or not this config info set up is part of a search for IP addresses
 */
function setConfigInfo(ipAddress, version, searching) {
    
    var setConfigReq = new XMLHttpRequest();
    //add the ip address, version and searching boolean to the request so they can be recovered in the response
    setConfigReq.ipAddress = ipAddress;
    setConfigReq.version = version;
    setConfigReq.searching = searching;
    //now construct the actual request
    setConfigReq.url = "http://" + ipAddress + "/api/set_config_info";
    setConfigReq.onload = setConfigResponse; //the response will be handled by this function
    setConfigReq.onerror = function() {
        failedChargerAdd(this.ipAddress, "Failed to connect to server at " + serverLocation + serverPort, this.searching);
    }
    setConfigReq.open("POST", serverLocation + serverPort);
    setConfigReq.setRequestHeader("Content-Type", "application/json");

    //construct the body
    var httpBody = new Object();
    httpBody.location = setConfigReq.url;
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
            newChargerFound(this.ipAddress, this.version, this.searching);
        } else if (this.status == 404) { //send back 404 if we made connection to the server but it could not contact the charger
            failedChargerAdd(this.ipAddress, "no charger found at " + this.ipAddress, this.searching);
        } else {
            failedChargerAdd(this.ipAddress, "unexpected status response: " + this.status + " at " + this.ipAddress, this.searching);
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
    cellsInfoReq.open("POST", serverLocation + serverPort);
    cellsInfoReq.setRequestHeader("Content-Type", "application/json");

    //construct the body of the request we want to send, this is the info sent to the server
    var httpBody = new Object();
    httpBody.location = cellsInfoReq.url;
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
                info.forEach(function(entry) {
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
 * search for a server with the port number entered
 */
function portNumberEntered() {
    var portEntry = document.querySelector('#port-entry');
    port = portEntry.value;
    portEntry.value = ""; //clear the entry
    searchPort(port, false);
}

/**
 * function for when a port search has a successful response, checks that it was indeed our server
 */
function portFound() {
    if (this.readyState === 4) {
        if (this.status == 200) { //OK RESPONSE
            var response = JSON.parse(this.responseText);
            //we send back a json with a 'discover' field, if this exists, then it was our server
            if (response.discover != null) {
                var portStatus = document.querySelector('#port-status');
                portStatus.innerHTML = "Connected to server with port " + this.port;
                serverPort = this.port;
            } else {
                failedPortFind(this.port, this.searching);
            }
        } else {
            failedPortFind(this.port, this.searching);
        }
    }
    //try to populate any chargers
    readIpAddresses();
}

/**
 * Function for when finding a port failed. Checks for if there are more ports to search and
 * continues searching if required, otherwise sets an error message in the status bar and sets
 * the global serverPort to -1 to indicate there is no server running
 * @param port - which port is being searched
 * @param searching - whether we are in the process of doing an overall search
 */
function failedPortFind(port, searching) {
    //get the port status bar, likely going to be updated
    var portStatus = document.querySelector('#port-status');
    //first check for if we are searching. 
    if (searching == true) {
        //if we are searching, find the index of the port we have searched for
        var index = -1;
        for (var i = 0 ; i < portList.length; i++) {
            if (portList[i] == port) {
                index = i;
                break;
            }
        }
        //check the index
        if (index < -1 || index == portList.length - 1) {
            portStatus.innerHTML = "Search for server failed. Make sure the server is running.";
        } else {
            searchPort(portList[index+1], searching);
        }
        
    } else {
        //If we aren't searching, then one fail just means to fail
        portStatus.innerHTML = "Could not connected to server with port " + port + ". Make sure the server is running";
    }
    serverPort = -1; //we have had a fail, update the port to be unknown
}

/**
 * search for a server with a given port number
 * @param port - the port to search for the server on
 * @param searching - true if we are in the process of doing a search through the portList, false if just searching for one port
 */
function searchPort(port, searching) {
    //update the user display
    var portStatus = document.querySelector('#port-status');
    portStatus.innerHTML = "Searching for server"
    //we will need to send a request to check that there is a server running at the given port
    var discoverReq = new XMLHttpRequest();
    discoverReq.port = port; //save to the object to use if successful
    discoverReq.searching = searching; //save whether or not we are searching
    discoverReq.onload = portFound; //the response will be handled in the portFound function
    discoverReq.onerror = function() {
        failedPortFind(port, searching);
    }
    discoverReq.open("POST", serverLocation + port);
    discoverReq.setRequestHeader("Content-Type", "application/json");

    //construct the body, we just need to send a get request to who_am_i
    var httpBody = new Object();
    httpBody.type = "DISCOVER";

    //send the request, this goes to the Python server
    discoverReq.send(JSON.stringify(httpBody));

    console.log('port request sent to ' + port);
}

/**
 * startup function, runs all processes that need to be run on startup
 */
function startup() {
    searchPort(portList[0], true); //search for a server to connect to
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

    charger.container = chargerContainer; //add the full container to the charger object
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

    //create the progress display, this is just two divs inside each other coloured differently
    var batteryDisplayBackground = document.createElement("div");
    batteryDisplayBackground.className = "battery-display-background";
    
    var batteryDisplayForeground = document.createElement("div");
    batteryDisplayForeground.className = "battery-display-foreground";
    batteryDisplayBackground.appendChild(batteryDisplayForeground);
    container.appendChild(batteryDisplayBackground);
    

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
    console.log(charger.container);
    var status = charger.container.querySelector(".charger-status");
    status.style.visibility = "visible";
    status.innerHTML = message;
}

/**
 * Function for displaying that the charger failed to add
 */
function failedChargerAdd(ipAddress, reason, searching) {
    console.log("unsuccessful ip address addition of " + ipAddress)
    //update the status bar if we aren't searching
    if (!searching) {
        var statusBar = document.getElementById("enter-status");
        statusBar.textContent = reason;
    }
    //check for the flag sent through to indicate the search is over
    if (ipAddress == "finish") {
        var statusBar = document.getElementById("enter-status");
        statusBar.textContent = "search complete";      
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



///////////////////////////////////////EVENTS/////////////////////////////////////
addChargerButton.addEventListener('click', ipAddressEntered, false);
portChangeButton.addEventListener('click', portNumberEntered, false);
portSearchButton.addEventListener('click', function(){searchPort(portList[0], true)}, false);
ipSearchButton.addEventListener('click', searchIpAddresses, false);
document.addEventListener('DOMContentLoaded', startup, false); //run the startup function on load
