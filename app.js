'use strict'

const switcher = document.querySelector('.btn');

function reqListener() {
    console.log(this.responseText);
}

switcher.addEventListener('click', function() {
    
    document.getElementById("start-msg").style.visibility = "visible";

    var oReq = new XMLHttpRequest();
    oReq.addEventListener("load", reqListener);
    oReq.open("GET", "http://localhost:8080");
    //oReq.setRequestHeader("Upgrade-Insecure-Requests", "1");
    //oReq.setRequestHeader("Access-Control-Allow-Origin", "*");
    //oReq.setRequestHeader("Content-Type", "text/plain");
    oReq.send();

    console.log('process started');
})