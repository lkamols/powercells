'use strict'

const serverLocation = "http://localhost:8080";

//SELECTORS
const switcher = document.querySelector('.btn');
const addChargerButton = document.querySelector('.add-btn')

/*
function reqListener() {
    console.log(this.responseText);
}

switcher.addEventListener('click', function() {
    
    document.getElementById("start-msg").style.visibility = "visible";

    var oReq = new XMLHttpRequest();
    oReq.addEventListener("load", reqListener);
    oReq.open("POST", serverLocation);
    oReq.setRequestHeader("Content-Type", "application/json");

    var httpBody = new Object();
    httpBody.url = "http://192.168.0.45/api/get_cells_info";
    httpBody.body = {"settings": [{"charger_id":1}]};
    httpBody.type = "POST";


    oReq.send(JSON.stringify(httpBody));

    console.log('process started');
})
*/

/**
 * new IP address added
 */
function newIpAdded(event) {
    var enteredIp = document.getElementById("entry").value;
    
    //now go through a basic process of checking that there is a MegaCellCharger associated with that url
    var whoAmIUrl = "http://" + enteredIp + "/api/who_am_i";
    var whoAmIReq = new XMLHttpRequest();
    //whoAmIReq.addEventListener("load", whoAmIResponse.bind(null, enteredIp), false);
    whoAmIReq.practiceurl = whoAmIUrl;
    whoAmIReq.onreadystatechange = whoAmIResponse;
    whoAmIReq.open("POST", serverLocation);
    whoAmIReq.setRequestHeader("Content-Type", "application/json");

    var httpBody = new Object();
    httpBody.url = whoAmIUrl;
    httpBody.type = "GET";

    whoAmIReq.send(JSON.stringify(httpBody));

    console.log('process started');
}

function whoAmIResponse() {
    console.log("here");
    if (this.readyState === 4) {
        if (this.status == 200) { //OK RESPONSE
            console.log(this.responseText);
            console.log(this.practiceurl);
        } else if (this.status == 404) {
            console.log("not a valid url")
        } else {
            console.log("unexpected response:", this.status);
        }
    }
}

//EVENTS
addChargerButton.addEventListener('click', newIpAdded, false)
